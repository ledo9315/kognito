'use client'

import { useState, type ReactElement } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/components/notebook-store'
import { SourceIcon, sourceKindLabel } from '@/components/source-icon'
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
import type { SourceKind } from '@/lib/data'
import { cn } from '@/lib/utils'

const uploadKinds: SourceKind[] = ['pdf', 'doc', 'audio']

export function AddSourceDialog({
  notebookId,
  trigger,
}: {
  notebookId: string
  trigger: ReactElement
}) {
  const { addSource } = useNotebookStore()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('upload')
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')

  function commit(title: string, kind: SourceKind, meta: string) {
    addSource(notebookId, { title, kind, meta })
    setOpen(false)
    setUrl('')
    setPasted('')
    toast.success('Quelle hinzugefügt', {
      description: 'Sie wird ab jetzt als Kontext für Antworten verwendet.',
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
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <UploadCloud className="size-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium">
                  Dateien hierher ziehen
                </span>
                <span className="text-xs text-muted-foreground">
                  PDF, DOCX, TXT, MP3 · max. 200 MB
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                Im Prototyp simuliert. Wähle einen Beispieltyp:
              </p>

              <div className="grid grid-cols-3 gap-2">
                {uploadKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      commit(
                        `Neue ${sourceKindLabel[kind]}-Quelle`,
                        kind,
                        `${sourceKindLabel[kind]} · gerade hochgeladen`,
                      )
                    }
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border border-border px-3 py-3 text-xs transition-colors',
                      'hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                    )}
                  >
                    <span className="[&_svg]:size-4">
                      <SourceIcon kind={kind} />
                    </span>
                    {sourceKindLabel[kind]}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="link" className="pt-2">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!url.trim()) return
                const isVideo = /youtu\.?be/.test(url)
                const host = safeHost(url)
                commit(
                  isVideo ? `YouTube-Video · ${host}` : host,
                  isVideo ? 'youtube' : 'web',
                  isVideo ? 'YouTube · Transkript' : `Website · ${host}`,
                )
              }}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="source-url">
                    Website- oder YouTube-URL
                  </FieldLabel>
                  <Input
                    id="source-url"
                    type="url"
                    placeholder="https://…"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={!url.trim()}>
                Link importieren
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="paste" className="pt-2">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!pasted.trim()) return
                const words = pasted.trim().split(/\s+/).length
                commit(
                  pasted.trim().slice(0, 48) || 'Eingefügter Text',
                  'text',
                  `Text · ${words} Wörter`,
                )
              }}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="source-text">Text einfügen</FieldLabel>
                  <Textarea
                    id="source-text"
                    rows={6}
                    placeholder="Notizen, Auszüge oder Transkripte…"
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={!pasted.trim()}>
                Text hinzufügen
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function safeHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value.slice(0, 40)
  }
}
