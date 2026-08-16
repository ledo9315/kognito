'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { generatedKinds, type GeneratedKind } from '@/lib/artifact-kinds'
import { createArtifact, deleteArtifact, type ArtifactRow } from '@/lib/artifacts'
import {
  generateBriefing,
  generateFaq,
  generateFlashcards,
  generateTimeline,
  NoDatesError,
  NoSourcesError,
} from '@/lib/artifact-generation'
import { modelFailureMessage } from '@/lib/chat'
import { requireOwnerId } from '@/lib/session'

export type ArtifactState =
  | { ok: true; artifact: ArtifactRow }
  | { ok: false; error: string }

const Input = z.object({
  notebookId: z.uuid(),
  kind: z.enum(generatedKinds),
  sourceIds: z.array(z.uuid()).min(1).max(200),
})

const generators: Record<GeneratedKind, (input: { sourceIds: string[]; ownerId: string }) => Promise<{ title: string }>> = {
  briefing: generateBriefing,
  faq: generateFaq,
  timeline: generateTimeline,
  flashcards: generateFlashcards,
}

export async function generateArtifactAction(
  notebookId: string,
  kind: string,
  sourceIds: string[],
): Promise<ArtifactState> {

  const parsed = Input.safeParse({ notebookId, kind, sourceIds })

  if (!parsed.success) {
    return { ok: false, error: 'Wähle mindestens eine Quelle aus.' }
  }

  const ownerId = await requireOwnerId()

  let content

  try {
    content = await generators[parsed.data.kind]({
      sourceIds: parsed.data.sourceIds,
      ownerId,
    })
  } catch (error) {
    if (error instanceof NoSourcesError) {
      return {
        ok: false,
        error: 'Die ausgewählten Quellen enthalten keinen lesbaren Text.',
      }
    }

    // Nothing is stored in this case. An artifact whose whole content is
    // the sentence "there was nothing to find" is not worth a row.
    if (error instanceof NoDatesError) {
      return {
        ok: false,
        error: 'Die ausgewählten Quellen enthalten keine Datumsangaben.',
      }
    }

    // A model that refuses or times out is not a bug to crash on, it is a
    // sentence the user can act on.
    console.error('artifacts: generating failed', parsed.data.kind, error)
    return { ok: false, error: modelFailureMessage(error) }
  }

  const stored = await createArtifact({
    notebookId: parsed.data.notebookId,
    ownerId,
    kind: parsed.data.kind,
    title: content.title,
    content,
  })

  console.log('artifacts: generated', parsed.data.kind, stored)

  if (!stored) return { ok: false, error: 'Unbekanntes Notizbuch.' }

  revalidatePath(`/notebook/${parsed.data.notebookId}`)
  return { ok: true, artifact: stored }
}

export async function deleteArtifactAction(
  notebookId: string,
  artifactId: string,
): Promise<{ error: string } | null> {
  const ids = z.uuid().array().safeParse([notebookId, artifactId])
  if (!ids.success) return { error: 'Unbekanntes Artefakt.' }

  const deleted = await deleteArtifact(artifactId, await requireOwnerId())
  if (!deleted) return { error: 'Unbekanntes Artefakt.' }

  revalidatePath(`/notebook/${notebookId}`)
  return null
}
