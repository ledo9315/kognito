'use client'

import { useState, type ComponentType } from 'react'
import {
  AudioLines,
  FileText,
  GitBranch,
  HelpCircle,
  Layers,
  ListOrdered,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/components/notebook-store'
import { AudioPlayer } from '@/components/audio-player'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import type { StudioArtifactKind } from '@/lib/data'

const generators: {
  kind: StudioArtifactKind
  label: string
  hint: string
  icon: ComponentType<{ className?: string }>
}[] = [
  {
    kind: 'audio',
    label: 'Audio-Übersicht',
    hint: 'Dialog zweier Sprecher',
    icon: AudioLines,
  },
  {
    kind: 'briefing',
    label: 'Briefing',
    hint: 'Strukturierte Zusammenfassung',
    icon: FileText,
  },
  { kind: 'faq', label: 'FAQ', hint: 'Fragen & Antworten', icon: HelpCircle },
  {
    kind: 'timeline',
    label: 'Zeitleiste',
    hint: 'Chronologie der Ereignisse',
    icon: ListOrdered,
  },
  {
    kind: 'mindmap',
    label: 'Mindmap',
    hint: 'Themen und Verzweigungen',
    icon: GitBranch,
  },
  {
    kind: 'flashcards',
    label: 'Lernkarten',
    hint: 'Abfrage zum Einprägen',
    icon: Layers,
  },
]

const artifactIcons: Record<
  StudioArtifactKind,
  ComponentType<{ className?: string }>
> = {
  audio: AudioLines,
  briefing: FileText,
  faq: HelpCircle,
  timeline: ListOrdered,
  mindmap: GitBranch,
  flashcards: Layers,
}

export function StudioPanel() {
  const { notebook, sources, artifacts, notes, generateArtifact, removeArtifact } =
    useNotebookStore()
  const [pending, setPending] = useState<StudioArtifactKind | null>(null)

  const selectedCount = sources.filter((source) => source.selected).length
  const audioArtifact = artifacts.find((artifact) => artifact.kind === 'audio')

  async function generate(kind: StudioArtifactKind) {
    if (selectedCount === 0) {
      toast.error('Keine Quelle ausgewählt', {
        description: 'Wähle mindestens eine Quelle aus.',
      })
      return
    }
    setPending(kind)
    const artifact = await generateArtifact(kind)
    setPending(null)
    toast.success(`${artifact.title} erstellt`, { description: artifact.meta })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Studio</h2>
      </header>

      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {audioArtifact ? (
          <AudioPlayer
            title={audioArtifact.title}
            meta={audioArtifact.meta}
            notebookTitle={notebook.title}
          />
        ) : pending === 'audio' ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        ) : null}

        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Erzeugen
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {generators.map(({ kind, label, hint, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => generate(kind)}
                disabled={pending !== null}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              >
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-[13px] leading-tight font-medium">
                  {pending === kind ? 'Wird erstellt…' : label}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ergebnisse
          </h3>

          {artifacts.length === 0 && notes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
              Noch nichts erstellt. Wähle oben ein Format, um aus deinen Quellen
              eine Zusammenfassung, Lernhilfe oder Audio-Übersicht zu erzeugen.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {artifacts.map((artifact) => {
                const Icon = artifactIcons[artifact.kind]
                return (
                  <Item key={artifact.id} variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <Icon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{artifact.title}</ItemTitle>
                      <ItemDescription>{artifact.meta}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeArtifact(artifact.id)}
                        aria-label={`${artifact.title} löschen`}
                      >
                        <Trash2 />
                      </Button>
                    </ItemActions>
                  </Item>
                )
              })}

              {notes.map((note) => (
                <Item key={note.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <FileText />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{note.title}</ItemTitle>
                    <ItemDescription className="line-clamp-2">
                      {note.body}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
