'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createNotebook } from '@/lib/notebooks'
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
