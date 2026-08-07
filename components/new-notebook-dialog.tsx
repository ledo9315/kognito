'use client'

import * as React from 'react'
import { useNotebookStore } from '@/components/notebook-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function NewNotebookDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactElement
  onCreated?: (id: string) => void
}) {
  const { createNotebook } = useNotebookStore()
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const id = createNotebook(title.trim())
    setOpen(false)
    setTitle('')
    onCreated?.(id)
  }

  return (
    <>
      {React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Neues Notizbuch</DialogTitle>
              <DialogDescription>
                Gib deinem Notizbuch einen Namen. Quellen kannst du direkt danach
                hinzufügen.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="notebook-title">Titel</FieldLabel>
                <Input
                  id="notebook-title"
                  autoFocus
                  placeholder="z. B. Recherche Q4"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit">Erstellen</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
