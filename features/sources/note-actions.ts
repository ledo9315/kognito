'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createEmbedder } from '@/lib/embeddings'
import { requireOwnerId } from '@/lib/session'
import { createSource, deleteSource, replaceSourceText } from '@/features/sources/sources'

/**
 * A note is a source of kind `note`, written in the app instead of uploaded.
 * That is what makes it answerable in the chat: selection, chunking, search
 * and citations all come from the source it already is.
 */

export type NoteFormState = { error: string } | null

const Title = z
  .string()
  .trim()
  .min(1, 'Bitte gib einen Titel ein.')
  .max(200, 'Der Titel darf höchstens 200 Zeichen lang sein.')

const Body = z
  .string()
  .trim()
  .min(1, 'Bitte gib einen Text ein.')
  .max(20_000, 'Die Notiz darf höchstens 20.000 Zeichen lang sein.')

const Fields = z.object({ title: Title, body: Body })

const unknownNote = { error: 'Unbekannte Notiz.' }

export async function createNoteAction(
  notebookId: string,
  title: string,
  body: string,
): Promise<NoteFormState> {
  const id = z.uuid().safeParse(notebookId)
  if (!id.success) return { error: 'Unbekanntes Notizbuch.' }

  const fields = Fields.safeParse({ title, body })
  if (!fields.success) return { error: fields.error.issues[0].message }

  const created = await createSource({
    notebookId: id.data,
    ownerId: await requireOwnerId(),
    title: fields.data.title,
    kind: 'note',
    text: fields.data.body,
    embedder: createEmbedder(),
  })
  if (!created) return { error: 'Unbekanntes Notizbuch.' }

  revalidatePath(`/notebook/${id.data}`)
  return null
}

export async function updateNoteAction(
  notebookId: string,
  noteId: string,
  title: string,
  body: string,
): Promise<NoteFormState> {
  const ids = z.uuid().array().safeParse([notebookId, noteId])
  if (!ids.success) return unknownNote

  const fields = Fields.safeParse({ title, body })
  if (!fields.success) return { error: fields.error.issues[0].message }

  // Rewrites the chunks as well, so the next question reads the new text
  // and a citation does not point into a passage that is gone.
  const updated = await replaceSourceText(noteId, await requireOwnerId(), {
    title: fields.data.title,
    text: fields.data.body,
    embedder: createEmbedder(),
  })
  if (!updated) return unknownNote

  revalidatePath(`/notebook/${notebookId}`)
  return null
}

export async function deleteNoteAction(
  notebookId: string,
  noteId: string,
): Promise<NoteFormState> {
  const ids = z.uuid().array().safeParse([notebookId, noteId])
  if (!ids.success) return unknownNote

  const deleted = await deleteSource(noteId, await requireOwnerId())
  if (!deleted) return unknownNote

  revalidatePath(`/notebook/${notebookId}`)
  return null
}
