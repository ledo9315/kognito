export type SourceKind = 'pdf' | 'doc' | 'web' | 'youtube' | 'text' | 'audio'

export type Source = {
  id: string
  title: string
  kind: SourceKind
  meta: string
  selected: boolean
  summary: string
  /** Short excerpts used as citation evidence. */
  excerpts: string[]
}

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

export type Notebook = {
  id: string
  title: string
  emoji: string
  updatedLabel: string
  sources: Source[]
  messages: ChatMessage[]
  artifacts: StudioArtifact[]
  notes: { id: string; title: string; body: string; pinned: boolean }[]
}

/* -------------------------------------------------------------------------- */

const climateSources: Source[] = [
  {
    id: 's1',
    title: 'IPCC AR6: Synthesebericht (Kapitel 3)',
    kind: 'pdf',
    meta: 'PDF · 84 Seiten',
    selected: true,
    summary:
      'Fasst den Stand der Klimaforschung zusammen: Erwärmungspfade, Kipppunkte und Minderungsoptionen bis 2050.',
    excerpts: [
      'Die globale Oberflächentemperatur lag 2011–2020 um 1,09 °C über dem Niveau von 1850–1900.',
      'Ohne sofortige Emissionsminderung ist eine Begrenzung auf 1,5 °C nicht mehr erreichbar.',
      'Der CO2-Restbudget-Pfad für 1,5 °C beträgt rund 500 Gt CO2 ab 2020.',
    ],
  },
  {
    id: 's2',
    title: 'Netto-Null Industrie: Kostenkurven 2024',
    kind: 'doc',
    meta: 'DOCX · 22 Seiten',
    selected: true,
    summary:
      'Analysiert Investitionskosten für Elektrifizierung, Wasserstoff und CCS in Stahl-, Zement- und Chemieindustrie.',
    excerpts: [
      'Grüner Stahl erreicht bei Strompreisen unter 45 €/MWh Kostenparität mit Hochofenroute.',
      'CCS in der Zementindustrie verteuert die Tonne Zement um 55–90 €.',
    ],
  },
  {
    id: 's3',
    title: 'Interview: Energiewende in der Praxis',
    kind: 'youtube',
    meta: 'YouTube · 41 Min.',
    selected: true,
    summary:
      'Gespräch mit einer Netzbetreiberin über Speicherbedarf, Netzausbau und Genehmigungsdauern in Deutschland.',
    excerpts: [
      'Genehmigungsverfahren für Umspannwerke dauern im Schnitt noch vier bis sechs Jahre.',
      'Batteriespeicher übernehmen inzwischen einen wachsenden Teil der Primärregelleistung.',
    ],
  },
  {
    id: 's4',
    title: 'bmwk.de: Monitoringbericht Energiewende',
    kind: 'web',
    meta: 'Website · bmwk.de',
    selected: false,
    summary:
      'Offizieller Monitoringbericht mit Kennzahlen zu Ausbaupfaden, Versorgungssicherheit und Emissionen.',
    excerpts: [
      'Der Anteil erneuerbarer Energien am Bruttostromverbrauch lag zuletzt bei über 55 %.',
    ],
  },
  {
    id: 's5',
    title: 'Eigene Notizen: Recherchefragen',
    kind: 'text',
    meta: 'Text · 1.200 Wörter',
    selected: true,
    summary:
      'Gesammelte Leitfragen, offene Punkte und Hypothesen zur Wirtschaftlichkeit der Transformation.',
    excerpts: [
      'Offene Frage: Wie verteilen sich Transformationskosten zwischen Staat, Industrie und Haushalten?',
    ],
  },
]

const climateMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content:
      'Was sind die wichtigsten Hebel, um die Industrie bis 2045 klimaneutral zu machen?',
    createdAt: Date.now() - 1000 * 60 * 22,
  },
  {
    id: 'm2',
    role: 'assistant',
    content: `Aus deinen Quellen lassen sich drei zentrale Hebel ableiten:

**1. Elektrifizierung mit günstigem Strom.** Die Kostenparität von grünem Stahl hängt fast vollständig am Strompreis. Unterhalb von 45 €/MWh wird die Direktreduktionsroute gegenüber dem Hochofen wettbewerbsfähig [2].

**2. Netzausbau und Speicher als Voraussetzung.** Der Engpass ist weniger die Technologie als die Genehmigungsdauer: Umspannwerke brauchen aktuell vier bis sechs Jahre [3]. Batteriespeicher decken bereits einen wachsenden Teil der Regelleistung ab [3].

**3. CCS nur dort, wo unvermeidbar.** In der Zementindustrie bleiben Prozessemissionen bestehen; CCS verteuert die Tonne um 55–90 € [2]. Das ist teuer, aber ohne Alternative.

Zeitkritisch ist das alles, weil das verbleibende CO2-Budget für 1,5 °C bei rund 500 Gt CO2 ab 2020 liegt [1].`,
    citations: [
      {
        sourceId: 's1',
        index: 1,
        quote:
          'Der CO2-Restbudget-Pfad für 1,5 °C beträgt rund 500 Gt CO2 ab 2020.',
      },
      {
        sourceId: 's2',
        index: 2,
        quote:
          'Grüner Stahl erreicht bei Strompreisen unter 45 €/MWh Kostenparität mit Hochofenroute.',
      },
      {
        sourceId: 's3',
        index: 3,
        quote:
          'Genehmigungsverfahren für Umspannwerke dauern im Schnitt noch vier bis sechs Jahre.',
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 21,
  },
]

const thesisSources: Source[] = [
  {
    id: 't1',
    title: 'Attention Is All You Need',
    kind: 'pdf',
    meta: 'PDF · 15 Seiten',
    selected: true,
    summary:
      'Originalarbeit zur Transformer-Architektur: Self-Attention ersetzt Rekurrenz vollständig.',
    excerpts: [
      'Der Transformer verzichtet vollständig auf Rekurrenz und Konvolution und nutzt ausschließlich Attention.',
      'Multi-Head Attention erlaubt es, Informationen aus verschiedenen Repräsentationsräumen zu kombinieren.',
    ],
  },
  {
    id: 't2',
    title: 'Retrieval-Augmented Generation: Survey',
    kind: 'pdf',
    meta: 'PDF · 38 Seiten',
    selected: true,
    summary:
      'Überblick über RAG-Pipelines: Chunking, Embedding, Reranking und Groundedness-Metriken.',
    excerpts: [
      'Reranking mit Cross-Encodern verbessert die Antwortpräzision deutlich gegenüber reiner Vektorsuche.',
      'Groundedness lässt sich über Zitat-Abdeckung pro Aussage messen.',
    ],
  },
  {
    id: 't3',
    title: 'Vorlesungsmitschnitt: Evaluation von LLMs',
    kind: 'audio',
    meta: 'MP3 · 68 Min.',
    selected: true,
    summary:
      'Behandelt Benchmarks, ihre Grenzen und den Unterschied zwischen Fähigkeits- und Sicherheitsevaluation.',
    excerpts: [
      'Benchmarks sättigen schnell; aussagekräftiger sind aufgabenspezifische Evaluationssets.',
    ],
  },
]

const marketSources: Source[] = [
  {
    id: 'w1',
    title: 'Wettbewerbsanalyse Q3: Rohdaten',
    kind: 'doc',
    meta: 'XLSX-Export · 9 Seiten',
    selected: true,
    summary:
      'Preis-, Feature- und Positionierungsvergleich von sieben Wettbewerbern im DACH-Markt.',
    excerpts: [
      'Drei von sieben Anbietern haben im Quartal ein nutzungsbasiertes Preismodell eingeführt.',
    ],
  },
  {
    id: 'w2',
    title: 'Kundeninterviews: Transkripte (12 Gespräche)',
    kind: 'text',
    meta: 'Text · 24.000 Wörter',
    selected: true,
    summary:
      'Wiederkehrende Themen: Onboarding-Aufwand, Datenhoheit und fehlende Integrationen.',
    excerpts: [
      'Neun von zwölf Befragten nennen Datenhoheit als K.-o.-Kriterium bei der Anbieterwahl.',
    ],
  },
]

export const notebooks: Notebook[] = [
  {
    id: 'nb-klima',
    title: 'Klimaneutrale Industrie 2045',
    emoji: '🌍',
    updatedLabel: 'Heute',
    sources: climateSources,
    messages: climateMessages,
    artifacts: [
      {
        id: 'a1',
        kind: 'audio',
        title: 'Audio-Übersicht: Transformationspfade',
        meta: '12:04 · Zwei Sprecher',
        createdAt: Date.now() - 1000 * 60 * 60 * 3,
      },
      {
        id: 'a2',
        kind: 'briefing',
        title: 'Briefing-Dokument',
        meta: '6 Abschnitte',
        createdAt: Date.now() - 1000 * 60 * 60 * 5,
      },
    ],
    notes: [
      {
        id: 'n1',
        title: 'Kernthese',
        body: 'Der limitierende Faktor ist nicht Technologie, sondern Genehmigungsgeschwindigkeit und Strompreis.',
        pinned: true,
      },
    ],
  },
  {
    id: 'nb-thesis',
    title: 'Masterarbeit: RAG-Systeme',
    emoji: '📚',
    updatedLabel: 'Gestern',
    sources: thesisSources,
    messages: [],
    artifacts: [
      {
        id: 'a3',
        kind: 'flashcards',
        title: 'Lernkarten: Attention & RAG',
        meta: '24 Karten',
        createdAt: Date.now() - 1000 * 60 * 60 * 30,
      },
    ],
    notes: [],
  },
  {
    id: 'nb-market',
    title: 'Marktanalyse DACH',
    emoji: '📈',
    updatedLabel: 'Vor 4 Tagen',
    sources: marketSources,
    messages: [],
    artifacts: [],
    notes: [],
  },
]

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

export function simulateAnswer(
  question: string,
  sources: Source[],
): { content: string; citations: Citation[] } {
  const active = sources.filter((s) => s.selected)
  if (active.length === 0) {
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
  for (let i = 0; i < Math.min(pick.citationCount, active.length); i++) {
    const source = active[i]
    citations.push({
      sourceId: source.id,
      index: i + 1,
      quote: source.excerpts[0] ?? source.summary,
    })
  }

  return { content: pick.content, citations }
}

function hash(value: string) {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return h
}
