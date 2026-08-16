'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  deleteNotebookAction,
  updateNotebookAction,
} from '@/features/notebooks/notebook-actions'
import { cn } from '@/lib/utils'

/**
 * Rename a notebook or delete it. The symbol is changed by clicking it, see
 * NotebookEmoji.
 *
 * Used on the overview card and in the header of the notebook itself, so both
 * places offer the same two things and ask the same question before the
 * deletion. Renders the trigger button and nothing else, the dialogs live in a
 * portal, so className positions the button inside a card.
 */
export function NotebookMenu({
  notebookId,
  title,
  emoji,
  className,
}: {
  notebookId: string
  title: string
  /** Carried along unchanged, the update writes title and symbol together. */
  emoji: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Every card on the overview renders one of these, so the fields of the
  // dialog cannot carry a fixed id.
  const fieldId = useId()

  function edit() {
    // The dialog opens on the title as it is stored, not on what a cancelled
    // attempt left behind.
    setError(null)
    setEditing(true)
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const wanted = new FormData(event.currentTarget).get('title')

    startTransition(async () => {
      const result = await updateNotebookAction(
        notebookId,
        typeof wanted === 'string' ? wanted : '',
        emoji,
      )
      if (result) {
        setError(result.error)
        return
      }

      setEditing(false)
      toast.success('Notizbuch gespeichert')
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteNotebookAction(notebookId)
      if (result) toast.error(result.error)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn('shrink-0', className)}
              aria-label={`${title} bearbeiten`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={edit}>
            <Pencil />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Notizbuch umbenennen</DialogTitle>
              <DialogDescription>
                Der Titel erscheint in der Übersicht und im Kopf des
                Notizbuchs.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${fieldId}-title`}>Titel</FieldLabel>
                <Input
                  id={`${fieldId}-title`}
                  name="title"
                  defaultValue={title}
                  autoFocus
                />
              </Field>
            </FieldGroup>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Wird gespeichert…' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notizbuch löschen?</DialogTitle>
            <DialogDescription>
              {`„${title}“`} wird mit allen Quellen, Abschnitten und dem
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
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {pending ? 'Wird gelöscht…' : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
