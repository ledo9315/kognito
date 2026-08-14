import {
  FileText,
  Globe,
  NotebookPen,
  NotepadText,
  PlaySquare,
  Type,
} from 'lucide-react'
import type { SourceKind } from '@/lib/db/schema'

const icons = {
  pdf: FileText,
  doc: NotepadText,
  web: Globe,
  youtube: PlaySquare,
  text: Type,
  note: NotebookPen,
} as const

export const sourceKindLabel: Record<SourceKind, string> = {
  pdf: 'PDF',
  doc: 'Dokument',
  web: 'Website',
  youtube: 'YouTube',
  text: 'Text',
  note: 'Notiz',
}

export function SourceIcon({ kind }: { kind: SourceKind }) {
  const Icon = icons[kind]
  return <Icon aria-hidden="true" />
}
