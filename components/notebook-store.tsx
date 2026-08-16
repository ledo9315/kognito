'use client'

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import type { ArtifactRow } from '@/lib/artifacts'
import {
  selectAllSourcesAction,
  selectSourceAction,
} from '@/lib/source-actions'
import type { MessageRow } from '@/lib/messages'
import type { SourceItem } from '@/lib/sources'

type Notebook = { id: string; title: string; emoji: string }

export type Passage = { charStart: number; charEnd: number }

type State = {
  selection: Record<string, boolean>
  openSourceId: string | null
  openArtifactId: string | null
  passage: Passage | null
}

type Action =
  | { type: 'select'; sourceId: string; selected: boolean }
  | { type: 'select-all'; sourceIds: string[]; selected: boolean }
  | { type: 'open-source'; sourceId: string | null; passage: Passage | null }
  | { type: 'open-artifact'; artifactId: string | null }

const emptyState: State = {
  selection: {},
  openSourceId: null,
  openArtifactId: null,
  passage: null,
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
        openArtifactId: null,
        passage: action.passage,
      }
    case 'open-artifact':
      return { ...state, openArtifactId: action.artifactId, openSourceId: null }
    default:
      return state
  }
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
  history: MessageRow[]
  openSourceId: string | null
  openArtifactId: string | null
  passage: Passage | null
  artifacts: ArtifactRow[]
  notes: SourceItem[]
  selectSource: (sourceId: string, selected: boolean) => void
  selectAllSources: (selected: boolean) => void
  openSource: (sourceId: string | null, passage?: Passage) => void
  openArtifact: (artifactId: string | null) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function NotebookStoreProvider({
  notebook,
  sources,
  history,
  artifacts,
  children,
}: {
  notebook: Notebook
  sources: SourceItem[]
  history: MessageRow[]
  artifacts: ArtifactRow[]
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
      openArtifactId: state.openArtifactId,
      passage: state.passage,
      artifacts,
      notes: merged.filter((source) => source.kind === 'note'),
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
      openArtifact: (artifactId) => dispatch({ type: 'open-artifact', artifactId }),
    }
  }, [notebook, merged, history, artifacts, state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/**
 * Lets the reader play its closing animation before it is taken down.
 *
 * The panel is only mounted while the store holds an open source or artifact,
 * so clearing the store first would cut the animation off at its first frame.
 * The delay is the length of the animation in the class list, both are 200ms.
 */
export function useClosingReader(close: () => void) {
  const [closing, setClosing] = useState(false)

  return {
    closing,
    startClosing: () => {
      setClosing(true)
      setTimeout(close, 200)
    },
  }
}

export function useNotebookStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useNotebookStore must be used within NotebookStoreProvider')
  }
  return context
}

