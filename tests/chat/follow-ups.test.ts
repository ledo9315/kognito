import type { LanguageModel } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { suggestFollowUps } from '@/features/chat/follow-ups'

/** Answers with the given object, or fails, and records the prompt it saw. */
function mockModel(object: unknown | Error) {
  const seen: { prompt: unknown } = { prompt: null }

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      seen.prompt = options.prompt
      if (object instanceof Error) throw object
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(object) }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      }
    },
  })

  return { model: model as unknown as LanguageModel, seen }
}

describe('suggesting what to ask next', () => {
  it('hands the model the question and the answer, and returns the questions', async () => {
    const { model, seen } = mockModel({
      questions: [
        'Wie wurde die Genauigkeit gemessen?',
        'Welche Quellen fielen durch?',
        'Was kostet ein Durchlauf?',
      ],
    })

    const questions = await suggestFollowUps(
      'Wie gut ist die Pipeline?',
      'Die Pipeline erreicht einen F1-Wert von 0,857.',
      model,
    )

    expect(questions).toHaveLength(3)
    expect(questions[0]).toBe('Wie wurde die Genauigkeit gemessen?')

    const prompt = JSON.stringify(seen.prompt)
    expect(prompt).toContain('Wie gut ist die Pipeline?')
    expect(prompt).toContain('F1-Wert von 0,857')
  })

  it('keeps three of them, and drops the empty and the endless ones', async () => {
    const { model } = mockModel({
      questions: [
        '  Erste Frage?  ',
        '',
        'Zweite Frage?',
        'x'.repeat(200),
        'Dritte Frage?',
        'Vierte Frage?',
      ],
    })

    expect(await suggestFollowUps('Frage', 'Antwort', model)).toEqual([
      'Erste Frage?',
      'Zweite Frage?',
      'Dritte Frage?',
    ])
  })

  it('asks nothing when there is no answer to build on', async () => {
    const { model, seen } = mockModel({ questions: ['Sollte nie kommen'] })

    expect(await suggestFollowUps('Frage', '   ', model)).toEqual([])
    expect(seen.prompt).toBeNull()
  })

  it('offers nothing when the model is unreachable', async () => {
    const { model } = mockModel(new Error('rate limited'))

    expect(await suggestFollowUps('Frage', 'Eine Antwort.', model)).toEqual([])
  })
})
