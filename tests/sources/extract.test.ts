import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ExtractionError,
  extractFromFile,
  extractFromUrl,
  isPrivateAddress,
  unwrapLines,
} from '@/features/sources/extract'

/** Beside this file, not beside the working directory: a moved test keeps
 *  finding its fixtures, which a path relative to the repository root does
 *  not, and no compiler catches that one. */
function fixturePath(name: string) {
  return join(import.meta.dirname, 'fixtures', name)
}

async function fixture(name: string, type: string) {
  const bytes = await readFile(fixturePath(name))
  return new File([new Uint8Array(bytes)], name, { type })
}

function textFile(name: string, type: string, content: string) {
  return new File([content], name, { type })
}

/** Fails the test if the call succeeds, returns the code if it does not. */
async function codeOf(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    if (error instanceof ExtractionError) return error.code
    throw error
  }
  throw new Error('expected the extraction to fail, but it succeeded')
}

describe('files', () => {
  it('reads a plain text file', async () => {
    const { text } = await extractFromFile(await fixture('sample.txt', 'text/plain'))

    expect(text).toContain('Protokoll der Sitzung vom 3. März')
    expect(text).toContain('Nächster Termin: 17. März.')
  })

  it('keeps markdown as it is written', async () => {
    const { text } = await extractFromFile(await fixture('sample.md', 'text/markdown'))

    expect(text).toContain('# Kognito')
    expect(text).toContain('- Jede Aussage bekommt eine Belegstelle')
  })

  it('reads the text layer of a pdf', async () => {
    const { text } = await extractFromFile(await fixture('sample.pdf', 'application/pdf'))

    expect(text).toContain('Kognito Testdokument')
    expect(text).toContain('Zweite Zeile mit Inhalt.')
  })

  it('falls back to the file extension when the type is missing', async () => {
    const bytes = await readFile(fixturePath('sample.pdf'))
    const file = new File([new Uint8Array(bytes)], 'ohne-typ.pdf', { type: '' })

    expect((await extractFromFile(file)).text).toContain('Kognito Testdokument')
  })
})

describe('files that cannot be read', () => {
  it('reports a pdf without a text layer', async () => {
    const file = await fixture('scanned.pdf', 'application/pdf')

    expect(await codeOf(() => extractFromFile(file))).toBe('no-text-layer')
  })

  it('reports an empty file', async () => {
    const file = textFile('leer.txt', 'text/plain', '')

    expect(await codeOf(() => extractFromFile(file))).toBe('empty')
  })

  it('reports a file that only contains whitespace', async () => {
    const file = textFile('leer.txt', 'text/plain', '   \n\n\t ')

    expect(await codeOf(() => extractFromFile(file))).toBe('empty')
  })

  it('reports a file type it cannot handle', async () => {
    const file = textFile('bericht.docx', 'application/msword', 'egal')

    expect(await codeOf(() => extractFromFile(file))).toBe('unsupported')
  })
})

describe('normalising', () => {
  it('unifies line breaks and collapses blank lines', async () => {
    const file = textFile(
      'roh.txt',
      'text/plain',
      '  Erste Zeile   \r\n\r\n\r\n\r\nZweite Zeile mit Leerzeichen\r\n  ',
    )

    const { text } = await extractFromFile(file)

    expect(text).toBe('Erste Zeile\n\nZweite Zeile mit Leerzeichen')
  })

  it('joins the lines a pdf was wrapped at back into paragraphs', () => {
    const pdf = [
      'Abstract',
      'Veranstaltungsinformationen sind im Web uber eine Vielzahl heterogener',
      'Quellen verstreut: Veranstalter und Veranstaltungsorte pflegen ihre Pro-',
      'gramme auf eigenen Webseiten.',
      '',
      'Klassische Web-',
      'Scraping-Verfahren skalieren schlecht.',
    ].join('\n')

    expect(unwrapLines(pdf)).toBe(
      [
        'Abstract',
        'Veranstaltungsinformationen sind im Web uber eine Vielzahl heterogener Quellen verstreut: Veranstalter und Veranstaltungsorte pflegen ihre Programme auf eigenen Webseiten.',
        '',
        'Klassische Web-',
        'Scraping-Verfahren skalieren schlecht.',
      ].join('\n'),
    )
  })
})

/* -------------------------------------------------------------------------- */

const html = await readFile(fixturePath('article.html'), 'utf8')

/** A fetch that answers every request with the same response. */
function respondWith(body: string, init: ResponseInit = {}) {
  return async () =>
    new Response(body, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      ...init,
    })
}

const publicLookup = async () => ['93.184.216.34']

