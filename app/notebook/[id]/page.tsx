import { notFound } from 'next/navigation'
import { NotebookWorkspace } from '@/components/notebook-workspace'
import { listMessages } from '@/lib/messages'
import { findNotebook } from '@/lib/notebooks'
import { requireSession } from '@/lib/session'
import { listSources } from '@/lib/sources'

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

  const [sources, history] = await Promise.all([
    listSources(notebook.id, session.user.id),
    listMessages(notebook.id, session.user.id),
  ])

  return (
    <NotebookWorkspace notebook={notebook} sources={sources} history={history} />
  )
}
