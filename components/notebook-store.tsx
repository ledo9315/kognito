'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import {
  notebooks as seedNotebooks,
  simulateAnswer,
  type ChatMessage,
  type Notebook,
  type Source,
  type SourceKind,
  type StudioArtifact,
  type StudioArtifactKind,
} from '@/lib/data'

type State = {
  notebooks: Notebook[]
  /** Source currently open in the reader panel. */
  openSourceId: string | null
  thinking: boolean
}

type Action =
  | { type: 'toggle-source'; notebookId: string; sourceId: string }
  | { type: 'set-all-sources'; notebookId: string; selected: boolean }
  | { type: 'add-source'; notebookId: string; source: Source }
  | { type: 'remove-source'; notebookId: string; sourceId: string }
  | { type: 'open-source'; sourceId: string | null }
  | { type: 'add-message'; notebookId: string; message: ChatMessage }
  | { type: 'clear-messages'; notebookId: string }
  | { type: 'set-thinking'; value: boolean }
  | { type: 'add-artifact'; notebookId: string; artifact: StudioArtifact }
  | { type: 'remove-artifact'; notebookId: string; artifactId: string }
  | { type: 'add-notebook'; notebook: Notebook }
  | { type: 'rename-notebook'; notebookId: string; title: string }
  | { type: 'add-note'; notebookId: string; title: string; body: string }

function mapNotebook(
  state: State,
  notebookId: string,
  fn: (nb: Notebook) => Notebook,
): State {
  return {
    ...state,
    notebooks: state.notebooks.map((nb) => (nb.id === notebookId ? fn(nb) : nb)),
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle-source':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        sources: nb.sources.map((s) =>
          s.id === action.sourceId ? { ...s, selected: !s.selected } : s,
        ),
      }))
    case 'set-all-sources':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        sources: nb.sources.map((s) => ({ ...s, selected: action.selected })),
      }))
    case 'add-source':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        sources: [action.source, ...nb.sources],
      }))
    case 'remove-source':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        sources: nb.sources.filter((s) => s.id !== action.sourceId),
      }))
    case 'open-source':
      return { ...state, openSourceId: action.sourceId }
    case 'add-message':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        messages: [...nb.messages, action.message],
      }))
    case 'clear-messages':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        messages: [],
      }))
    case 'set-thinking':
      return { ...state, thinking: action.value }
    case 'add-artifact':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        artifacts: [action.artifact, ...nb.artifacts],
      }))
    case 'remove-artifact':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        artifacts: nb.artifacts.filter((a) => a.id !== action.artifactId),
      }))
    case 'add-notebook':
      return { ...state, notebooks: [action.notebook, ...state.notebooks] }
    case 'rename-notebook':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        title: action.title,
      }))
    case 'add-note':
      return mapNotebook(state, action.notebookId, (nb) => ({
        ...nb,
        notes: [
          {
            id: uid('note'),
            title: action.title,
            body: action.body,
            pinned: false,
          },
          ...nb.notes,
        ],
      }))
    default:
      return state
  }
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

