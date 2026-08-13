'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
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
