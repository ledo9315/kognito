import { NotebookEmoji } from '@/components/notebook-emoji'
import { NotebookMenu } from '@/components/notebook-menu'

export function NotebookTitle({
  notebookId,
  title,
  emoji,
}: {
  notebookId: string
  title: string
  emoji: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <NotebookEmoji
        notebookId={notebookId}
        title={title}
        emoji={emoji}
        className="size-7 shrink-0 text-base"
      />
      <h1 className="truncate text-sm font-medium">{title}</h1>
      <NotebookMenu notebookId={notebookId} title={title} emoji={emoji} />
    </div>
  )
}
