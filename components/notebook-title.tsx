'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  deleteNotebookAction,
  renameNotebookAction,
} from '@/lib/notebook-actions'

export function NotebookTitle({
  notebookId,
  title,
  emoji,
}: {
  notebookId: string
  title: string
  emoji: string
}) {
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const [shown, setShown] = useState(title)

  function rename(next: string) {
    const wanted = next.trim()

    if (!wanted || wanted === shown) {
      setRenaming(false)
      return
    }

    const previous = shown
    setShown(wanted)
    setRenaming(false)

    startTransition(async () => {
      const result = await renameNotebookAction(notebookId, wanted)
      if (!result) return

      setShown(previous)
      toast.error(result.error)
    })
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span aria-hidden="true" className="shrink-0 text-base leading-none">
        {emoji}
      </span>

      {renaming ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const field = new FormData(event.currentTarget).get('title')
            rename(typeof field === 'string' ? field : '')
          }}
        >
          <Input
            name="title"
            defaultValue={shown}
            autoFocus
            aria-label="Titel des Notizbuchs"
            className="h-7 w-56 text-sm"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRenaming(false)
            }}
            onBlur={(event) => rename(event.target.value)}
          />
        </form>
      ) : (
        <h1 className="truncate text-sm font-medium">{shown}</h1>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label="Notizbuch bearbeiten"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notizbuch löschen?</DialogTitle>
            <DialogDescription>
              {`„${shown}“`} wird mit allen Quellen, Abschnitten und dem
              gesamten Chatverlauf gelöscht. Das lässt sich nicht rückgängig
              machen.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteNotebookAction(notebookId)
                  if (result) toast.error(result.error)
                })
              }
            >
              {pending ? 'Wird gelöscht…' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
