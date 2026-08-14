import { embed, embedMany, type EmbeddingModel } from 'ai'
import { embeddingSize } from '@/lib/db/schema'

/**
 * Turning text into the numbers that describe its meaning.
 *
 * This is the only place that talks to an embedding model. Everything else
 * works with plain arrays of numbers, which is what makes the tests run
 * without a network.
 */

export function defaultEmbeddingModel() {
  return process.env.AI_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small'
}

export type Embedder = {
  ofPassages: (texts: string[]) => Promise<number[][]>
  ofQuestion: (question: string) => Promise<number[]>
}

export function createEmbedder(model?: EmbeddingModel): Embedder {
  const chosen = model ?? defaultEmbeddingModel()

  return {
    ofPassages: async (texts) => {
      if (texts.length === 0) return []

      const { embeddings } = await embedMany({
        model: chosen,
        values: texts,
      })

      return embeddings.map(check)
    },

    ofQuestion: async (question) => {
      const { embedding } = await embed({ model: chosen, value: question })
      return check(embedding)
    },
  }
}

/**
 * A model with the wrong size would be written into the column and rejected
 * by Postgres with an error nobody can read. Better to say what happened.
 */
function check(embedding: number[]) {
  if (embedding.length !== embeddingSize) {
    throw new Error(
      `The embedding model returned ${embedding.length} numbers, the column holds ${embeddingSize}`,
    )
  }
  return embedding
}
