

export type Citation = {
  sourceId: string
  index: number
  quote: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  createdAt: number
}

export type StudioArtifactKind =
  | 'audio'
  | 'briefing'
  | 'faq'
  | 'timeline'
  | 'mindmap'
  | 'flashcards'

export type StudioArtifact = {
  id: string
  kind: StudioArtifactKind
  title: string
  meta: string
  createdAt: number
}

/* -------------------------------------------------------------------------- */
/* Simulated responses for the interactive prototype                           */

export const suggestedQuestions = [
  'Fasse die Kernaussagen aller Quellen zusammen',
  'Wo widersprechen sich die Quellen?',
  'Welche Zahlen sollte ich mir merken?',
  'Erstelle eine Gliederung für einen Vortrag',
]

type Reply = { content: string; citationCount: number }

const genericReplies: Reply[] = [
  {
    content: `Ich habe die ausgewählten Quellen durchsucht. Die zentralen Punkte:

**Konsens.** Alle Quellen stimmen darin überein, dass die Richtung eindeutig ist. Uneinigkeit besteht vor allem beim Tempo und bei der Kostenverteilung [1].

**Belastbare Zahlen.** Die quantitativen Angaben sind konsistent, stammen aber teilweise aus derselben Primärquelle. Für die Argumentation heißt das: sparsam zitieren, dafür präzise [2].

**Lücke.** Zu den Verteilungswirkungen liefern deine Quellen bisher wenig. Hier lohnt eine zusätzliche Quelle.`,
    citationCount: 2,
  },
  {
    content: `Kurzantwort: ja, aber mit einer wichtigen Einschränkung.

Die Quellen stützen die These im Kern [1]. Allerdings beruhen zwei der drei Belege auf Modellannahmen, nicht auf Messdaten. Das solltest du in einer schriftlichen Ausarbeitung kennzeichnen [2].

**Was ich daraus ableiten würde**
- Die Aussage ist tragfähig für eine Einordnung, nicht für eine Prognose.
- Für belastbare Zahlen brauchst du eine aktuellere Primärquelle.
- Der interessantere Konflikt liegt in den Annahmen, nicht in den Ergebnissen.`,
    citationCount: 2,
  },
  {
    content: `Hier ist eine Gliederung, die sich vollständig aus deinen Quellen tragen lässt:

**1. Ausgangslage:** Warum das Thema jetzt relevant ist [1]
**2. Befund:** Was die Daten zeigen, inklusive Unsicherheiten [2]
**3. Konflikt:** Wo die Quellen auseinandergehen [3]
**4. Handlungsoptionen:** Drei Szenarien mit Kostenrahmen
**5. Offene Fragen:** Was die Quellenlage nicht beantwortet

Abschnitt 4 ist derzeit am dünnsten belegt. Dort würde ich vor dem Vortrag nachrecherchieren.`,
    citationCount: 3,
  },
]

/** Only what the simulation needs, so it fits any source shape. */
type CitableSource = {
  id: string
  title: string
  content: string | null
  selected: boolean
}

export function simulateAnswer(
  question: string,
  sources: CitableSource[],
): { content: string; citations: Citation[] } {
  const activeSources = sources.filter((source) => source.selected)
  if (activeSources.length === 0) {
    return {
      content:
        'Es ist derzeit keine Quelle ausgewählt. Wähle links mindestens eine Quelle aus, damit ich meine Antwort darauf belegen kann.',
      citations: [],
    }
  }

  const pick =
    genericReplies[
      Math.abs(hash(question.toLowerCase().trim())) % genericReplies.length
    ]

  const citations: Citation[] = []
  for (let i = 0; i < Math.min(pick.citationCount, activeSources.length); i++) {
    const source = activeSources[i]
    citations.push({
      sourceId: source.id,
      index: i + 1,
      quote: opening(source),
    })
  }

  return { content: pick.content, citations }
}

/** Stands in for a real citation until the model picks the passage itself. */
function opening(source: CitableSource) {
  const text = source.content?.trim() ?? ''
  if (!text) return source.title
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return h
}
