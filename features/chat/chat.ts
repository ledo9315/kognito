import { streamText, type LanguageModel, type ModelMessage } from 'ai'
import { citationsIn, toCitations } from '@/features/chat/citations'
import { buildPrompt, getContextChunks, NoContextError } from '@/features/chat/context'
import { createEmbedder, type Embedder } from '@/lib/embeddings'
import { getDb, type Database } from '@/lib/db'
import { saveMessage } from '@/features/chat/messages'
import { findNotebook } from '@/features/notebooks/notebooks'
import { defaultModel } from '@/lib/model'

export class ChatError extends Error {
  constructor(
    readonly code: 'unknown-notebook' | 'no-sources',
    message: string,
  ) {
    super(message)
    this.name = 'ChatError'
  }
}

export type AnswerInput = {
  notebookId: string
  ownerId: string
  question: string
  sourceIds: string[]
  history?: { role: 'user' | 'assistant'; content: string }[]
}

export async function streamAnswer(
  input: AnswerInput,
  options: { model?: LanguageModel; db?: Database; embedder?: Embedder } = {},
) {
  const db = options.db ?? getDb()
  const model = options.model ?? defaultModel()
  const embedder = options.embedder ?? createEmbedder()

  const notebook = await findNotebook(input.notebookId, input.ownerId, db)
  if (!notebook) {
    throw new ChatError('unknown-notebook', 'No such notebook for this account')
  }

  const chunks = await getContextChunks(
    {
      sourceIds: input.sourceIds,
      question: input.question,
      ownerId: input.ownerId,
      embedder,
    },
    db,
  )

  let prompt
  try {
    prompt = buildPrompt(input.question, chunks)
  } catch (error) {
    if (error instanceof NoContextError) {
      throw new ChatError(
        'no-sources',
        'Answering without sources would be answering from general knowledge',
      )
    }
    throw error
  }

  const messages: ModelMessage[] = [
    ...(input.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user' as const, content: prompt.user },
  ]

  await saveMessage(
    { 
      notebookId: input.notebookId, 
      role: 'user', 
      content: input.question 
    },
    db,
  )

  const citations = toCitations(prompt.chunks)

  const result = streamText({
    model,
    system: prompt.system,
    messages,
    onError: ({ error }) => {
      console.error('chat: the model failed', error)
    },
    onFinish: async ({ text }) => {
      if (!text.trim()) return
      await saveMessage(
        {
          notebookId: input.notebookId,
          role: 'assistant',
          content: text,
          citations: citationsIn(text, citations),
        },
        db,
      )
    },
  })

  return { result, prompt, citations }
}
