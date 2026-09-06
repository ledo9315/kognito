'use client'

import { useState } from 'react'
import type { StaticImageData } from 'next/image'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/features/notebooks/components/notebook-store'
import { MindmapView } from '@/features/artifacts/components/mindmap-view'
import { NotesSection } from '@/features/sources/components/notes-section'
import { IllustrationIcon } from '@/components/illustration-icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item'
import {
  deleteArtifactAction,
  generateArtifactAction,
} from '@/features/artifacts/artifact-actions'
import { artifactLabels, artifactMeta } from '@/features/artifacts/artifact-kinds'
import { cn } from '@/lib/utils'
import { readMindmap } from '@/features/artifacts/mindmap'
import type { ArtifactRow } from '@/features/artifacts/artifacts'
import type { ArtifactKind } from '@/lib/db/schema'
import audioIllustration from '@/public/audio-overview.png'
import briefingIllustration from '@/public/briefing.png'
import faqIllustration from '@/public/faq.png'
import timelineIllustration from '@/public/timeline.png'
import mindmapIllustration from '@/public/mindmap.png'
import flashcardsIllustration from '@/public/flashcards.png'

/** Soft 3D renders with their own glow, so they need no background. */
const artifactIllustrations: Record<ArtifactKind, StaticImageData> = {
  audio: audioIllustration,
  briefing: briefingIllustration,
  faq: faqIllustration,
  timeline: timelineIllustration,
  mindmap: mindmapIllustration,
  flashcards: flashcardsIllustration,
}

const generators: { kind: ArtifactKind; label: string; hint: string }[] = [
  {
    kind: 'audio',
    label: 'Audio-Übersicht',
    hint: 'Ein Erzähler über die Quellen',
  },
  {
    kind: 'briefing',
    label: 'Briefing',
    hint: 'Strukturierte Zusammenfassung',
  },
  { kind: 'faq', label: 'FAQ', hint: 'Fragen & Antworten' },
  {
    kind: 'timeline',
    label: 'Zeitleiste',
    hint: 'Chronologie der Ereignisse',
  },
  {
    kind: 'mindmap',
    label: 'Mindmap',
    hint: 'Themen und Verzweigungen',
  },
  {
    kind: 'flashcards',
    label: 'Lernkarten',
    hint: 'Abfrage zum Einprägen',
  },
]

function ArtifactIllustration({ kind }: { kind: ArtifactKind }) {
  return <IllustrationIcon src={artifactIllustrations[kind]} />
}

export function StudioPanel() {
  const { notebook, sources, artifacts, openArtifact } = useNotebookStore()
  const [pending, setPending] = useState<ArtifactKind | null>(null)
  const [openMindmap, setOpenMindmap] = useState<ArtifactRow | null>(null)

  const selected = sources.filter((source) => source.selected)
  const selectedCount = selected.length

  /**
   * A mindmap goes into a dialog, every other kind into the reader panel.
   *
   * Not a matter of taste: measured against mermaid, a map of 25 nodes comes
   * out 1099 pixels wide and the panel is 384. The dialog is the only place
   * in this layout with room for a drawing.
   */
  function show(artifact: ArtifactRow) {
    if (artifact.kind === 'mindmap') {
      setOpenMindmap(artifact)
      return
    }
    openArtifact(artifact.id)
  }

  async function generate(kind: ArtifactKind) {
    if (selectedCount === 0) {
      toast.error('Keine Quelle ausgewählt', {
        description: 'Wähle mindestens eine Quelle aus.',
      })
      return
    }

    setPending(kind)

    const result = await generateArtifactAction(
      notebook.id,
      kind,
      selected.map((source) => source.id),
    )

    setPending(null)

    if (!result.ok) {
      toast.error(`${artifactLabels[kind]} nicht erstellt`, {
        description: result.error,
      })
      return
    }

    show(result.artifact)
    toast.success(`${result.artifact.title} erstellt`)
  }

  async function remove(artifactId: string, title: string) {
    const result = await deleteArtifactAction(notebook.id, artifactId)
    if (result) {
      toast.error(result.error)
      return
    }
    toast.success(`„${title}“ gelöscht`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-13 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Studio</h2>
      </header>

      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Erzeugen
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {generators.map(({ kind, label, hint }) => {
              const busy = pending === kind
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => generate(kind)}
                  disabled={pending !== null}
                  aria-busy={busy}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-xl bg-indigo-100 p-3 text-left transition-colors hover:bg-indigo-200/70 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none',
                    // The card that is working stays lit, the others step back.
                    busy ? 'bg-indigo-200/70' : 'disabled:opacity-50',
                  )}
                >
                  {busy ? (
                    <span className="flex size-8 items-center justify-center">
                      <LoaderCircle
                        className="size-4 animate-spin text-primary"
                        aria-hidden="true"
                      />
                    </span>
                  ) : (
                    <ArtifactIllustration kind={kind} />
                  )}
                  <span className="text-[13px] leading-tight font-medium">
                    {busy ? 'Wird erstellt…' : label}
                  </span>
                  <span className="text-[11px] leading-tight text-gray-600">
                    {hint}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ergebnisse
          </h3>

          {artifacts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
              Noch nichts erstellt. Wähle oben ein Format, um aus deinen Quellen
              eine Zusammenfassung, Lernhilfe oder Audio-Übersicht zu erzeugen.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {artifacts.map((artifact) => {
                const meta = artifactMeta(artifact)
                return (
                  <Item
                    key={artifact.id}
                    size="sm"
                    // Same surface as the generator tiles above, so the
                    // results read as the output of those cards.
                    className="relative cursor-pointer rounded-xl bg-indigo-100 hover:bg-indigo-200/70 focus-within:ring-[3px] focus-within:ring-ring/40"
                  >
                    <ItemMedia>
                      <ArtifactIllustration kind={artifact.kind} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <button
                          type="button"
                          onClick={() => show(artifact)}
                          aria-label={`${artifact.title} öffnen`}
                          className="text-left after:absolute after:inset-0 focus-visible:outline-none"
                        >
                          {artifact.title}
                        </button>
                      </ItemTitle>
                      <ItemDescription>
                        {meta
                          ? `${artifactLabels[artifact.kind]} · ${meta}`
                          : 'Älteres Format, bitte neu erzeugen'}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="relative z-10">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void remove(artifact.id, artifact.title)}
                        aria-label={`${artifact.title} löschen`}
                      >
                        <Trash2 />
                      </Button>
                    </ItemActions>
                  </Item>
                )
              })}
            </div>
          )}
        </section>

        <Separator />

        <NotesSection />
      </div>

      <MindmapDialog
        artifact={openMindmap}
        onClose={() => setOpenMindmap(null)}
      />
    </div>
  )
}

/**
 * Nothing is mounted until a map is opened, so the mermaid import behind
 * `MindmapView` is not even reached on a notebook nobody opens one in.
 */
function MindmapDialog({
  artifact,
  onClose,
}: {
  artifact: ArtifactRow | null
  onClose: () => void
}) {
  const mindmap = artifact && readMindmap(artifact.content)

  return (
    <Dialog open={artifact !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{artifact?.title ?? 'Mindmap'}</DialogTitle>
          <DialogDescription>
            {mindmap
              ? artifactMeta({ kind: 'mindmap', content: mindmap })
              : 'Diese Mindmap wurde in einem älteren Format gespeichert.'}
          </DialogDescription>
        </DialogHeader>

        {mindmap ? <MindmapView mindmap={mindmap} /> : null}
      </DialogContent>
    </Dialog>
  )
}
