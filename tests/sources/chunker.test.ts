import { describe, expect, it } from 'vitest'
import { chunkLimits } from '@/lib/config'
import { chunkText } from '@/features/sources/chunker'

const { min, max, overlap } = chunkLimits

/** Text of a given length made of sentences, so boundaries exist to find. */
function prose(length: number) {
  const sentence = 'Der Bericht nennt drei Ursachen für die Verzögerung. '
  return sentence.repeat(Math.ceil(length / sentence.length)).slice(0, length)
}

describe('degenerate input', () => {
  it('returns nothing for an empty text', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns nothing for a text that is only whitespace', () => {
    expect(chunkText('   \n\n\t  ')).toEqual([])
  })

  it('keeps a short text as a single chunk', () => {
    const text = 'Eine einzige kurze Notiz.'

    expect(chunkText(text)).toEqual([
      { text, charStart: 0, charEnd: text.length },
    ])
  })

  it('splits a text without a single space', () => {
    const text = 'x'.repeat(max * 2 + 250)
    const chunks = chunkText(text)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(max)
    }
  })
})

describe('positions', () => {
  it('points exactly at the original text', () => {
    const text = prose(5000)

    for (const chunk of chunkText(text)) {
      expect(text.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
    }
  })

  it('covers the text from the first character to the last', () => {
    const text = prose(5000)
    const chunks = chunkText(text)

    expect(chunks[0].charStart).toBe(0)
    expect(chunks.at(-1)?.charEnd).toBe(text.length)
  })

  it('leaves no gap between one chunk and the next', () => {
    const chunks = chunkText(prose(5000))

    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index].charStart).toBeLessThanOrEqual(
        chunks[index - 1].charEnd,
      )
    }
  })

  it('always moves forward, so it cannot loop', () => {
    const chunks = chunkText(prose(5000))

    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index].charStart).toBeGreaterThan(chunks[index - 1].charStart)
      expect(chunks[index].charEnd).toBeGreaterThan(chunks[index - 1].charEnd)
    }
  })
})

describe('sizes', () => {
  it('stays within the limit and only falls below it in the last chunk', () => {
    const chunks = chunkText(prose(5000))

    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.text.length).toBeGreaterThanOrEqual(min)
      expect(chunk.text.length).toBeLessThanOrEqual(max)
    }
    expect(chunks.at(-1)!.text.length).toBeLessThanOrEqual(max)
  })

  it('repeats the end of the previous chunk', () => {
    const chunks = chunkText(prose(5000))

    for (let index = 1; index < chunks.length; index++) {
      const repeated = chunks[index - 1].charEnd - chunks[index].charStart
      expect(repeated).toBeGreaterThan(0)
      expect(repeated).toBeLessThanOrEqual(overlap * 2)
    }
  })
})

describe('across many shapes and sizes', () => {
  const shapes = {
    prose,
    paragraphs: (length: number) =>
      prose(length).replace(/(.{240})/g, '$1\n\n').slice(0, length),
    noSpaces: (length: number) => 'x'.repeat(length),
    windowsLineBreaks: (length: number) =>
      prose(length).replace(/\. /g, '.\r\n').slice(0, length),
  }

  for (const [name, build] of Object.entries(shapes)) {
    it(`puts ${name} back together without a gap or a loss`, () => {
      for (let length = 0; length <= 4000; length += 137) {
        const text = build(length)
        const chunks = chunkText(text)

        // Walk the chunks and append only what is new in each of them. The
        // result has to be the original text, character for character.
        let rebuilt = ''
        let covered = 0
        for (const chunk of chunks) {
          expect(chunk.charStart).toBeLessThanOrEqual(covered)
          expect(chunk.text.length).toBeLessThanOrEqual(max)
          rebuilt += chunk.text.slice(covered - chunk.charStart)
          covered = chunk.charEnd
        }

        expect(rebuilt).toBe(text.trim() === '' ? '' : text)
      }
    })
  }
})

describe('boundaries', () => {
  it('prefers to cut at a paragraph break', () => {
    const text = `${prose(700)}\n\n${prose(700)}`
    const [first] = chunkText(text)

    expect(first.charEnd).toBe(702)
    expect(first.text.endsWith('\n\n')).toBe(true)
  })

  it('cuts at the end of a sentence when there is no paragraph', () => {
    const chunks = chunkText(prose(5000))

    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.text.trimEnd().endsWith('.')).toBe(true)
    }
  })

  it('does not cut a word in half when no sentence end fits', () => {
    // Long words, no punctuation at all: whitespace is the last resort.
    const text = `${'wortohnepunkt '.repeat(200)}`
    const chunks = chunkText(text)

    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.text.endsWith(' ')).toBe(true)
    }
  })
})
