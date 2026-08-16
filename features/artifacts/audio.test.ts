import { describe, expect, it } from 'vitest'
import {
  audioOverviewMeta,
  mergeAudioScripts,
  readAudioOverview,
  splitScript,
  trimToSentence,
} from '@/features/artifacts/audio'
import { maxScriptCharacters } from '@/lib/config'

/**
 * The three rules that keep an overview an overview: it ends on a sentence,
 * it is cut into pieces a synthesis request takes, and a large selection
 * gives every window the same share instead of only the first ones.
 */

describe('trimToSentence', () => {
  it('leaves a text that fits alone', () => {
    expect(trimToSentence('Kurz und gut.', 100)).toBe('Kurz und gut.')
  })

  it('ends on the last full sentence', () => {
    expect(trimToSentence('Eins. Zwei. Drei.', 12)).toBe('Eins. Zwei.')
  })

  it('cuts hard when the first sentence is longer than the limit', () => {
    expect(trimToSentence('a'.repeat(20), 5)).toBe('aaaaa')
  })
})

describe('splitScript', () => {
  it('keeps a short script in one piece', () => {
    expect(splitScript('Eins. Zwei.', 100)).toEqual(['Eins. Zwei.'])
  })

  it('cuts between sentences, never inside one', () => {
    const pieces = splitScript('Eins. Zwei. Drei.', 12)

    expect(pieces).toEqual(['Eins. Zwei.', 'Drei.'])
    expect(pieces.every((piece) => piece.length <= 12)).toBe(true)
  })

  it('splits a sentence that would never fit', () => {
    expect(splitScript('a'.repeat(9), 4)).toEqual(['aaaa', 'aaaa', 'a'])
  })

  it('loses nothing on the way', () => {
    const script = 'Ein Satz. Noch einer! Und eine Frage? Zum Schluss.'
    expect(splitScript(script, 20).join(' ')).toBe(script)
  })

  it('has nothing to say about an empty script', () => {
    expect(splitScript('', 100)).toEqual([])
  })
})

describe('mergeAudioScripts', () => {
  it('gives every window the same share of the running time', () => {
    const parts = [
      { title: 'Erste Quelle', script: 'a'.repeat(maxScriptCharacters) },
      { title: 'Zweite Quelle', script: 'b'.repeat(maxScriptCharacters) },
    ]

    const merged = mergeAudioScripts(parts)
    const half = maxScriptCharacters / 2

    // Both windows are heard, and the second one is not what falls away.
    expect(merged.script).toContain('a'.repeat(half))
    expect(merged.script).toContain('b'.repeat(half))
    expect(merged.title).toBe('Erste Quelle')
  })
})

describe('audioOverviewMeta', () => {
  it('estimates the running time from the script', () => {
    const meta = audioOverviewMeta({
      title: 'Übersicht',
      script: 'a'.repeat(7_600),
      pathname: 'audio/one.mp3',
    })

    expect(meta).toBe('Rund 8 Minuten')
  })
})

describe('readAudioOverview', () => {
  it('skips an overview stored in an older shape', () => {
    // The playlist of the first cut, before the pieces were joined.
    expect(
      readAudioOverview({
        title: 'Alt',
        segments: [{ text: 'Eins.', pathname: 'audio/one.mp3' }],
      }),
    ).toBeNull()
    expect(
      readAudioOverview({ title: 'Leer', script: '', pathname: 'audio/x.mp3' }),
    ).toBeNull()
  })
})
