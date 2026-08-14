'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createNote, deleteNote, updateNote } from '@/lib/notes'
import { requireOwnerId } from '@/lib/session'

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

  const created = await createNote({
    notebookId: id.data,
    ownerId: await requireOwnerId(),
    ...fields.data,
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

  const updated = await updateNote(noteId, await requireOwnerId(), fields.data)
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

  const deleted = await deleteNote(noteId, await requireOwnerId())
  if (!deleted) return unknownNote

  revalidatePath(`/notebook/${notebookId}`)
  return null
}
