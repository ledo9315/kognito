'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  createNotebook,
  deleteNotebook,
  renameNotebook,
} from '@/lib/notebooks'
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

  const created = await createNotebook(await requireOwnerId(), parsed.data)

  redirect(`/notebook/${created.id}`)
}

export async function renameNotebookAction(
  notebookId: string,
  title: string,
): Promise<NotebookFormState> {
  const id = z.uuid().safeParse(notebookId)
  if (!id.success) return { error: 'Unbekanntes Notizbuch.' }

  const parsed = Title.safeParse(title)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const renamed = await renameNotebook(
    id.data,
    await requireOwnerId(),
    parsed.data,
  )
  if (!renamed) return { error: 'Unbekanntes Notizbuch.' }

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
