'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Files, MessageSquare, Wand2 } from 'lucide-react'
import {
  NotebookStoreProvider,
  useNotebookStore,
} from '@/components/notebook-store'
import { AppLogo } from '@/components/app-logo'
import { ArtifactReader } from '@/components/artifact-reader'
import { ChatPanel } from '@/components/chat-panel'
import { NotebookTitle } from '@/components/notebook-title'
import { SourcesPanel } from '@/components/sources-panel'
import { SourceReader } from '@/components/source-reader'
import { StudioPanel } from '@/components/studio-panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ArtifactRow } from '@/lib/artifacts'
import type { MessageRow } from '@/lib/messages'
import type { NotebookRow } from '@/lib/notebooks'
import type { SourceItem } from '@/lib/sources'
import { cn } from '@/lib/utils'

type MobileTab = 'sources' | 'chat' | 'studio'

export function NotebookWorkspace({
  notebook,
  sources,
  history,
  artifacts,
}: {
  notebook: NotebookRow
  sources: SourceItem[]
  history: MessageRow[]
  artifacts: ArtifactRow[]
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
      history={history}
      artifacts={artifacts}
    >
      <Workspace />
    </NotebookStoreProvider>
  )
}

function Workspace() {
  const { notebook, sources, openSourceId, openArtifactId, openSource, openArtifact } =
    useNotebookStore()
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat')

  const readerOpen = Boolean(openSourceId) || Boolean(openArtifactId)
  const reader = openArtifactId ? <ArtifactReader /> : <SourceReader />

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-indigo-100/60">
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

        <NotebookTitle
          notebookId={notebook.id}
          title={notebook.title}
          emoji={notebook.emoji}
        />

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
            // no width transition: the reader scrolls to the cited passage on
            // mount, and an animated width measures the old, narrower layout
            'shrink-0 overflow-hidden rounded-xl border border-border bg-background',
            readerOpen ? 'w-104' : 'w-80',
          )}
        >
          {readerOpen ? reader : <StudioPanel />}
        </aside>
      </div>

      {/* Mobile / tablet: tabs */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {/* The reader covers whichever tab is open. Tapping a source in the
            sources tab used to mark it as open and show nothing, because the
            reader only lived in the chat tab. */}
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          {readerOpen ? (
            reader
          ) : (
            <>
              {mobileTab === 'sources' && <SourcesPanel />}
              {mobileTab === 'chat' && <ChatPanel />}
              {mobileTab === 'studio' && <StudioPanel />}
            </>
          )}
        </div>

        <nav className="flex shrink-0 justify-center border-t border-border bg-background px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[mobileTab]}
            onValueChange={(next) => {
              if (!next[0]) return
              openSource(null)
              openArtifact(null)
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