describe('urls', () => {
  it('extracts the main content and leaves the rest behind', async () => {
    const result = await extractFromUrl('https://beispiel.de/wasserstoff', {
      fetch: respondWith(html),
      lookup: publicLookup,
    })

    // The title is taken as the page states it, including the name of the
    // publication. Cutting at a separator would ruin every title that legally
    // contains one, and pages that care usually set og:title.
    expect(result.title).toBe('Wasserstoff in der Industrie | Beispielzeitung')
    expect(result.text).toContain('Der Hochlauf verläuft langsamer als geplant.')
    expect(result.text).toContain('sechs Cent je Kilowattstunde')

    expect(result.text).not.toContain('Startseite')
    expect(result.text).not.toContain('Impressum')
    expect(result.text).not.toContain('tracking')
    expect(result.text).not.toContain('<p>')
  })

  it('takes plain text as it comes', async () => {
    const result = await extractFromUrl('https://beispiel.de/notiz.txt', {
      fetch: respondWith('Nur eine Notiz.', {
        headers: { 'content-type': 'text/plain' },
      }),
      lookup: publicLookup,
    })

    expect(result.text).toBe('Nur eine Notiz.')
  })

  it('follows a redirect', async () => {
    let hop = 0
    const fetcher = async (input: string | URL | Request) => {
      hop++
      if (hop === 1) {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://beispiel.de/endgueltig' },
        })
      }
      expect(String(input)).toBe('https://beispiel.de/endgueltig')
      return new Response(html, { headers: { 'content-type': 'text/html' } })
    }

    const result = await extractFromUrl('https://beispiel.de/alt', {
      fetch: fetcher as typeof fetch,
      lookup: publicLookup,
    })

    expect(result.title).toBe('Wasserstoff in der Industrie | Beispielzeitung')
  })

  it('prefers the title the page declares for sharing', async () => {
    const page = `<html><head><title>Lang und mit Zeitungsnamen | Beispielzeitung</title>
      <meta property="og:title" content="Kurz und treffend" /></head>
      <body><article><h1>Überschrift</h1><p>${'Ein hinreichend langer Absatz, damit der Inhalt als Artikel durchgeht. '.repeat(6)}</p></article></body></html>`

    const result = await extractFromUrl('https://beispiel.de/artikel', {
      fetch: respondWith(page),
      lookup: publicLookup,
    })

    expect(result.title).toBe('Kurz und treffend')
  })
})

describe('urls that cannot be read', () => {
  it('reports a server error', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://beispiel.de/weg', {
        fetch: respondWith('', { status: 500 }),
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('unreachable')
  })

  it('reports a host that does not answer', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://beispiel.de/', {
        fetch: async () => {
          throw new TypeError('fetch failed')
        },
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('unreachable')
  })

  it('reports a page without readable content', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://beispiel.de/leer', {
        fetch: respondWith('<html><body><div></div></body></html>'),
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('empty')
  })

  it('refuses a download that is not a page', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://beispiel.de/bild.png', {
        fetch: respondWith('', { headers: { 'content-type': 'image/png' } }),
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('unsupported')
  })

  it('refuses a protocol other than http', async () => {
    const code = await codeOf(() =>
      extractFromUrl('file:///etc/passwd', {
        fetch: respondWith(html),
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('unsupported')
  })

  it('refuses a page that is too large', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://beispiel.de/riesig', {
        fetch: respondWith(html, {
          headers: { 'content-type': 'text/html', 'content-length': '90000000' },
        }),
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('too-large')
  })
})

describe('addresses in the local network', () => {
  it('recognises the ranges that must not be fetched', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.3.9',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(address), address).toBe(true)
    }

    for (const address of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:2800:220::1']) {
      expect(isPrivateAddress(address), address).toBe(false)
    }
  })

  it('refuses a host that resolves into the local network', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://interner-dienst.example/', {
        fetch: respondWith(html),
        lookup: async () => ['10.1.2.3'],
      }),
    )

    expect(code).toBe('blocked')
  })

  it('refuses an address written directly into the url', async () => {
    const code = await codeOf(() =>
      extractFromUrl('http://169.254.169.254/latest/meta-data/', {
        fetch: respondWith(html),
        lookup: async () => {
          throw new Error('the guard must not need dns for a literal address')
        },
      }),
    )

    expect(code).toBe('blocked')
  })

  it('checks every hop, not just the first', async () => {
    const code = await codeOf(() =>
      extractFromUrl('https://beispiel.de/weiterleitung', {
        fetch: async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://127.0.0.1:8080/admin' },
          }),
        lookup: publicLookup,
      }),
    )

    expect(code).toBe('blocked')
  })
})
