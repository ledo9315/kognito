import type { EmbeddingModel } from 'ai'
import { MockEmbeddingModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { embeddingSize } from '@/lib/db/schema'
import { createEmbedder, defaultEmbeddingModel } from '@/lib/embeddings'

/**
 * Answers one set of numbers per value it was handed. embedMany may split a
 * list across several calls, so a mock with a fixed answer would hand back
 * more embeddings than there were passages.
 */
function modelReturning(numbers: number[][]) {
  return new MockEmbeddingModelV4({
    doEmbed: async ({ values }) => ({
      embeddings: values.map((_, index) => numbers[index % numbers.length]),
      warnings: [],
    }),
  }) as unknown as EmbeddingModel
}

function ofSize(size: number, fill = 0.1) {
  return new Array<number>(size).fill(fill)
}

describe('the embedding model', () => {
  it('comes from the environment, so swapping it is configuration', () => {
    expect(defaultEmbeddingModel()).toBe(
      process.env.AI_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small',
    )
  })

  it('asks for nothing when there is nothing to embed', async () => {
    let asked = false
    const model = new MockEmbeddingModelV4({
      doEmbed: async () => {
        asked = true
        return { embeddings: [], warnings: [] }
      },
    }) as unknown as EmbeddingModel

    expect(await createEmbedder(model).ofPassages([])).toEqual([])
    expect(asked).toBe(false)
  })

  it('hands back one set of numbers per passage', async () => {
    const model = modelReturning([ofSize(embeddingSize), ofSize(embeddingSize, 0.2)])

    const embeddings = await createEmbedder(model).ofPassages(['eins', 'zwei'])

    expect(embeddings).toHaveLength(2)
    expect(embeddings[0]).toHaveLength(embeddingSize)
  })

  it('refuses a model whose numbers do not fit the column', async () => {
    // 768 instead of 1536 is a realistic mix-up, and Postgres would answer
    // it with an error nobody can act on.
    const model = modelReturning([ofSize(768)])

    await expect(
      createEmbedder(model).ofPassages(['eins']),
    ).rejects.toThrow(/768 numbers, the column holds 1536/)
  })

  it('checks the question as well, not only the passages', async () => {
    const model = modelReturning([ofSize(3)])

    await expect(createEmbedder(model).ofQuestion('Frage?')).rejects.toThrow(
      /the column holds 1536/,
    )
  })
})
