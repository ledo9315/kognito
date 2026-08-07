'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { NewNotebookDialog } from '@/components/new-notebook-dialog'

export function NotebookGrid() {
  const { notebooks } = useNotebookStore()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const filteredNotebooks = notebooks.filter((notebook) =>
    notebook.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Zuletzt bearbeitet
          </h2>
          <Badge variant="secondary">{notebooks.length}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <InputGroup className="h-9 sm:w-64">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Notizbücher durchsuchen"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Notizbücher durchsuchen"
            />
          </InputGroup>

          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[view]}
            onValueChange={(next) => {
              if (next[0]) setView(next[0] as 'grid' | 'list')
            }}
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="grid" aria-label="Rasteransicht">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Listenansicht">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {filteredNotebooks.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>Keine Treffer</EmptyTitle>
            <EmptyDescription>
              Für „{query}“ wurde kein Notizbuch gefunden.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NewNotebookDialog
            onCreated={(id) => router.push(`/notebook/${id}`)}
            trigger={
              <button
                type="button"
                className="group flex min-h-40 flex-col items-start justify-between rounded-xl border border-dashed border-border bg-transparent p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[15px] font-medium">
                    Neues Notizbuch
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Quellen hinzufügen und loslegen
                  </span>
                </span>
              </button>
            }
          />

          {filteredNotebooks.map((notebook) => (
            <Link
              key={notebook.id}
              href={`/notebook/${notebook.id}`}
              className="group flex min-h-40 flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {notebook.emoji}
              </span>
              <span className="flex flex-col gap-2">
                <span className="text-[15px] leading-snug font-medium text-pretty text-card-foreground">
                  {notebook.title}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{notebook.updatedLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {notebook.sources.length}{' '}
                    {notebook.sources.length === 1 ? 'Quelle' : 'Quellen'}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {filteredNotebooks.map((notebook) => (
            <Link
              key={notebook.id}
              href={`/notebook/${notebook.id}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {notebook.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {notebook.title}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {notebook.sources.length}{' '}
                {notebook.sources.length === 1 ? 'Quelle' : 'Quellen'}
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {notebook.updatedLabel}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-2 sm:hidden">
        <NewNotebookDialog
          onCreated={(id) => router.push(`/notebook/${id}`)}
          trigger={
            <Button>
              <Plus data-icon="inline-start" />
              Neues Notizbuch
            </Button>
          }
        />
      </div>
    </div>
  )
}
