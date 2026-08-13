'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SourceKind } from '@/lib/db/schema'
import {
  ExtractionError,
  extractFromFile,
  extractFromUrl,
  type Extraction,
} from '@/lib/extract'
import { requireOwnerId } from '@/lib/session'
import {
  createSource,
  deleteSource,
  setAllSourcesSelected,
  setSourceSelected,
} from '@/lib/sources'
import { isYoutubeUrl, sourceHostLabel } from '@/lib/source-url'

export type SourceFormState = { error: string } | null

const maxFileBytes = 10_000_000

const messages: Record<string, string> = {
  'empty': 'Diese Quelle enthält keinen Text.',
  'no-text-layer':'Dieses PDF besteht aus Bildern und enthält keinen auslesbaren Text.',
  'unsupported': 'Dieser Dateityp wird nicht unterstützt. Möglich sind PDF, TXT und MD.',
  'unreachable': 'Die Adresse war nicht erreichbar.',
  'too-large': 'Diese Quelle ist zu groß.',
  'blocked': 'Diese Adresse darf nicht abgerufen werden.',
}

export async function addSourceAction(
  formData: FormData,
): Promise<SourceFormState> {

  const notebookId = z.uuid().safeParse(formData.get('notebookId'))
  if (!notebookId.success) return { error: 'Unbekanntes Notizbuch.' }

  const mode = z.enum(['file', 'link', 'text']).safeParse(formData.get('mode'))
  if (!mode.success) return { error: 'Unbekannte Quellenart.' }

  const ownerId = await requireOwnerId()

  let extraction: Extraction
  let kind: SourceKind
  let title: string
  let url: string | undefined

  try {
    switch (mode.data) {

      case 'file': {
        const file = formData.get('file')

        if (!(file instanceof File) || file.size === 0) {
          return { error: 'Bitte wähle eine Datei aus.' }
        }

        if (file.size > maxFileBytes) {
          return { error: 'Die Datei ist größer als 10 MB.' }
        }

        extraction = await extractFromFile(file)
        kind = file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text'
        title = file.name.replace(/\.[^.]+$/, '')
        break
      }

      case 'link': {
        const parsed = z.url().safeParse(formData.get('url'))
        
        if (!parsed.success) {
          return { error: 'Bitte gib eine gültige Adresse ein.' }
        }

        if (isYoutubeUrl(parsed.data)) {
          return { error: 'YouTube-Transkripte werden noch nicht unterstützt.' }
        }

        extraction = await extractFromUrl(parsed.data)
        kind = 'web'
        url = parsed.data
        title = extraction.title ?? sourceHostLabel(parsed.data)
        break
      }

      case 'text': {
        const parsed = z
          .string()
          .trim()
          .min(1, 'Bitte füge einen Text ein.')
          .safeParse(formData.get('text'))

        if (!parsed.success) return { error: parsed.error.issues[0].message }

        extraction = { title: null, text: parsed.data }
        kind = 'text'
        title = firstLine(parsed.data)
        break
      }
    }
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { error: messages[error.code] ?? 'Diese Quelle konnte nicht gelesen werden.' }
    }
    throw error
  }

  const created = await createSource({
    notebookId: notebookId.data,
    ownerId,
    title: title.slice(0, 200),
    kind,
    text: extraction.text,
    url,
  })

  if (!created) return { error: 'Unbekanntes Notizbuch.' }

  revalidatePath(`/notebook/${notebookId.data}`)
  return null
}

export async function deleteSourceAction(formData: FormData) {
  const sourceId = z.uuid().safeParse(formData.get('sourceId'))
  const notebookId = z.uuid().safeParse(formData.get('notebookId'))
  if (!sourceId.success || !notebookId.success) return

  await deleteSource(sourceId.data, await requireOwnerId())
  revalidatePath(`/notebook/${notebookId.data}`)
}

/**
 * Both selection actions deliberately skip `revalidatePath`. The browser
 * already shows the new state, and re-rendering the whole notebook page on
 * every click would drag the chat history along for nothing.
 */
export async function selectSourceAction(sourceId: string, selected: boolean) {
  const parsed = z.uuid().safeParse(sourceId)
  if (!parsed.success) return false

  return setSourceSelected(parsed.data, await requireOwnerId(), selected)
}

export async function selectAllSourcesAction(
  notebookId: string,
  selected: boolean,
) {
  const parsed = z.uuid().safeParse(notebookId)
  if (!parsed.success) return false

  return setAllSourcesSelected(parsed.data, await requireOwnerId(), selected)
}

function firstLine(text: string) {
  const line = text.split('\n', 1)[0].trim()
  return line.length > 60 ? `${line.slice(0, 60)}…` : line || 'Eingefügter Text'
}
