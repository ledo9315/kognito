'use client'

import { FileText, HelpCircle, X } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { artifactLabels, artifactMeta } from '@/lib/artifact-kinds'
import { readBriefing, type Briefing } from '@/lib/briefing'
import { readFaq, type Faq } from '@/lib/faq'
import type { ArtifactRow } from '@/lib/artifacts'

export function ArtifactReader() {
  const { artifacts, openArtifactId, openArtifact } = useNotebookStore()
  const artifact = artifacts.find((candidate) => candidate.id === openArtifactId)

  if (!artifact) return null

  const label = artifactLabels[artifact.kind]
  const meta = artifactMeta(artifact)
  const Icon = artifact.kind === 'faq' ? HelpCircle : FileText

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon aria-hidden="true" className="size-3" />
            {label}
            {meta ? (
              <>
                <span aria-hidden="true">·</span>
                {meta}
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
          aria-label={`${label} schließen`}
        >
          <X />
        </Button>
      </header>

      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <Body artifact={artifact} />
      </div>
    </div>
  )
}

/** Each kind reads its own content, and says so when it cannot. */
function Body({ artifact }: { artifact: ArtifactRow }) {
  const content =
    artifact.kind === 'faq'
      ? readFaq(artifact.content)
      : artifact.kind === 'briefing'
        ? readBriefing(artifact.content)
        : null

  if (content === null) {
    return (
      <p role="alert" className="text-[13px] leading-relaxed text-muted-foreground">
        Dieses Artefakt wurde in einem älteren Format gespeichert und kann nicht
        mehr angezeigt werden. Erzeuge es neu.
      </p>
    )
  }

  return 'entries' in content ? (
    <FaqBody faq={content} />
  ) : (
    <BriefingBody briefing={content} />
  )
}

function GeneratedHeading({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {children}
      </h3>
      <Badge variant="secondary" className="font-normal">
        KI-generiert
      </Badge>
    </div>
  )
}

function FaqBody({ faq }: { faq: Faq }) {
  return (
    <>
      <GeneratedHeading>Fragen und Antworten</GeneratedHeading>

      <dl className="flex flex-col gap-4">
        {faq.entries.map((entry, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <dt className="text-[13px] leading-snug font-medium text-pretty">
              {entry.question}
            </dt>
            <dd className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
              {entry.answer}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function BriefingBody({ briefing }: { briefing: Briefing }) {
  return (
    <>
      <section className="flex flex-col gap-2">
        <GeneratedHeading>Kurzfassung</GeneratedHeading>
        <p className="text-[13px] leading-relaxed text-pretty">{briefing.summary}</p>
      </section>

      <Separator />

      {briefing.sections.map((section, index) => (
        <section key={index} className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-pretty">{section.heading}</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-4">
            {section.points.map((point, position) => (
              <li key={position} className="text-[13px] leading-relaxed text-pretty">
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
                <li key={index} className="text-[13px] leading-relaxed text-pretty">
                  {question}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </>
  )
}
