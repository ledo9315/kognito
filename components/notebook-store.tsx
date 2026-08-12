'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import {
  simulateAnswer,
  type ChatMessage,
  type Notebook,
  type Source,
  type SourceKind,
  type StudioArtifact,
  type StudioArtifactKind,
} from '@/lib/data'

/**
 * Holds one notebook, the one currently open.
 *
 * Identity and title come from the database. Sources, messages, artifacts and
 * notes are still the prototype simulation and live only in this reducer, so
 * they are gone on reload. Issues 9 to 12 move them to the server one at a
 * time, and this store shrinks with every one of them.
 */

type State = {
  notebook: Notebook
  /** Source currently open in the reader panel. */
  openSourceId: string | null
  thinking: boolean
}

type Action =
  | { type: 'toggle-source'; sourceId: string }
  | { type: 'set-all-sources'; selected: boolean }
  | { type: 'add-source'; source: Source }
  | { type: 'remove-source'; sourceId: string }
  | { type: 'open-source'; sourceId: string | null }
  | { type: 'add-message'; message: ChatMessage }
  | { type: 'clear-messages' }
  | { type: 'set-thinking'; value: boolean }
  | { type: 'add-artifact'; artifact: StudioArtifact }
  | { type: 'remove-artifact'; artifactId: string }
  | { type: 'add-note'; title: string; body: string }

function update(state: State, changes: Partial<Notebook>): State {
  return { ...state, notebook: { ...state.notebook, ...changes } }
}

function reducer(state: State, action: Action): State {
  const { notebook } = state

  switch (action.type) {
    case 'toggle-source':
      return update(state, {
        sources: notebook.sources.map((source) =>
          source.id === action.sourceId
            ? { ...source, selected: !source.selected }
            : source,
        ),
      })
    case 'set-all-sources':
      return update(state, {
        sources: notebook.sources.map((source) => ({
          ...source,
          selected: action.selected,
        })),
      })
    case 'add-source':
      return update(state, { sources: [action.source, ...notebook.sources] })
    case 'remove-source':
      return update(state, {
        sources: notebook.sources.filter(
          (source) => source.id !== action.sourceId,
        ),
      })
    case 'open-source':
      return { ...state, openSourceId: action.sourceId }
    case 'add-message':
      return update(state, { messages: [...notebook.messages, action.message] })
    case 'clear-messages':
      return update(state, { messages: [] })
    case 'set-thinking':
      return { ...state, thinking: action.value }
    case 'add-artifact':
      return update(state, {
        artifacts: [action.artifact, ...notebook.artifacts],
      })
    case 'remove-artifact':
      return update(state, {
        artifacts: notebook.artifacts.filter(
          (artifact) => artifact.id !== action.artifactId,
        ),
      })
    case 'add-note':
      return update(state, {
        notes: [
          {
            id: uid('note'),
            title: action.title,
            body: action.body,
            pinned: false,
          },
          ...notebook.notes,
        ],
      })
    default:
      return state
  }
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

type StoreValue = {
  state: State
  notebook: Notebook
  toggleSource: (sourceId: string) => void
  setAllSources: (selected: boolean) => void
  addSource: (input: { title: string; kind: SourceKind; meta: string }) => void
  removeSource: (sourceId: string) => void
  openSource: (sourceId: string | null) => void
  askQuestion: (question: string) => Promise<void>
  clearChat: () => void
  generateArtifact: (kind: StudioArtifactKind) => Promise<StudioArtifact>
  removeArtifact: (artifactId: string) => void
  addNote: (title: string, body: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function NotebookStoreProvider({
  notebook,
  children,
}: {
  notebook: { id: string; title: string; emoji: string }
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, {
    notebook: {
      ...notebook,
      sources: [],
      messages: [],
      artifacts: [],
      notes: [],
    },
    openSourceId: null,
    thinking: false,
  })

  const value = useMemo<StoreValue>(() => {
    return {
      state,
      notebook: state.notebook,
      toggleSource: (sourceId) => dispatch({ type: 'toggle-source', sourceId }),
      setAllSources: (selected) =>
        dispatch({ type: 'set-all-sources', selected }),
      addSource: (input) =>
        dispatch({
          type: 'add-source',
          source: {
            id: uid('source'),
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
      removeSource: (sourceId) => dispatch({ type: 'remove-source', sourceId }),
      openSource: (sourceId) => dispatch({ type: 'open-source', sourceId }),
      clearChat: () => dispatch({ type: 'clear-messages' }),
      askQuestion: async (question) => {
        dispatch({
          type: 'add-message',
          message: {
            id: uid('message'),
            role: 'user',
            content: question,
            createdAt: Date.now(),
          },
        })
        dispatch({ type: 'set-thinking', value: true })

        await new Promise((resolve) => setTimeout(resolve, 1400))

        const { content, citations } = simulateAnswer(
          question,
          state.notebook.sources,
        )
        dispatch({
          type: 'add-message',
          message: {
            id: uid('message'),
            role: 'assistant',
            content,
            citations,
            createdAt: Date.now(),
          },
        })
        dispatch({ type: 'set-thinking', value: false })
      },
      generateArtifact: async (kind) => {
        await new Promise((resolve) => setTimeout(resolve, 1600))
        const artifact: StudioArtifact = {
          id: uid('artifact'),
          kind,
          title: artifactTitle(kind),
          meta: artifactMeta(kind),
          createdAt: Date.now(),
        }
        dispatch({ type: 'add-artifact', artifact })
        return artifact
      },
      removeArtifact: (artifactId) =>
        dispatch({ type: 'remove-artifact', artifactId }),
      addNote: (title, body) => dispatch({ type: 'add-note', title, body }),
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
