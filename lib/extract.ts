import { lookup as dnsLookup } from 'node:dns/promises'
import { extractFromHtml } from '@extractus/article-extractor'
import { parseHTML } from 'linkedom'
import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Turns an upload or a link into plain text.
 *
 * The result is what gets stored as source.content, and the chunker computes
 * its offsets against exactly this string. Whitespace is therefore cleaned up
 * here, once, and never again afterwards.
 */

export type Extraction = {
  title: string | null
  text: string
}

export type ExtractionErrorCode =
  /** No text at all, or only whitespace. */
  | 'empty'
  /** A pdf made of scanned images. Reading it would need OCR. */
  | 'no-text-layer'
  /** A file type or protocol this does not handle. */
  | 'unsupported'
  /** The server did not answer, or answered with an error. */
  | 'unreachable'
  /** Larger than the limit. */
  | 'too-large'
  /** The address points into a network that must not be reached from here. */
  | 'blocked'

export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ExtractionError'
  }
}

const fetchTimeout = 10_000
const maxBytes = 5_000_000
const maxRedirects = 3

/* -------------------------------------------------------------------------- */
/* Files                                                                       */

export async function extractFromFile(file: File): Promise<Extraction> {
  if (file.size === 0) {
    throw new ExtractionError('empty', `${file.name} is empty`)
  }

  const name = file.name.toLowerCase()
  const type = file.type.split(';')[0].trim()

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return { title: null, text: await readPdf(file) }
  }

  if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    const text = normalize(await file.text())
    if (!text) throw new ExtractionError('empty', `${file.name} has no text`)
    return { title: null, text }
  }

  throw new ExtractionError(
    'unsupported',
    `${file.name} is a ${type || 'file'} that cannot be read`,
  )
}

// The pdf.js build inside unpdf sums font table and column sizes with
// Math.sumPrecise, which Node 24 does not ship yet. Without it every embedded
// font logs a warning while it is being read. The values are integers, so a
// plain sum is exact and the precise variant buys nothing here.
const math = Math as { sumPrecise?: (values: Iterable<number>) => number }
math.sumPrecise ??= (values) => [...values].reduce((total, value) => total + value, 0)

async function readPdf(file: File) {
  const document = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
  const { text } = await extractText(document, { mergePages: true })
  const normalized = unwrapLines(normalize(text))

  // The pages parsed, they just carry no characters. That is a scan, and the
  // fix is a different file rather than a retry.
  if (!normalized) {
    throw new ExtractionError('no-text-layer', `${file.name} contains no text layer`)
  }

  return normalized
}

/* -------------------------------------------------------------------------- */
/* Urls                                                                        */

export type UrlDependencies = {
  fetch?: typeof globalThis.fetch
  /** Resolves a host name to its addresses. Injected so the guard can be
   *  tested without asking a name server. */
  lookup?: (hostname: string) => Promise<string[]>
}

export async function extractFromUrl(
  input: string,
  dependencies: UrlDependencies = {},
): Promise<Extraction> {
  const fetcher = dependencies.fetch ?? globalThis.fetch
  const resolve = dependencies.lookup ?? defaultLookup

  const { response, url } = await follow(input, fetcher, resolve)
  const type = response.headers.get('content-type')?.split(';')[0].trim() ?? ''

  if (type === 'text/plain') {
    const text = normalize(await readCapped(response))
    if (!text) throw new ExtractionError('empty', `${url} has no text`)
    return { title: null, text }
  }

  if (type && type !== 'text/html' && type !== 'application/xhtml+xml') {
    throw new ExtractionError('unsupported', `${url} answered with ${type}`)
  }

  return fromHtml(await readCapped(response), url)
}

async function fromHtml(html: string, url: string): Promise<Extraction> {
  const article = await extractFromHtml(html, url)
  const { document } = parseHTML(html)

  // Readability gives up on very short pages. The body is a worse answer than
  // the article, but a better one than nothing.
  const text =
    normalize(htmlToText(article?.content ?? '')) ||
    normalize(document.body?.textContent ?? '')

  if (!text) throw new ExtractionError('empty', `${url} has no readable content`)

  const title = article?.title?.trim() || document.title?.trim() || null
  return { title: title || null, text }
}

/**
 * Fetches the url, following redirects one at a time.
 *
 * Redirects are handled here rather than by fetch, because every hop has to
 * pass the address guard. A public host that redirects to 127.0.0.1 would
 * otherwise walk straight through it.
 */
