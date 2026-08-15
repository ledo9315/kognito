import { briefingMeta, readBriefing } from '@/lib/briefing'
import type { ArtifactKind } from '@/lib/db/schema'
import { faqMeta, readFaq } from '@/lib/faq'
import { readTimeline, timelineMeta } from '@/lib/timeline'

/**
 * What the two kinds have in common, kept where the browser may read it.
 *
 * The studio lists artifacts of every kind and the reader labels the one it
 * shows, so both need a name and the line under it without knowing which
 * kind they hold.
 */

/** The kinds a tile really generates. The rest still fake it, see #26 to #28. */
export const generatedKinds = ['briefing', 'faq', 'timeline'] as const
export type GeneratedKind = (typeof generatedKinds)[number]

export function isGenerated(kind: string): kind is GeneratedKind {
  return (generatedKinds as readonly string[]).includes(kind)
}

export const artifactLabels: Record<ArtifactKind, string> = {
  briefing: 'Briefing',
  faq: 'FAQ',
  timeline: 'Zeitleiste',
}

/** Null when the stored json does not match the schema of its kind. */
export function artifactMeta(artifact: {
  kind: ArtifactKind
  content: unknown
}): string | null {
  switch (artifact.kind) {
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
  }
}
