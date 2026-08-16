'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { maxPromptCharacters } from '@/lib/config'
import { suggestFollowUps } from '@/lib/follow-ups'
import { clearMessages } from '@/lib/messages'
import { requireOwnerId } from '@/lib/session'

/** "Neu starten" in the chat header. The history lives in the database, so
 * clearing it on the client alone would bring it back on the next reload. */
export async function clearChatAction(notebookId: string) {
  const parsed = z.uuid().safeParse(notebookId)
  if (!parsed.success) return

  await clearMessages(parsed.data, await requireOwnerId())
  revalidatePath(`/notebook/${parsed.data}`)
}

const Turn = z.object({
  question: z.string().trim().min(1).max(maxPromptCharacters),
  answer: z.string().trim().min(1).max(maxPromptCharacters),
})

/**
 * The three questions under the newest answer.
 *
 * Called from the browser once the answer has finished streaming, so the
 * suggestions arrive a moment after it and never hold it up. A session is
 * required: without one this would be an open door to the model.
 */
export async function suggestFollowUpsAction(question: string, answer: string) {
  const parsed = Turn.safeParse({ question, answer })
  if (!parsed.success) return []

  await requireOwnerId()

  return suggestFollowUps(parsed.data.question, parsed.data.answer)
}
