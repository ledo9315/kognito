import { z } from 'zod'
import { findArtifact } from '@/lib/artifacts'
import { readAudioOverview } from '@/lib/audio'
import { getSession } from '@/lib/session'
import { presignAudio } from '@/lib/speech'

/**
 * The mp3 of an overview, for the owner of the notebook it belongs to.
 *
 * The file is private, so this is where being allowed to listen is decided:
 * session, then the artifact through the owner filter, then a url signed for
 * this pathname alone. The redirect hands the transfer to the blob host,
 * which is what makes seeking in a ten minute file work without a single
 * byte passing through here.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const session = await getSession()
  if (!session) return new Response(null, { status: 401 })

  const { artifactId } = await params
  if (!z.uuid().safeParse(artifactId).success) {
    return new Response(null, { status: 404 })
  }

  const artifact = await findArtifact(artifactId, session.user.id)
  if (!artifact || artifact.kind !== 'audio') {
    return new Response(null, { status: 404 })
  }

  const overview = readAudioOverview(artifact.content)
  if (!overview) return new Response(null, { status: 404 })

  return Response.redirect(await presignAudio(overview.pathname), 307)
}
