'use client'

import { X } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { SourceIcon, sourceKindLabel } from '@/components/source-icon'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export function SourceReader() {
  const { sources, openSourceId, openSource } = useNotebookStore()
  const source = sources.find((candidate) => candidate.id === openSourceId)

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
            {source.url ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate underline"
                >
                  Original öffnen
                </a>
              </>
            ) : null}
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
        {source.summary ? (
          <>
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
          </>
        ) : null}

        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Quelltext
          </h3>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-pretty">
            {source.content}
          </p>
        </section>
      </div>
    </div>
  )
}
