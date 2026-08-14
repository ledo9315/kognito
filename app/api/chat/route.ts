import {
  createUIMessageStreamResponse,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from 'ai'
import { z } from 'zod'
import { ChatError, modelFailureMessage, streamAnswer } from '@/lib/chat'
import type { Citation } from '@/lib/db/schema'
import { getSession } from '@/lib/session'

type ChatMessage = UIMessage<{
  citations: Citation[]
  /** Passages that did not fit. Zero unless a source has no embeddings. */
  omitted: number
}>

/** A long answer over many sources can take a while. */
export const maxDuration = 60

const Body = z.object({
  notebookId: z.uuid(),
  sourceIds: z.array(z.uuid()).max(200),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        parts: z
          .array(z.object({ type: z.string(), text: z.string().optional() }))
          .optional(),
        content: z.string().optional(),
      }),
    )
    .min(1),
})

const messages: Record<ChatError['code'], string> = {
  'unknown-notebook': 'Unbekanntes Notizbuch.',
  'no-sources': 'Wähle mindestens eine Quelle aus. Ohne Quelle kann keine Antwort belegt werden.',
}

export async function POST(request: Request) {
  
  const session = await getSession()
  if (!session) return problem(401, 'Nicht angemeldet.')

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return problem(400, 'Ungültige Anfrage.')

const conversationMessages = parsed.data.messages
  .filter((message) => message.role !== 'system')
  .map((message) => ({
    role: message.role as 'user' | 'assistant',
    content: extractMessageText(message),
  }))
  .filter((message) => message.content !== '')

  const question = conversationMessages.at(-1)
  if (!question || question.role !== 'user') {
    return problem(400, 'Es fehlt eine Frage.')
  }

  try {
    const { result, citations, prompt } = await streamAnswer({
      notebookId: parsed.data.notebookId,
      ownerId: session.user.id,
      question: question.content,
      sourceIds: parsed.data.sourceIds,
      history: conversationMessages.slice(0, -1),
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream<ToolSet, ChatMessage>({
        stream: result.stream,
        onError: (error) =>
          JSON.stringify({ error: modelFailureMessage(error) }),
        messageMetadata: ({ part }) =>
          part.type === 'start'
            ? { citations, omitted: prompt.omitted }
            : undefined,
      }),
    })
  } catch (error) {
    if (error instanceof ChatError) return problem(400, messages[error.code])
    throw error
  }
}

function extractMessageText(message: {
  parts?: { type: string; text?: string }[]
  content?: string
}) {
  if (message.content) return message.content.trim()

  return (message.parts ?? [])
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('')
    .trim()
}

function problem(status: number, message: string) {
  return Response.json({ error: message }, { status })
}
