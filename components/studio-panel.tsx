'use client'

import { useState, type ComponentType } from 'react'
import {
  AudioLines,
  FileText,
  GitBranch,
  HelpCircle,
  Layers,
  ListOrdered,
  LoaderCircle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/components/notebook-store'
import { MindmapView } from '@/components/mindmap-view'
import { NotesSection } from '@/components/notes-section'
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
} from '@/lib/artifact-actions'
import { artifactLabels, artifactMeta } from '@/lib/artifact-kinds'
import { cn } from '@/lib/utils'
import { readMindmap } from '@/lib/mindmap'
import type { ArtifactRow } from '@/lib/artifacts'
import type { ArtifactKind } from '@/lib/db/schema'

const generators: {
  kind: ArtifactKind
  label: string
  hint: string
  icon: ComponentType<{ className?: string }>
}[] = [
  {
    kind: 'audio',
    label: 'Audio-Übersicht',
    hint: 'Ein Erzähler über die Quellen',
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
  ArtifactKind,
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
            {generators.map(({ kind, label, hint, icon: Icon }) => {
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
                  <span className="rounded-md bg-primary p-2 text-primary-foreground">
                    {busy ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Icon className="size-4" aria-hidden="true" />
                    )}
                  </span>
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
                const Icon = artifactIcons[artifact.kind]
                const meta = artifactMeta(artifact)
                return (
                  <Item
                    key={artifact.id}
                    variant="outline"
                    size="sm"
                    className="relative cursor-pointer hover:bg-accent/50 focus-within:ring-[3px] focus-within:ring-ring/40"
                  >
                    <ItemMedia variant="icon">
                      <Icon />
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
