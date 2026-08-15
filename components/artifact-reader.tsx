'use client'

import { FileText, X } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { briefingMeta, readBriefing } from '@/lib/briefing'

export function ArtifactReader() {
  const { artifacts, openArtifactId, openArtifact } = useNotebookStore()
  const artifact = artifacts.find((candidate) => candidate.id === openArtifactId)

  if (!artifact) return null

  const briefing = readBriefing(artifact.content)

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText aria-hidden="true" className="size-3" />
            Briefing
            {briefing ? (
              <>
                <span aria-hidden="true">·</span>
                {briefingMeta(briefing)}
              </>
            ) : null}
          </span>
          <h2 className="text-sm leading-snug font-medium text-pretty">
            {artifact.title}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openArtifact(null)}
          aria-label="Briefing schließen"
        >
          <X />
        </Button>
      </header>

      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {briefing === null ? (
          <p role="alert" className="text-[13px] leading-relaxed text-muted-foreground">
            Dieses Briefing wurde in einem älteren Format gespeichert und kann
            nicht mehr angezeigt werden. Erzeuge es neu.
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Kurzfassung
                </h3>
                <Badge variant="secondary" className="font-normal">
                  KI-generiert
                </Badge>
              </div>
              <p className="text-[13px] leading-relaxed text-pretty">
                {briefing.summary}
              </p>
            </section>

            <Separator />

            {briefing.sections.map((section, index) => (
              <section key={index} className="flex flex-col gap-2">
                <h3 className="text-[13px] font-medium text-pretty">
                  {section.heading}
                </h3>
                <ul className="flex list-disc flex-col gap-1.5 pl-4">
                  {section.points.map((point, position) => (
                    <li
                      key={position}
                      className="text-[13px] leading-relaxed text-pretty"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {briefing.openQuestions.length > 0 ? (
              <>
                <Separator />
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Offene Fragen
                  </h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-4">
                    {briefing.openQuestions.map((question, index) => (
                      <li
                        key={index}
                        className="text-[13px] leading-relaxed text-pretty"
                      >
                        {question}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
