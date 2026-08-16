'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { readAudioOverview } from '@/lib/audio'
import { createArtifact, deleteArtifact, type ArtifactRow } from '@/lib/artifacts'
import {
  generateAudio,
  generateBriefing,
  generateFaq,
  generateFlashcards,
  generateMindmap,
  generateTimeline,
  NoDatesError,
  NoSourcesError,
} from '@/lib/artifact-generation'
import { modelFailureMessage } from '@/lib/chat'
import { artifactKinds, type ArtifactKind } from '@/lib/db/schema'
import { requireOwnerId } from '@/lib/session'
import { forget } from '@/lib/speech'

export type ArtifactState =
  | { ok: true; artifact: ArtifactRow }
  | { ok: false; error: string }

const Input = z.object({
  notebookId: z.uuid(),
  kind: z.enum(artifactKinds),
  sourceIds: z.array(z.uuid()).min(1).max(200),
})

const generators: Record<ArtifactKind, (input: { sourceIds: string[]; ownerId: string }) => Promise<{ title: string }>> = {
  audio: generateAudio,
  briefing: generateBriefing,
  faq: generateFaq,
  timeline: generateTimeline,
  flashcards: generateFlashcards,
  mindmap: generateMindmap,
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

  // The row cascades, the mp3 next to it does not.
  if (deleted.kind === 'audio') {
    const overview = readAudioOverview(deleted.content)
    if (overview) await forget(overview.pathname)
  }

  revalidatePath(`/notebook/${notebookId}`)
  return null
}
