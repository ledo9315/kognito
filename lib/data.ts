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

export const suggestedQuestions = [
  'Fasse die Kernaussagen aller Quellen zusammen',
  'Wo widersprechen sich die Quellen?',
  'Welche Zahlen sollte ich mir merken?',
  'Erstelle eine Gliederung für einen Vortrag',
]