async function follow(
  input: string,
  fetcher: typeof globalThis.fetch,
  resolve: (hostname: string) => Promise<string[]>,
) {
  let url = parseUrl(input)

  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublic(url, resolve)

    let response: Response
    try {
      response = await fetcher(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(fetchTimeout),
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
          'user-agent': 'KognitoBot/1.0 (+https://github.com/ledo9315/kognito)',
        },
      })
    } catch (error) {
      throw new ExtractionError(
        'unreachable',
        `${url} did not answer: ${(error as Error).message}`,
      )
    }

    const location = response.headers.get('location')
    if (isRedirect(response.status) && location) {
      url = parseUrl(location, url)
      continue
    }

    if (!response.ok) {
      throw new ExtractionError('unreachable', `${url} answered with ${response.status}`)
    }

    const declared = Number(response.headers.get('content-length'))
    if (declared > maxBytes) {
      throw new ExtractionError('too-large', `${url} is ${declared} bytes`)
    }

    return { response, url: url.toString() }
  }

  throw new ExtractionError('unreachable', `${input} redirects in circles`)
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function parseUrl(input: string, base?: URL) {
  let url: URL
  try {
    url = new URL(input, base)
  } catch {
    throw new ExtractionError('unsupported', `${input} is not a valid address`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExtractionError('unsupported', `${url.protocol} is not supported`)
  }

  return url
}

/** Reads the body, stopping once the limit is exceeded. */
async function readCapped(response: Response) {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel()
      throw new ExtractionError('too-large', `the answer exceeds ${maxBytes} bytes`)
    }
    parts.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }

  return new TextDecoder('utf-8').decode(merged)
}

/* -------------------------------------------------------------------------- */
/* Guard against reaching into the local network                               */

async function defaultLookup(hostname: string) {
  const addresses = await dnsLookup(hostname, { all: true })
  return addresses.map((entry) => entry.address)
}

async function assertPublic(url: URL, resolve: (hostname: string) => Promise<string[]>) {
  // Brackets around an IPv6 literal are part of the url, not of the address.
  const hostname = url.hostname.replace(/^\[|\]$/g, '')

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new ExtractionError('blocked', `${hostname} is a local name`)
  }

  const addresses = isAddress(hostname) ? [hostname] : await resolveOrFail(hostname, resolve)

  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new ExtractionError('blocked', `${hostname} points at ${address}`)
    }
  }
}

async function resolveOrFail(hostname: string, resolve: (hostname: string) => Promise<string[]>) {
  try {
    return await resolve(hostname)
  } catch {
    throw new ExtractionError('unreachable', `${hostname} cannot be resolved`)
  }
}

function isAddress(hostname: string) {
  return /^[0-9.]+$/.test(hostname) || hostname.includes(':')
}

/**
 * Whether an address belongs to the machine itself, to the local network, or
 * to the cloud metadata service. Fetching a user supplied url is otherwise a
 * way to make the server read things the user cannot reach.
 */
export function isPrivateAddress(address: string) {
  const plain = address.toLowerCase().replace(/^::ffff:/, '')

  if (/^\d+\.\d+\.\d+\.\d+$/.test(plain)) {
    const [first, second] = plain.split('.').map(Number)

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    )
  }

  return (
    plain === '::' ||
    plain === '::1' ||
    plain.startsWith('fc') ||
    plain.startsWith('fd') ||
    plain.startsWith('fe80') ||
    plain.startsWith('ff')
  )
}

/* -------------------------------------------------------------------------- */

/** Block level tags become line breaks, everything else is dropped. */
function htmlToText(html: string) {
  if (!html) return ''

  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote|pre)>/gi, '$&\n')

  // Wrapped in a full document on purpose: given a bare fragment, linkedom
  // parses it into a document without a body, and the text would be lost.
  const { document } = parseHTML(`<html><body>${withBreaks}</body></html>`)
  return document.body?.textContent ?? ''
}

/**
 * Joins the visual lines of a pdf back into paragraphs.
 *
 * A pdf has no paragraphs, only lines placed on a page, so the extractor ends
 * every one with a newline and the reader shows a ragged column. A line that
 * reaches the column width was broken by the layout and continues on the next
 * one. A shorter line ended on purpose: a heading, a list item, the last line
 * of a paragraph.
 *
 * ponytail: a width heuristic, no font or coordinate data. Multi column pages
 * and tables stay ragged, which needs the per item positions from unpdf.
 */
export function unwrapLines(text: string) {
  const lines = text.split('\n')

  // The 95th percentile rather than the longest line, so a single wide table
  // row or url does not raise the width for the whole document.
  const lengths = lines.map((line) => line.length).sort((first, second) => first - second)
  const width = lengths[Math.floor(lengths.length * 0.95)] ?? 0
  const wrapped = width * 0.8

  return lines.reduce((text, line, index) => {
    if (index === 0) return line

    const previous = lines[index - 1]
    if (!line || previous.length < wrapped) return `${text}\n${line}`

    // A word broken across lines keeps its hyphen only when the next line
    // starts a new word, as in "Web-\nScraping".
    if (/\p{Ll}-$/u.test(previous) && /^\p{Ll}/u.test(line)) {
      return `${text.slice(0, -1)}${line}`
    }

    return `${text} ${line}`
  }, '')
}

function normalize(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ​]+/g, ' ')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
