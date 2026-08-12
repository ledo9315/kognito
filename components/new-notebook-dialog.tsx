'use client'

import { useActionState, useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  createNotebookAction,
  type NotebookFormState,
} from '@/lib/notebook-actions'

export function NewNotebookDialog({ trigger }: { trigger: ReactElement }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<NotebookFormState, FormData>(
    createNotebookAction,
    null,
  )

  // The dialog is not closed here. The action redirects to the new notebook,
  // and closing early would show the empty overview for a moment first.
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent>
        <form action={action} className="flex flex-col gap-4">
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
                name="title"
                autoFocus
                placeholder="z. B. Recherche Q4"
              />
            </Field>
          </FieldGroup>

          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Wird angelegt…' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
