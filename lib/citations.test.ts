import { describe, expect, it } from 'vitest'
import { citationsIn, splitAnswer, toCitations } from '@/lib/citations'
import type { NumberedChunk } from '@/lib/context'
import type { Citation } from '@/lib/db/schema'

function chunkOf(number: number, text: string): NumberedChunk {
  return {
    number,
    chunkId: `chunk-${number}`,
    sourceId: `source-${number}`,
    sourceTitle: `Quelle ${number}`,
    text,
    charStart: number * 100,
    charEnd: number * 100 + text.length,
  }
}

const candidates = toCitations([
  chunkOf(1, 'Der Zeitplan ist nicht zu halten.'),
  chunkOf(2, 'Nächster Termin ist der 17. März.'),
  chunkOf(3, 'Die Pumpen kommen später.'),
])

function citationNumbers(segments: ReturnType<typeof splitAnswer>) {
  return segments
    .filter((segment) => segment.type === 'citation')
    .map((segment) => segment.citation.index)
}

function plainText(segments: ReturnType<typeof splitAnswer>) {
  return segments
    .filter((segment) => segment.type !== 'citation')
    .map((segment) => segment.text)
    .join('')
}

describe('turning a passage into a citation', () => {
  it('keeps the number the model was given', () => {
    expect(candidates.map((citation) => citation.index)).toEqual([1, 2, 3])
    expect(candidates[1].chunkId).toBe('chunk-2')
    expect(candidates[1].sourceId).toBe('source-2')
  })

  it('shortens a long passage into a quotable opening', () => {
    const [citation] = toCitations([chunkOf(1, 'Wort '.repeat(200))])

    expect(citation.quote.length).toBeLessThanOrEqual(201)
    expect(citation.quote.endsWith('…')).toBe(true)
  })

  it('collapses line breaks, so the tooltip stays one block of text', () => {
    const [citation] = toCitations([chunkOf(1, ' Erste Zeile.\n\n Zweite Zeile. ')])

    expect(citation.quote).toBe('Erste Zeile. Zweite Zeile.')
  })
})

describe('splitting an answer', () => {
  it('resolves a single citation', () => {
    const segments = splitAnswer('Der Termin ist der 17. März [2].', candidates)

    expect(citationNumbers(segments)).toEqual([2])
    expect(segments.at(-1)).toEqual({ type: 'text', text: '.' })
  })

  it('resolves two citations that sit next to each other', () => {
    const segments = splitAnswer('Beides ist belegt [1][3].', candidates)

    expect(citationNumbers(segments)).toEqual([1, 3])
  })

  it('resolves the same number twice, because it is cited twice', () => {
    const segments = splitAnswer('Erst [1], dann wieder [1].', candidates)

    expect(citationNumbers(segments)).toEqual([1, 1])
  })

  it('leaves a number without a passage as text', () => {
    const segments = splitAnswer('Angeblich steht das in [99].', candidates)

    expect(citationNumbers(segments)).toEqual([])
    expect(plainText(segments)).toBe('Angeblich steht das in [99].')
  })

  it('leaves brackets that are not citations alone', () => {
    const line = 'Die Norm [DIN 1234] und ein Rest [] und [1a] bleiben Text.'
    const segments = splitAnswer(line, candidates)

    expect(citationNumbers(segments)).toEqual([])
    expect(plainText(segments)).toBe(line)
  })

  it('marks emphasis without swallowing a citation behind it', () => {
    const segments = splitAnswer('**Befund.** Der Termin steht [2].', candidates)

    expect(segments[0]).toEqual({ type: 'emphasis', text: 'Befund.' })
    expect(citationNumbers(segments)).toEqual([2])
  })

  it('returns an answer without citations unchanged', () => {
    const segments = splitAnswer('Dazu steht nichts in den Quellen.', candidates)

    expect(segments).toEqual([
      { type: 'text', text: 'Dazu steht nichts in den Quellen.' },
    ])
  })
})

describe('collecting the citations of an answer', () => {
  it('keeps only what was cited, in the order of first use', () => {
    const used = citationsIn('Zuerst [3], danach [1] und nochmal [3].', candidates)

    expect(used.map((citation) => citation.index)).toEqual([3, 1])
  })

  it('drops a number that points at no passage', () => {
    expect(citationsIn('Steht in [99].', candidates)).toEqual([])
  })

  it('returns nothing for an answer that cites nothing', () => {
    expect(citationsIn('Dazu steht nichts in den Quellen.', candidates)).toEqual(
      [],
    )
  })

  it('resolves across several lines of an answer', () => {
    const answer = '**Konsens.** Alles klar [1].\n\nAber der Termin kippt [2].'

    expect(citationsIn(answer, candidates).map((one) => one.index)).toEqual([
      1, 2,
    ])
  })

  it('carries the passage along, so the interface can quote it', () => {
    const [citation] = citationsIn('Der Termin steht [2].', candidates)

    expect(citation).toEqual<Citation>({
      index: 2,
      chunkId: 'chunk-2',
      sourceId: 'source-2',
      quote: 'Nächster Termin ist der 17. März.',
    })
  })
})
