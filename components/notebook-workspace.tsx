'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Files, MessageSquare, Wand2 } from 'lucide-react'
import {
  NotebookStoreProvider,
  useNotebookStore,
} from '@/components/notebook-store'
import { AppLogo } from '@/components/app-logo'
import { ChatPanel } from '@/components/chat-panel'
import { SourcesPanel } from '@/components/sources-panel'
import { SourceReader } from '@/components/source-reader'
import { StudioPanel } from '@/components/studio-panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { NotebookRow } from '@/lib/notebooks'
import type { SourceItem } from '@/lib/sources'
import { cn } from '@/lib/utils'

type MobileTab = 'sources' | 'chat' | 'studio'

export function NotebookWorkspace({
  notebook,
  sources,
}: {
  notebook: NotebookRow
  sources: SourceItem[]
}) {
  return (
    <NotebookStoreProvider
      key={notebook.id}
      notebook={{
        id: notebook.id,
        title: notebook.title,
        emoji: notebook.emoji,
      }}
      sources={sources}
    >
      <Workspace />
    </NotebookStoreProvider>
  )
}

function Workspace() {
  const { notebook, sources, openSourceId, openSource } = useNotebookStore()
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')

  const readerOpen = Boolean(openSourceId)

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

        <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />

        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="shrink-0 text-base leading-none">
            {notebook.emoji}
          </span>
          <h1 className="truncate text-sm font-medium">{notebook.title}</h1>
        </div>

        <Badge variant="outline" className="ml-auto hidden font-normal lg:flex">
          {sources.length} {sources.length === 1 ? 'Quelle' : 'Quellen'}
        </Badge>
      </header>

      {/* Desktop: three columns */}
      <div className="hidden min-h-0 flex-1 gap-2 p-2 lg:flex">
        <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
          <SourcesPanel />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-background">
          <ChatPanel />
        </main>

        <aside
          className={cn(
            'shrink-0 overflow-hidden rounded-xl border border-border bg-background transition-all',
            readerOpen ? 'w-104' : 'w-80',
          )}
        >
          {readerOpen ? <SourceReader /> : <StudioPanel />}
        </aside>
      </div>

      {/* Mobile / tablet: tabs */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          {mobileTab === 'sources' && <SourcesPanel />}
          {mobileTab === 'chat' && (readerOpen ? <SourceReader /> : <ChatPanel />)}
          {mobileTab === 'studio' && <StudioPanel />}
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
