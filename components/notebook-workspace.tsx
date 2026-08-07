'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Files, MessageSquare, Wand2 } from 'lucide-react'
import { useNotebookStore } from '@/components/notebook-store'
import { AppLogo } from '@/components/app-logo'
import { ChatPanel } from '@/components/chat-panel'
import { SourcesPanel } from '@/components/sources-panel'
import { SourceReader } from '@/components/source-reader'
import { StudioPanel } from '@/components/studio-panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type MobileTab = 'sources' | 'chat' | 'studio'

export function NotebookWorkspace({ notebookId }: { notebookId: string }) {
  const { getNotebook, state, openSource } = useNotebookStore()
  const notebook = getNotebook(notebookId)
  const [mobileTab, setMobileTab] = React.useState<MobileTab>('chat')

  if (!notebook) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Empty className="max-w-sm border border-dashed">
          <EmptyHeader>
            <EmptyTitle>Notizbuch nicht gefunden</EmptyTitle>
            <EmptyDescription>
              Dieses Notizbuch existiert nicht oder wurde entfernt.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="outline"
            className="mx-auto"
          >
            <ArrowLeft data-icon="inline-start" />
            Zur Übersicht
          </Button>
        </Empty>
      </div>
    )
  }

  const readerOpen = Boolean(state.openSourceId)

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-muted/40">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3 sm:px-4">
        <Button
          render={<Link href="/" aria-label="Zur Übersicht" />}
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
        >
          <ArrowLeft />
        </Button>

        <div className="hidden sm:block">
          <AppLogo />
        </div>

        <span
          aria-hidden="true"
          className="hidden h-5 w-px bg-border sm:block"
        />

        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="shrink-0 text-base leading-none">
            {notebook.emoji}
          </span>
          <h1 className="truncate text-sm font-medium">{notebook.title}</h1>
        </div>

        <Badge variant="outline" className="ml-auto hidden font-normal lg:flex">
          {notebook.sources.length}{' '}
          {notebook.sources.length === 1 ? 'Quelle' : 'Quellen'}
        </Badge>
      </header>

      {/* Desktop: three columns */}
      <div className="hidden min-h-0 flex-1 gap-2 p-2 lg:flex">
        <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
          <SourcesPanel notebook={notebook} />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-background">
          <ChatPanel notebook={notebook} />
        </main>

        <aside
          className={cn(
            'shrink-0 overflow-hidden rounded-xl border border-border bg-background transition-all',
            readerOpen ? 'w-104' : 'w-80',
          )}
        >
          {readerOpen ? (
            <SourceReader notebook={notebook} />
          ) : (
            <StudioPanel notebook={notebook} />
          )}
        </aside>
      </div>

      {/* Mobile / tablet: tabs */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          {mobileTab === 'sources' && <SourcesPanel notebook={notebook} />}
          {mobileTab === 'chat' &&
            (readerOpen ? (
              <SourceReader notebook={notebook} />
            ) : (
              <ChatPanel notebook={notebook} />
            ))}
          {mobileTab === 'studio' && <StudioPanel notebook={notebook} />}
        </div>

        <nav className="flex shrink-0 justify-center border-t border-border bg-background px-3 py-2">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[mobileTab]}
            onValueChange={(next) => {
              if (!next[0]) return
              openSource(null)
              setMobileTab(next[0] as MobileTab)
            }}
          >
            <ToggleGroupItem value="sources">
              <Files data-icon="inline-start" />
              Quellen
            </ToggleGroupItem>
            <ToggleGroupItem value="chat">
              <MessageSquare data-icon="inline-start" />
              Chat
            </ToggleGroupItem>
            <ToggleGroupItem value="studio">
              <Wand2 data-icon="inline-start" />
              Studio
            </ToggleGroupItem>
          </ToggleGroup>
        </nav>
      </div>
    </div>
  )
}
