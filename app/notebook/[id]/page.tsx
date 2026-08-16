import { notFound } from 'next/navigation'
import { NotebookWorkspace } from '@/features/notebooks/components/notebook-workspace'
import { listArtifacts } from '@/features/artifacts/artifacts'
import { listMessages } from '@/features/chat/messages'
import { findNotebook } from '@/features/notebooks/notebooks'
import { requireSession } from '@/lib/session'
import { listSources } from '@/features/sources/sources'

export const dynamic = 'force-dynamic'

export default async function NotebookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()

  const notebook = await findNotebook(id, session.user.id)
  if (!notebook) notFound()

  const [sources, history, artifacts] = await Promise.all([
    listSources(notebook.id, session.user.id),
    listMessages(notebook.id, session.user.id),
    listArtifacts(notebook.id, session.user.id),
  ])

  return (
    <NotebookWorkspace
      notebook={notebook}
      sources={sources}
      history={history}
      artifacts={artifacts}
    />
  )
}
