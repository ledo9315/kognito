'use client'

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { StudioArtifact, StudioArtifactKind } from '@/lib/data'
import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
  type NoteFormState,
} from '@/lib/note-actions'
import {
  selectAllSourcesAction,
  selectSourceAction,
} from '@/lib/source-actions'
import type { MessageRow } from '@/lib/messages'
import type { NoteRow } from '@/lib/notes'
import type { SourceItem } from '@/lib/sources'

type Notebook = { id: string; title: string; emoji: string }

export type Passage = { charStart: number; charEnd: number }

type State = {
  selection: Record<string, boolean>
  openSourceId: string | null
  passage: Passage | null
  artifacts: StudioArtifact[]
}

type Action =
  | { type: 'select'; sourceId: string; selected: boolean }
  | { type: 'select-all'; sourceIds: string[]; selected: boolean }
  | { type: 'open-source'; sourceId: string | null; passage: Passage | null }
  | { type: 'add-artifact'; artifact: StudioArtifact }
  | { type: 'remove-artifact'; artifactId: string }

const emptyState: State = {
  selection: {},
  openSourceId: null,
  passage: null,
  artifacts: [],
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select':
      return {
        ...state,
        selection: { ...state.selection, [action.sourceId]: action.selected },
      }
    case 'select-all': {
      const selection = { ...state.selection }
      for (const sourceId of action.sourceIds) selection[sourceId] = action.selected
      return { ...state, selection }
    }
    case 'open-source':
      return {
        ...state,
        openSourceId: action.sourceId,
        passage: action.passage,
      }
    case 'add-artifact':
      return { ...state, artifacts: [action.artifact, ...state.artifacts] }
    case 'remove-artifact':
      return {
        ...state,
        artifacts: state.artifacts.filter(
          (artifact) => artifact.id !== action.artifactId,
        ),
      }
    default:
      return state
  }
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

async function keepOrUndo(stored: Promise<boolean>, undo: () => void) {
  try {
    if (await stored) return
  } catch {
    // A failed write and a refused one lead to the same place.
  }
  undo()
  toast.error('Die Auswahl konnte nicht gespeichert werden.')
}

type StoreValue = {
  notebook: Notebook
  sources: SourceItem[]
  /** The stored conversation, as it was when the page was rendered. */
  history: MessageRow[]
  openSourceId: string | null
  /** Set when the reader was opened from a citation, null otherwise. */
  passage: Passage | null
  artifacts: StudioArtifact[]
  /** Stored notes, as they were when the page was rendered. */
  notes: NoteRow[]
  selectSource: (sourceId: string, selected: boolean) => void
  selectAllSources: (selected: boolean) => void
  openSource: (sourceId: string | null, passage?: Passage) => void
  generateArtifact: (kind: StudioArtifactKind) => Promise<StudioArtifact>
  removeArtifact: (artifactId: string) => void
  // The three write into the database and return the reason when that fails,
  // so the caller can keep its dialog open instead of losing what was typed.
  addNote: (title: string, body: string) => Promise<NoteFormState>
  editNote: (noteId: string, title: string, body: string) => Promise<NoteFormState>
  removeNote: (noteId: string) => Promise<NoteFormState>
}

const StoreContext = createContext<StoreValue | null>(null)

export function NotebookStoreProvider({
  notebook,
  sources,
  history,
  notes,
  children,
}: {
  notebook: Notebook
  sources: SourceItem[]
  history: MessageRow[]
  notes: NoteRow[]
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(reducer, emptyState)

  const merged = useMemo(
    () =>
      sources.map((source) => ({
        ...source,
        selected: state.selection[source.id] ?? source.selected,
      })),
    [sources, state.selection],
  )

  const value = useMemo<StoreValue>(() => {
    return {
      notebook,
      sources: merged,
      history,
      openSourceId: state.openSourceId,
      passage: state.passage,
      artifacts: state.artifacts,
      notes,
      // The check mark reacts at once and the write follows. If the write
      // fails the mark goes back, because a mark that lies decides which
      // sources answer the next question.
      selectSource: (sourceId, selected) => {
        dispatch({ type: 'select', sourceId, selected })
        void keepOrUndo(selectSourceAction(sourceId, selected), () =>
          dispatch({ type: 'select', sourceId, selected: !selected }),
        )
      },
      selectAllSources: (selected) => {
        const sourceIds = merged.map((source) => source.id)
        dispatch({ type: 'select-all', sourceIds, selected })
        void keepOrUndo(
          selectAllSourcesAction(notebook.id, selected),
          () => dispatch({ type: 'select-all', sourceIds, selected: !selected }),
        )
      },
      openSource: (sourceId, passage) =>
        dispatch({ type: 'open-source', sourceId, passage: passage ?? null }),
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
      // No optimistic copy here: the action revalidates the page, so the
      // list comes back from the database and cannot drift away from it.
      addNote: (title, body) => createNoteAction(notebook.id, title, body),
      editNote: (noteId, title, body) => updateNoteAction(notebook.id, noteId, title, body),
      removeNote: (noteId) => deleteNoteAction(notebook.id, noteId),
    }
  }, [notebook, merged, history, notes, state])

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
