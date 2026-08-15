'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createArtifact, deleteArtifact, type ArtifactRow } from '@/lib/artifacts'
import { generateBriefing, NoSourcesError } from '@/lib/artifact-generation'
import { modelFailureMessage } from '@/lib/chat'
import { requireOwnerId } from '@/lib/session'

export type ArtifactState =
  | { ok: true; artifact: ArtifactRow }
  | { ok: false; error: string }

const Input = z.object({
  notebookId: z.uuid(),
  sourceIds: z.array(z.uuid()).min(1).max(200),
})

export async function generateBriefingAction(
  notebookId: string,
  sourceIds: string[],
): Promise<ArtifactState> {

  const parsed = Input.safeParse({ notebookId, sourceIds })

  if (!parsed.success) {
    return { ok: false, error: 'Wähle mindestens eine Quelle aus.' }
  }

  const ownerId = await requireOwnerId()

  let briefing

  try {
    briefing = await generateBriefing({ sourceIds: parsed.data.sourceIds, ownerId })
  } catch (error) {
    if (error instanceof NoSourcesError) {
      return {
        ok: false,
        error: 'Die ausgewählten Quellen enthalten keinen lesbaren Text.',
      }
    }
    // A model that refuses or times out is not a bug to crash on, it is a
    // sentence the user can act on.
    console.error('artifacts: generating the briefing failed', error)
    return { ok: false, error: modelFailureMessage(error) }
  }

  console.log('artifacts: generated briefing', briefing);

  const stored = await createArtifact({
    notebookId: parsed.data.notebookId,
    ownerId,
    kind: 'briefing',
    title: briefing.title,
    content: briefing,
  })
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
