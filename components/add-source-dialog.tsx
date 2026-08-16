'use client'

import { useState, useTransition, type ReactElement } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { addSourceAction, type SourceFormState } from '@/lib/source-actions'
import { cn } from '@/lib/utils'

export function AddSourceDialog({
  notebookId,
  trigger,
}: {
  notebookId: string
  trigger: ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('upload')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [overDropZone, setOverDropZone] = useState(false)
  const [pending, startTransition] = useTransition()

  function close() {
    setOpen(false)
    setFileName(null)
  }

  function action(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result: SourceFormState = await addSourceAction(formData)
      if (result) {
        setError(result.error)
        return
      }
      close()
      toast.success('Quelle hinzugefügt', {
        description: 'Sie wird ab jetzt als Kontext für Antworten verwendet.',
      })
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quellen hinzufügen</DialogTitle>
          <DialogDescription>
            Kognito nutzt ausschließlich die hier hinterlegten Quellen für
            Antworten.
          </DialogDescription>
        </DialogHeader>

        {/* The three panels are of different height, and the dialog would
            resize on every tab change. The floor is the tallest of them, the
            upload panel with its hint. */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as string)}
          className="[&>[data-slot=tabs-content]]:min-h-56"
        >
          <TabsList className="w-full">
            <TabsTrigger value="upload">Datei</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="paste">Text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="pt-2">
            <form action={action} className="flex flex-col gap-4">
              <input type="hidden" name="notebookId" value={notebookId} />
              <input type="hidden" name="mode" value="file" />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="source-file">Datei auswählen</FieldLabel>
                  {/* The input carries the file, the label is what one sees.
                      Dropping writes the file into the input, so the form
                      submits a drop and a pick the same way. */}
                  <Input
                    id="source-file"
                    name="file"
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                    className="peer sr-only"
                    onChange={(event) =>
                      setFileName(event.target.files?.[0]?.name ?? null)
                    }
                  />
                  <label
                    htmlFor="source-file"
                    onDragOver={(event) => {
                      event.preventDefault()
                      setOverDropZone(true)
                    }}
                    onDragLeave={() => setOverDropZone(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setOverDropZone(false)
                      const input = event.currentTarget.control
                      if (!(input instanceof HTMLInputElement)) return
                      input.files = event.dataTransfer.files
                      setFileName(event.dataTransfer.files[0]?.name ?? null)
                    }}
                    className={cn(
                      // Children do not take the pointer, otherwise dragging
                      // across them reads as leaving the zone.
                      'flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-input px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-accent/40 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 [&_*]:pointer-events-none',
                      overDropZone && 'border-primary bg-accent',
                    )}
                  >
                    <UploadCloud className="size-5 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">
                      {fileName ?? 'Datei hierher ziehen oder auswählen'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PDF, TXT oder MD, bis 10 MB. Ein PDF braucht eine
                      Textebene, ein reiner Scan lässt sich nicht auslesen.
                    </span>
                  </label>
                </Field>
              </FieldGroup>

              <Button type="submit" disabled={pending}>
                {pending ? 'Wird gelesen…' : 'Hochladen'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="link" className="pt-2">
            <form action={action} className="flex flex-col gap-4">
              <input type="hidden" name="notebookId" value={notebookId} />
              <input type="hidden" name="mode" value="link" />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="source-url">Website-Adresse</FieldLabel>
                  <Input
                    id="source-url"
                    name="url"
                    type="url"
                    placeholder="https://…"
                  />
                </Field>
              </FieldGroup>

              <Button type="submit" disabled={pending}>
                {pending ? 'Wird gelesen…' : 'Link importieren'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="paste" className="pt-2">
            <form action={action} className="flex flex-col gap-4">
              <input type="hidden" name="notebookId" value={notebookId} />
              <input type="hidden" name="mode" value="text" />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="source-text">Text einfügen</FieldLabel>
                  <Textarea
                    id="source-text"
                    name="text"
                    rows={6}
                    className="max-h-64 overflow-y-auto"
                    placeholder="Notizen, Auszüge oder Transkripte…"
                  />
                </Field>
              </FieldGroup>

              <Button type="submit" disabled={pending}>
                {pending ? 'Wird gelesen…' : 'Text hinzufügen'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
