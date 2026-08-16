'use client'

import { MoreHorizontal, Plus, Trash2, FileSearch, TriangleAlert } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { SourceIcon, sourceKindLabel } from '@/components/source-icon'
import { AddSourceDialog } from '@/components/add-source-dialog'
import { Badge } from '@/components/ui/badge'
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
import { deleteSourceAction } from '@/lib/source-actions'
import { cn } from '@/lib/utils'

export function SourcesPanel() {
  const { notebook, sources, openSourceId, openSource, selectSource, selectAllSources } =
    useNotebookStore()

  const selectedCount = sources.filter((source) => source.selected).length
  const allSelected = sources.length > 0 && selectedCount === sources.length

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-13 items-center justify-between gap-2 border-b border-border px-4 py-3">
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

      {sources.length === 0 ? (
        <div className="group relative flex flex-1 items-center p-4">
          <Empty className="border border-dashed transition-colors group-hover:border-primary/40 group-hover:bg-accent/40">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileSearch />
              </EmptyMedia>
              <EmptyTitle>Noch keine Quellen</EmptyTitle>
              <EmptyDescription>
                Füge ein PDF, eine Textdatei oder eine Website hinzu, damit
                Kognito antworten kann.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>

          {/* The button covers the empty state instead of holding it: the
              text is made of divs, which a button may not contain. */}
          <AddSourceDialog
            notebookId={notebook.id}
            trigger={
              <button
                type="button"
                className="absolute inset-4 rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="sr-only">Quelle hinzufügen</span>
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                onCheckedChange={(checked) => selectAllSources(Boolean(checked))}
                aria-label="Alle Quellen auswählen"
              />
              Alle auswählen
            </label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {selectedCount}/{sources.length}
            </span>
          </div>

          <ul className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
            {sources.map((source) => {
              const isOpen = openSourceId === source.id
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
                      onCheckedChange={(checked) =>
                        selectSource(source.id, Boolean(checked))
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
                      {source.summary ? (
                        <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {source.summary}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="[&_svg]:size-3">
                          <SourceIcon kind={source.kind} />
                        </span>
                        <span>{sourceKindLabel[source.kind]}</span>
                        {source.status === 'ready' ? null : (
                          <>
                            <span aria-hidden="true">·</span>
                            <SourceStatus status={source.status} />
                          </>
                        )}
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
                          <DropdownMenuItem onClick={() => openSource(source.id)}>
                            Quelle öffnen
                          </DropdownMenuItem>
                          <form
                            action={deleteSourceAction}
                            onSubmit={() => {
                              if (isOpen) openSource(null)
                            }}
                          >
                            <input type="hidden" name="sourceId" value={source.id} />
                            <input type="hidden" name="notebookId" value={notebook.id} />
                            <DropdownMenuItem
                              variant="destructive"
                              nativeButton
                              render={<button type="submit" className="w-full" />}
                            >
                              <Trash2 />
                              Entfernen
                            </DropdownMenuItem>
                          </form>
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

function SourceStatus({ status }: { status: 'processing' | 'failed' }) {
  if (status === 'failed') {
    return (
      <Badge variant="destructive" className="h-4 gap-1 px-1.5 font-normal">
        <TriangleAlert className="size-2.5" aria-hidden="true" />
        Fehlgeschlagen
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="h-4 px-1.5 font-normal">
      Wird gelesen
    </Badge>
  )
}
