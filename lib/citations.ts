import { quoteLength } from '@/lib/config'
import type { NumberedChunk } from '@/lib/context'
import type { Citation } from '@/lib/db/schema'

/**
 * Turning `[3]` in an answer back into the passage it came from.
 *
 * The model only ever writes a number. Everything the interface needs behind
 * that number, the chunk, the source and a bit of the text, is put back here.
 */

/** One citation per passage that was in the prompt, whether cited or not. */
export function toCitations(chunks: NumberedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    index: chunk.number,
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    quote: quoteOf(chunk.text),
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
  }))
}

function quoteOf(text: string) {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  return trimmed.length > quoteLength
    ? `${trimmed.slice(0, quoteLength)}…`
    : trimmed
}

/**
 * The citations an answer really uses, in the order it first uses them.
 *
 * A number the model made up has nothing to point at and is left out. The
 * text keeps it, see `splitAnswer`, so nothing silently disappears from the
 * answer.
 */
export function citationsIn(answer: string, candidates: Citation[]): Citation[] {
  const used: Citation[] = []
  const seen = new Set<number>()

  for (const segment of splitAnswer(answer, candidates)) {
    if (segment.type !== 'citation') continue
    if (seen.has(segment.citation.index)) continue
    seen.add(segment.citation.index)
    used.push(segment.citation)
  }

  return used
}

export type AnswerSegment =
  | { type: 'text'; text: string }
  | { type: 'emphasis'; text: string }
  | { type: 'citation'; citation: Citation }

/** `**bold**` and `[3]`, everything else stays text. */
const tokens = /(\*\*[^*]+\*\*|\[\d+\])/g

/**
 * One line of an answer, cut into the pieces the interface renders. A `[99]`
 * without a passage behind it stays text, so an invented number shows up as
 * what it is instead of vanishing.
 */
export function splitAnswer(line: string, citations: Citation[]): AnswerSegment[] {
  const segments: AnswerSegment[] = []

  for (const token of line.split(tokens)) {
    if (!token) continue

    if (token.startsWith('**') && token.endsWith('**')) {
      segments.push({ type: 'emphasis', text: token.slice(2, -2) })
      continue
    }

    const marker = token.match(/^\[(\d+)\]$/)
    if (marker) {
      const citation = citations.find(
        (candidate) => candidate.index === Number(marker[1]),
      )
      if (citation) {
        segments.push({ type: 'citation', citation })
        continue
      }
    }

    segments.push({ type: 'text', text: token })
  }

  return segments
}
