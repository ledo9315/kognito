import { audioOverviewMeta, readAudioOverview } from '@/lib/audio'
import { briefingMeta, readBriefing } from '@/lib/briefing'
import type { ArtifactKind } from '@/lib/db/schema'
import { faqMeta, readFaq } from '@/lib/faq'
import { flashcardsMeta, readFlashcards } from '@/lib/flashcards'
import { mindmapMeta, readMindmap } from '@/lib/mindmap'
import { readTimeline, timelineMeta } from '@/lib/timeline'

/**
 * What the kinds have in common, kept where the browser may read it.
 *
 * The studio lists artifacts of every kind and the reader labels the one it
 * shows, so both need a name and the line under it without knowing which
 * kind they hold.
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