type StoreValue = {
  state: State
  notebooks: Notebook[]
  getNotebook: (id: string) => Notebook | undefined
  toggleSource: (notebookId: string, sourceId: string) => void
  setAllSources: (notebookId: string, selected: boolean) => void
  addSource: (
    notebookId: string,
    input: { title: string; kind: SourceKind; meta: string },
  ) => void
  removeSource: (notebookId: string, sourceId: string) => void
  openSource: (sourceId: string | null) => void
  askQuestion: (notebookId: string, question: string) => Promise<void>
  clearChat: (notebookId: string) => void
  generateArtifact: (
    notebookId: string,
    kind: StudioArtifactKind,
  ) => Promise<StudioArtifact>
  removeArtifact: (notebookId: string, artifactId: string) => void
  createNotebook: (title: string) => string
  renameNotebook: (notebookId: string, title: string) => void
  addNote: (notebookId: string, title: string, body: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function NotebookStoreProvider({
  children,
}: {
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, {
    notebooks: seedNotebooks,
    openSourceId: null,
    thinking: false,
  })

  const value = useMemo<StoreValue>(() => {
    return {
      state,
      notebooks: state.notebooks,
      getNotebook: (id) => state.notebooks.find((nb) => nb.id === id),
      toggleSource: (notebookId, sourceId) =>
        dispatch({ type: 'toggle-source', notebookId, sourceId }),
      setAllSources: (notebookId, selected) =>
        dispatch({ type: 'set-all-sources', notebookId, selected }),
      addSource: (notebookId, input) =>
        dispatch({
          type: 'add-source',
          notebookId,
          source: {
            id: uid('src'),
            title: input.title,
            kind: input.kind,
            meta: input.meta,
            selected: true,
            summary:
              'Diese Quelle wurde gerade hinzugefügt. In der Vollversion erzeugt das Modell hier automatisch eine Zusammenfassung.',
            excerpts: [
              'Auszug wird nach der Verarbeitung der Quelle verfügbar.',
            ],
          },
        }),
      removeSource: (notebookId, sourceId) =>
        dispatch({ type: 'remove-source', notebookId, sourceId }),
      openSource: (sourceId) => dispatch({ type: 'open-source', sourceId }),
      clearChat: (notebookId) => dispatch({ type: 'clear-messages', notebookId }),
      askQuestion: async (notebookId, question) => {
        const notebook = state.notebooks.find((nb) => nb.id === notebookId)
        if (!notebook) return

        dispatch({
          type: 'add-message',
          notebookId,
          message: {
            id: uid('msg'),
            role: 'user',
            content: question,
            createdAt: Date.now(),
          },
        })
        dispatch({ type: 'set-thinking', value: true })

        await new Promise((resolve) => setTimeout(resolve, 1400))

        const { content, citations } = simulateAnswer(question, notebook.sources)
        dispatch({
          type: 'add-message',
          notebookId,
          message: {
            id: uid('msg'),
            role: 'assistant',
            content,
            citations,
            createdAt: Date.now(),
          },
        })
        dispatch({ type: 'set-thinking', value: false })
      },
      generateArtifact: async (notebookId, kind) => {
        await new Promise((resolve) => setTimeout(resolve, 1600))
        const artifact: StudioArtifact = {
          id: uid('art'),
          kind,
          title: artifactTitle(kind),
          meta: artifactMeta(kind),
          createdAt: Date.now(),
        }
        dispatch({ type: 'add-artifact', notebookId, artifact })
        return artifact
      },
      removeArtifact: (notebookId, artifactId) =>
        dispatch({ type: 'remove-artifact', notebookId, artifactId }),
      createNotebook: (title) => {
        const id = uid('nb')
        dispatch({
          type: 'add-notebook',
          notebook: {
            id,
            title: title || 'Unbenanntes Notizbuch',
            emoji: '📝',
            updatedLabel: 'Gerade eben',
            sources: [],
            messages: [],
            artifacts: [],
            notes: [],
          },
        })
        return id
      },
      renameNotebook: (notebookId, title) =>
        dispatch({ type: 'rename-notebook', notebookId, title }),
      addNote: (notebookId, title, body) =>
        dispatch({ type: 'add-note', notebookId, title, body }),
    }
  }, [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useNotebookStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useNotebookStore must be used within NotebookStoreProvider')
  }
  return context
}

function artifactTitle(kind: StudioArtifactKind) {
  switch (kind) {
    case 'audio':
      return 'Audio-Übersicht'
    case 'briefing':
      return 'Briefing-Dokument'
    case 'faq':
      return 'Häufige Fragen'
    case 'timeline':
      return 'Zeitleiste'
    case 'mindmap':
      return 'Mindmap'
    case 'flashcards':
      return 'Lernkarten'
  }
}

function artifactMeta(kind: StudioArtifactKind) {
  switch (kind) {
    case 'audio':
      return '9:42 · Zwei Sprecher'
    case 'briefing':
      return '5 Abschnitte'
    case 'faq':
      return '11 Fragen'
    case 'timeline':
      return '8 Ereignisse'
    case 'mindmap':
      return '4 Ebenen'
    case 'flashcards':
      return '18 Karten'
  }
}
