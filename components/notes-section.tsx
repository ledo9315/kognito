'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/components/notebook-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import { Textarea } from '@/components/ui/textarea'
import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
} from '@/lib/note-actions'

/** Null id means a new note, an id means the existing one is being edited. */
type Draft = { id: string | null; title: string; body: string }

export function NotesSection() {
  const { notebook, notes } = useNotebookStore()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pending, startTransition] = useTransition()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return

    const fields = new FormData(event.currentTarget)
    const title = String(fields.get('title') ?? '')
    const body = String(fields.get('body') ?? '')
    const { id } = draft

    startTransition(async () => {
      // The action revalidates the page, so the list comes back from the
      // database. No optimistic copy that could drift away from it.
      const result = id
        ? await updateNoteAction(notebook.id, id, title, body)
        : await createNoteAction(notebook.id, title, body)

      // The dialog stays open on a failure, otherwise the text is gone.
      if (result) {
        toast.error(result.error)
        return
      }

      setDraft(null)
      toast.success(id ? 'Notiz gespeichert' : 'Notiz angelegt')
    })
  }

  function remove(noteId: string, title: string) {
    startTransition(async () => {
      const result = await deleteNoteAction(notebook.id, noteId)
      toast[result ? 'error' : 'success'](
        result ? result.error : `„${title}“ gelöscht`,
      )
    })
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Notizen
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft({ id: null, title: '', body: '' })}
        >
          <Plus data-icon="inline-start" />
          Neu
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
          Noch keine Notiz. Halte hier fest, was dir beim Lesen auffällt, oder
          speichere eine Antwort aus dem Chat.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <Item key={note.id} variant="outline" size="sm">
              <ItemMedia variant="icon">
                <NotebookPen />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{note.title}</ItemTitle>
                <ItemDescription className="line-clamp-2">
                  {note.content}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() =>
                    setDraft({
                      id: note.id,
                      title: note.title,
                      body: note.content ?? '',
                    })
                  }
                  aria-label={`${note.title} bearbeiten`}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => remove(note.id, note.title)}
                  aria-label={`${note.title} löschen`}
                >
                  <Trash2 />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={() => setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          {/* Keyed, so switching from one note to another really refills the
              fields instead of keeping the first defaultValue. */}
          <form
            key={draft?.id ?? 'new'}
            onSubmit={save}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>
                {draft?.id ? 'Notiz bearbeiten' : 'Neue Notiz'}
              </DialogTitle>
            </DialogHeader>

            <Input
              name="title"
              defaultValue={draft?.title}
              autoFocus
              aria-label="Titel der Notiz"
              placeholder="Titel"
            />
            <Textarea
              name="body"
              defaultValue={draft?.body}
              aria-label="Text der Notiz"
              placeholder="Text"
              rows={8}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setDraft(null)}
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
    </section>
  )
}
