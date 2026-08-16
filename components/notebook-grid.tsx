'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LayoutGrid, List, NotebookPen, Plus, Search } from 'lucide-react'
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
import { NotebookEmoji } from '@/components/notebook-emoji'
import { NotebookMenu } from '@/components/notebook-menu'
import type { NotebookSummary } from '@/lib/notebooks'

type NotebookCard = NotebookSummary & { updatedLabel: string }

function sourceLabel(count: number) {
  return `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`
}

export function NotebookGrid({ notebooks }: { notebooks: NotebookCard[] }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const filteredNotebooks = notebooks.filter((notebook) =>
    notebook.title.toLowerCase().includes(query.trim().toLowerCase()),
  )

  if (notebooks.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPen />
          </EmptyMedia>
          <EmptyTitle>Noch kein Notizbuch</EmptyTitle>
          <EmptyDescription>
            Lege ein Notizbuch an, sammle darin deine Quellen und stelle Fragen
            dazu.
          </EmptyDescription>
        </EmptyHeader>
        <NewNotebookDialog
          trigger={
            <Button className="mx-auto">
              <Plus data-icon="inline-start" />
              Neues Notizbuch
            </Button>
          }
        />
      </Empty>
    )
  }

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
            trigger={
              <button
                type="button"
                className="group flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed sm:gap-6 border-border bg-transparent p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-40"
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
            <div
              key={notebook.id}
              className="group relative flex flex-col justify-between gap-4 rounded-xl border border-border sm:gap-6 bg-card p-5 transition-all sm:min-h-40 hover:border-primary/30 hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] focus-within:ring-[3px] focus-within:ring-ring/40"
            >
              <NotebookEmoji
                notebookId={notebook.id}
                title={notebook.title}
                emoji={notebook.emoji}
                className="relative z-10 size-10 self-start text-2xl"
              />

              <NotebookMenu
                notebookId={notebook.id}
                title={notebook.title}
                emoji={notebook.emoji}
                className="absolute top-3 right-3 z-10 text-muted-foreground"
              />

              <span className="flex flex-col gap-2">
                {/* The link covers the card, so the whole tile is clickable
                    without holding the menu button inside an anchor. */}
                <Link
                  href={`/notebook/${notebook.id}`}
                  className="text-[15px] leading-snug font-medium text-pretty text-card-foreground after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {notebook.title}
                </Link>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{notebook.updatedLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{sourceLabel(notebook.sourceCount)}</span>
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {filteredNotebooks.map((notebook) => (
            <div
              key={notebook.id}
              className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/50 focus-within:ring-[3px] focus-within:ring-ring/40"
            >
              <NotebookEmoji
                notebookId={notebook.id}
                title={notebook.title}
                emoji={notebook.emoji}
                className="relative z-10 size-8 text-lg"
              />
              <Link
                href={`/notebook/${notebook.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none"
              >
                {notebook.title}
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {sourceLabel(notebook.sourceCount)}
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {notebook.updatedLabel}
              </span>
              <NotebookMenu
                notebookId={notebook.id}
                title={notebook.title}
                emoji={notebook.emoji}
                className="relative z-10 text-muted-foreground"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
