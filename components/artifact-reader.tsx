'use client'

import { useState, type ComponentType } from 'react'
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  HelpCircle,
  Layers,
  ListOrdered,
  X,
} from 'lucide-react'
import { AudioPlayer } from '@/components/audio-player'
import { useNotebookStore } from '@/components/notebook-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { artifactLabels, artifactMeta } from '@/lib/artifact-kinds'
import { readAudioOverview } from '@/lib/audio'
import { readBriefing, type Briefing } from '@/lib/briefing'
import { readFaq, type Faq } from '@/lib/faq'
import { readFlashcards, type Flashcards } from '@/lib/flashcards'
import { readTimeline, type Timeline } from '@/lib/timeline'
import type { ArtifactRow } from '@/lib/artifacts'

type ArtifactIcon = ComponentType<{ className?: string }>
type ArtifactIcons = Record<ArtifactRow['kind'], ArtifactIcon>

const icons = {
  audio: AudioLines,
  briefing: FileText,
  faq: HelpCircle,
  timeline: ListOrdered,
  flashcards: Layers,
  mindmap: GitBranch,
} satisfies ArtifactIcons

export function ArtifactReader() {
  const { artifacts, openArtifactId, openArtifact } = useNotebookStore()
  const artifact = artifacts.find((candidate) => candidate.id === openArtifactId)

  if (!artifact) return null

  const label = artifactLabels[artifact.kind]
  const meta = artifactMeta(artifact)
  const Icon = icons[artifact.kind]

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
  switch (artifact.kind) {
    case 'audio': {
      const overview = readAudioOverview(artifact.content)
      return overview ? (
        <>
          <GeneratedHeading>Gesprochene Übersicht</GeneratedHeading>
          {/* Keyed by artifact, so the next overview starts at its first
              section instead of wherever the last one was left. */}
          <AudioPlayer
            key={artifact.id}
            artifactId={artifact.id}
            overview={overview}
          />
        </>
      ) : (
        <Unreadable />
      )
    }
    case 'briefing': {
      const briefing = readBriefing(artifact.content)
      return briefing ? <BriefingBody briefing={briefing} /> : <Unreadable />
    }
    case 'faq': {
      const faq = readFaq(artifact.content)
      return faq ? <FaqBody faq={faq} /> : <Unreadable />
    }
    case 'timeline': {
      const timeline = readTimeline(artifact.content)
      return timeline ? <TimelineBody timeline={timeline} /> : <Unreadable />
    }
    case 'flashcards': {
      const flashcards = readFlashcards(artifact.content)
      return flashcards ? (
        // Keyed by artifact, so opening the next set starts at its first
        // card instead of wherever the last one was left.
        <FlashcardsBody key={artifact.id} flashcards={flashcards} />
      ) : (
        <Unreadable />
      )
    }
    // A mindmap does not fit a panel this narrow and opens in a dialog from
    // the studio instead, see components/studio-panel.tsx. Listed here so the
    // switch stays exhaustive and a sixth kind is a type error.
    case 'mindmap':
      return null
  }
}

function Unreadable() {
  return (
    <p role="alert" className="text-[13px] leading-relaxed text-muted-foreground">
      Dieses Artefakt wurde in einem älteren Format gespeichert und kann nicht
      mehr angezeigt werden. Erzeuge es neu.
    </p>
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

/**
 * One card at a time, turned over by the reader.
 *
 * A disclosure and not a css flip: the answer is a second element that the
 * button shows, so a screen reader is told what the click did and the whole
 * thing works from the keyboard without any of it being written here.
 */
function FlashcardsBody({ flashcards }: { flashcards: Flashcards }) {
  const [at, setAt] = useState(0)
  const [turned, setTurned] = useState(false)
  const card = flashcards.cards[at]

  // Wraps around, because going through a set twice is the point of it.
  function move(step: number) {
    setAt((current) => (current + step + flashcards.cards.length) % flashcards.cards.length)
    setTurned(false)
  }

  return (
    <>
      <GeneratedHeading>Lernkarten</GeneratedHeading>

      <div className="flex min-h-44 flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Frage
        </span>
        <p className="text-[13px] leading-relaxed text-pretty">{card.front}</p>

        <div className="mt-auto flex flex-col gap-3">
          <p
            id="flashcard-answer"
            hidden={!turned}
            className="border-t border-border pt-3 text-[13px] leading-relaxed text-pretty text-muted-foreground"
          >
            {card.back}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            aria-expanded={turned}
            aria-controls="flashcard-answer"
            onClick={() => setTurned((shown) => !shown)}
          >
            {turned ? 'Karte zurückdrehen' : 'Karte umdrehen'}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => move(-1)}
          aria-label="Vorherige Karte"
        >
          <ChevronLeft />
          Zurück
        </Button>
        <span aria-live="polite" className="text-[11px] text-muted-foreground">
          Karte {at + 1} von {flashcards.cards.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => move(1)}
          aria-label="Nächste Karte"
        >
          Weiter
          <ChevronRight />
        </Button>
      </div>
    </>
  )
}

function TimelineBody({ timeline }: { timeline: Timeline }) {
  return (
    <>
      <GeneratedHeading>Chronologie</GeneratedHeading>

      <ol className="flex flex-col">
        {timeline.entries.map((entry, index) => (
          <li key={index} className="flex gap-3">
            {/* The line runs between the dots, so it belongs to the column,
                not to the entry. The last one ends without it. */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
              />
              {index < timeline.entries.length - 1 ? (
                <span aria-hidden="true" className="w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5 pb-4">
              <span className="text-[11px] font-medium text-muted-foreground">
                {entry.when}
              </span>
              <span className="text-[13px] leading-relaxed text-pretty">
                {entry.event}
              </span>
            </div>
          </li>
        ))}
      </ol>
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
