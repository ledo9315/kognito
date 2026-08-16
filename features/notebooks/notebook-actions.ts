'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  createNotebook,
  deleteNotebook,
  isEmoji,
  updateNotebook,
} from '@/features/notebooks/notebooks'
import { requireOwnerId } from '@/lib/session'

export type NotebookFormState = { error: string } | null

const Title = z
  .string()
  .trim()
  .min(1, 'Bitte gib einen Titel ein.')
  .max(120, 'Der Titel darf höchstens 120 Zeichen lang sein.')

export async function createNotebookAction(
  _state: NotebookFormState,
  formData: FormData,
): Promise<NotebookFormState> {
  const parsed = Title.safeParse(formData.get('title'))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // The picker in the dialog always sends one, the fallback covers a form
  // that reaches the server without it.
  const wanted = formData.get('emoji')
  const icon = typeof wanted === 'string' ? wanted.trim() : ''
  if (icon && !isEmoji(icon)) return { error: 'Bitte wähle ein einzelnes Emoji.' }

  const created = await createNotebook(
    await requireOwnerId(),
    parsed.data,
    undefined,
    icon || undefined,
  )

  redirect(`/notebook/${created.id}`)
}

export async function updateNotebookAction(
  notebookId: string,
  title: string,
  emoji: string,
): Promise<NotebookFormState> {
  const id = z.uuid().safeParse(notebookId)
  if (!id.success) return { error: 'Unbekanntes Notizbuch.' }

  const parsed = Title.safeParse(title)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const icon = emoji.trim()
  if (!isEmoji(icon)) return { error: 'Bitte wähle ein einzelnes Emoji.' }

  const updated = await updateNotebook(id.data, await requireOwnerId(), {
    title: parsed.data,
    emoji: icon,
  })
  if (!updated) return { error: 'Unbekanntes Notizbuch.' }

  revalidatePath('/')
  revalidatePath(`/notebook/${id.data}`)
  return null
}

export async function deleteNotebookAction(notebookId: string) {
  const id = z.uuid().safeParse(notebookId)
  if (!id.success) return { error: 'Unbekanntes Notizbuch.' }

  const deleted = await deleteNotebook(id.data, await requireOwnerId())
  if (!deleted) return { error: 'Unbekanntes Notizbuch.' }

  revalidatePath('/')
  redirect('/')
}
