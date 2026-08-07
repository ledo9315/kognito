'use client'

import { X } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { SourceIcon, sourceKindLabel } from '@/components/source-icon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Notebook } from '@/lib/data'

export function SourceReader({ notebook }: { notebook: Notebook }) {
  const { state, openSource } = useNotebookStore()
  const source = notebook.sources.find(
    (candidate) => candidate.id === state.openSourceId,
  )

  if (!source) return null

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="[&_svg]:size-3">
              <SourceIcon kind={source.kind} />
            </span>
            {sourceKindLabel[source.kind]}
            <span aria-hidden="true">·</span>
            {source.meta}
          </span>
          <h2 className="text-sm leading-snug font-medium text-pretty">
            {source.title}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openSource(null)}
          aria-label="Quelle schließen"
        >
          <X />
        </Button>
      </header>

      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Zusammenfassung
            </h3>
            <Badge variant="secondary" className="font-normal">
              KI-generiert
            </Badge>
          </div>
          <p className="text-[13px] leading-relaxed text-pretty">
            {source.summary}
          </p>
        </section>

        <Separator />

        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Belegstellen
          </h3>
          <ul className="flex flex-col gap-2.5">
            {source.excerpts.map((excerpt, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-lg border-l-2 border-primary/40 bg-muted/60 px-3 py-2.5"
              >
                <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {index + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-pretty">
                  {excerpt}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="rounded-lg bg-muted px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Im Prototyp wird nur ein Auszug dargestellt. In der Vollversion siehst
          du hier das vollständige Dokument mit hervorgehobenen Belegstellen.
        </p>
      </div>
    </div>
  )
}
