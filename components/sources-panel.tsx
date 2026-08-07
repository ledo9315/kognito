'use client'

import { MoreHorizontal, Plus, Trash2, FileSearch } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { SourceIcon, sourceKindLabel } from '@/components/source-icon'
import { AddSourceDialog } from '@/components/add-source-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { Notebook } from '@/lib/data'
import { cn } from '@/lib/utils'

export function SourcesPanel({ notebook }: { notebook: Notebook }) {
  const { toggleSource, setAllSources, removeSource, openSource, state } =
    useNotebookStore()

  const selectedCount = notebook.sources.filter((source) => source.selected).length
  const allSelected =
    notebook.sources.length > 0 && selectedCount === notebook.sources.length

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Quellen</h2>
        <AddSourceDialog
          notebookId={notebook.id}
          trigger={
            <Button variant="outline" size="sm">
              <Plus data-icon="inline-start" />
              Hinzufügen
            </Button>
          }
        />
      </header>

      {notebook.sources.length === 0 ? (
        <div className="flex flex-1 items-center p-4">
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearch />
              </EmptyMedia>
              <EmptyTitle>Noch keine Quellen</EmptyTitle>
              <EmptyDescription>
                Füge PDFs, Websites, Videos oder eigene Notizen hinzu, damit
                Kognito antworten kann.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                onCheckedChange={(checked) =>
                  setAllSources(notebook.id, Boolean(checked))
                }
                aria-label="Alle Quellen auswählen"
              />
              Alle auswählen
            </label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {selectedCount}/{notebook.sources.length}
            </span>
          </div>

          <ul className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
            {notebook.sources.map((source) => {
              const isOpen = state.openSourceId === source.id
              return (
                <li key={source.id}>
                  <div
                    className={cn(
                      'group flex items-start gap-2.5 rounded-lg px-2 py-2.5 transition-colors',
                      isOpen ? 'bg-accent' : 'hover:bg-muted',
                    )}
                  >
                    <Checkbox
                      checked={source.selected}
                      onCheckedChange={() =>
                        toggleSource(notebook.id, source.id)
                      }
                      className="mt-0.5"
                      aria-label={`${source.title} als Kontext verwenden`}
                    />

                    <button
                      type="button"
                      onClick={() => openSource(source.id)}
                      className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'line-clamp-2 text-[13px] leading-snug',
                          source.selected
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {source.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="[&_svg]:size-3">
                          <SourceIcon kind={source.kind} />
                        </span>
                        <span>{sourceKindLabel[source.kind]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{source.meta}</span>
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="opacity-0 transition-opacity group-hover:opacity-100 data-popup-open:opacity-100"
                          />
                        }
                      >
                        <MoreHorizontal />
                        <span className="sr-only">Quellenoptionen</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => openSource(source.id)}
                          >
                            Quelle öffnen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => removeSource(notebook.id, source.id)}
                          >
                            <Trash2 />
                            Entfernen
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
