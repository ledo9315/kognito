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
  const [pending, startTransition] = useTransition()

  function action(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result: SourceFormState = await addSourceAction(formData)
      if (result) {
        setError(result.error)
        return
      }
      setOpen(false)
      toast.success('Quelle hinzugefügt', {
        description: 'Sie wird ab jetzt als Kontext für Antworten verwendet.',
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quellen hinzufügen</DialogTitle>
          <DialogDescription>
            Kognito nutzt ausschließlich die hier hinterlegten Quellen für
            Antworten.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
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
                  <Input
                    id="source-file"
                    name="file"
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  />
                </Field>
              </FieldGroup>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <UploadCloud className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                PDF, TXT oder MD, bis 10 MB. Ein PDF braucht eine Textebene, ein
                reiner Scan lässt sich nicht auslesen.
              </p>

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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
