import { audioOverviewMeta, readAudioOverview } from '@/features/artifacts/audio'
import { briefingMeta, readBriefing } from '@/features/artifacts/briefing'
import type { ArtifactKind } from '@/lib/db/schema'
import { faqMeta, readFaq } from '@/features/artifacts/faq'
import { flashcardsMeta, readFlashcards } from '@/features/artifacts/flashcards'
import { mindmapMeta, readMindmap } from '@/features/artifacts/mindmap'
import { readTimeline, timelineMeta } from '@/features/artifacts/timeline'

/**
 * What the kinds have in common, kept where the browser may read it.
 *
 * The studio lists artifacts of every kind and the reader labels the one it
 * shows, so both need a name and the line under it without knowing which
 * kind they hold.
 *
 * This is also where the split that runs through this folder is written
 * down, so it is not repeated in six places: every kind has a shape module
 * next to this one that declares its schema, reads stored json back and
 * counts what the studio shows, and nothing in those modules talks to a
 * model, to a storage or to a database. They are imported by the reader and
 * therefore end up in the browser bundle, where the AI SDK has no business
 * being. The writing happens in artifact-generation.ts, the speaking in
 * lib/speech.ts, and both stay on the server.
 */

export const artifactLabels: Record<ArtifactKind, string> = {
  audio: 'Audio-Übersicht',
  briefing: 'Briefing',
  faq: 'FAQ',
  timeline: 'Zeitleiste',
  flashcards: 'Lernkarten',
  mindmap: 'Mindmap',
}

/** Null when the stored json does not match the schema of its kind. */
export function artifactMeta(artifact: {
  kind: ArtifactKind
  content: unknown
}): string | null {
  switch (artifact.kind) {
    case 'audio': {
      const overview = readAudioOverview(artifact.content)
      return overview && audioOverviewMeta(overview)
    }
    case 'briefing': {
      const briefing = readBriefing(artifact.content)
      return briefing && briefingMeta(briefing)
    }
    case 'faq': {
      const faq = readFaq(artifact.content)
      return faq && faqMeta(faq)
    }
    case 'timeline': {
      const timeline = readTimeline(artifact.content)
      return timeline && timelineMeta(timeline)
    }
    case 'flashcards': {
      const flashcards = readFlashcards(artifact.content)
      return flashcards && flashcardsMeta(flashcards)
    }
    case 'mindmap': {
      const mindmap = readMindmap(artifact.content)
      return mindmap && mindmapMeta(mindmap)
    }
  }
}
