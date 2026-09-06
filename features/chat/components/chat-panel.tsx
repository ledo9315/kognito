'use client'

import { useRef, useState, useTransition } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { NotebookPen, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/features/notebooks/components/notebook-store'
import { AnswerText } from '@/features/chat/components/answer-text'
import { AppLogo } from '@/components/app-logo'
import { AIContextMeter } from '@/components/ui/ai-context-meter'
import { AIConversation } from '@/components/ui/ai-conversation'
import { AILoader } from '@/components/ui/ai-loader'
import { AIMessage } from '@/components/ui/ai-message'
import { AIPromptInput } from '@/components/ui/ai-prompt-input'
import { AISources, type AISource } from '@/components/ui/ai-sources'
import { AISuggestions } from '@/components/ui/ai-suggestions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Kbd } from '@/components/ui/kbd'
import { Marker, MarkerContent } from '@/components/ui/marker'
import {
  clearChatAction,
  suggestFollowUpsAction,
} from '@/features/chat/chat-actions'
import { maxPromptCharacters } from '@/lib/config'
import type { Citation } from '@/lib/db/schema'
import type { MessageRow } from '@/features/chat/messages'
import { createNoteAction } from '@/features/sources/note-actions'
import { sourceLabel } from '@/features/sources/source-label'
import { SourceIcon, sourceKindLabel } from '@/features/sources/components/source-icon'
import type { SourceItem } from '@/features/sources/sources'

/** What an empty chat offers, so the first question is one click away. */
const suggestedQuestions = [
  'Fasse die Kernaussagen aller Quellen zusammen',
  'Wo widersprechen sich die Quellen?',
  'Welche Zahlen sollte ich mir merken?',
  'Erstelle eine Gliederung für einen Vortrag',
]

type ChatMessage = UIMessage<{ citations: Citation[]; omitted?: number }>

function toUIMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
    metadata: { citations: row.citations },
  }
}

function extractMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
}

function getUserFriendlyErrorMessage(error: Error) {
  try {
    const parsed = JSON.parse(error.message)
    if (typeof parsed?.error === 'string') return parsed.error
  } catch {
    // Not one of our own responses.
  }
  return 'Die Antwort konnte nicht geladen werden. Bitte versuche es noch einmal.'
}

/**
 * The sources an answer cites, one entry per source however many passages it
 * quotes, in the order of first mention.
 */
function citedSources(
  citations: Citation[] | undefined,
  sources: SourceItem[],
): AISource[] {
  const seen = new Set<string>()
  const result: AISource[] = []
  for (const citation of citations ?? []) {
    if (seen.has(citation.sourceId)) continue
    seen.add(citation.sourceId)
    const source = sources.find((candidate) => candidate.id === citation.sourceId)
    if (!source) continue
    result.push({
      id: source.id,
      title: source.title,
      snippet: sourceKindLabel[source.kind],
      icon: <SourceIcon kind={source.kind} />,
    })
  }
  return result
}

export function ChatPanel() {
  const { notebook, sources, history, openSource } = useNotebookStore()
  const [draft, setDraft] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [clearing, startClearing] = useTransition()
  const [saving, startSaving] = useTransition()
  /** The questions under the newest answer, written after it has arrived. */
  const [followUps, setFollowUps] = useState<string[]>([])
  /** The question of the running turn. onFinish hands over the answer alone,
   *  and the suggestions are written from both halves. */
  const asked = useRef<string | null>(null)

  const { messages, sendMessage, status, setMessages, stop } =
    useChat<ChatMessage>({
      messages: history.map(toUIMessage),
      transport: new DefaultChatTransport({ api: '/api/chat' }),
      onError: (error) => setFailure(getUserFriendlyErrorMessage(error)),
      onFinish: ({ message }) => {
        const question = asked.current
        if (!question) return
        void suggestFollowUpsAction(
          question,
          extractMessageText(message),
        ).then(setFollowUps)
      },
    })

  const selected = sources.filter((source) => source.selected)
  const selectedCount = selected.length
  /** What the selected sources take of the prompt. Full context, so this is
   *  exactly the text the next question carries along. */
  const contextUsed = selected.reduce(
    (total, source) => total + (source.content?.length ?? 0),
    0,
  )
  const busy = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  const latest = messages.at(-1)
  const latestText = latest ? extractMessageText(latest) : ''
  const waiting = busy && (latest?.role !== 'assistant' || latestText === '')

  function send(question: string) {
    const value = question.trim()

    if (!value || busy || selectedCount === 0) return
    setDraft('')
    setFailure(null)
    setFollowUps([])
    asked.current = value
    void sendMessage(
      { text: value },
      {
        body: {
          notebookId: notebook.id,
          sourceIds: selected.map((source) => source.id),
        },
      },
    )
  }

  function saveAsNote(content: string) {
    startSaving(async () => {
      const result = await createNoteAction(
        notebook.id,
        'Aus dem Chat gespeichert',
        content,
      )
      if (result) {
        toast.error(result.error)
        return
      }
      toast.success('Als Notiz gespeichert')
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-13 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-medium">Chat</h2>
          <Badge variant="secondary" className="font-normal">
            {sourceLabel(selectedCount)} aktiv
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <AIContextMeter
            used={contextUsed}
            limit={maxPromptCharacters}
            unit="Zeichen"
            breakdown={selected.map((source) => ({
              label: source.title,
              amount: source.content?.length ?? 0,
            }))}
          />
          {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || clearing}
            onClick={() =>
              startClearing(async () => {
                await clearChatAction(notebook.id)
                setMessages([])
                setFailure(null)
                setFollowUps([])
              })
            }
          >
            <RotateCcw data-icon="inline-start" />
            Neu starten
          </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
            <AppLogo className="scale-125" />
            <div className="flex max-w-md flex-col gap-2">
              <h3 className="text-xl font-medium tracking-tight text-balance">
                {notebook.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {selectedCount > 0
                  ? `${sourceLabel(selectedCount)} ${selectedCount === 1 ? 'ist' : 'sind'} bereit. Stelle eine Frage. Jede Aussage wird mit einer Belegstelle versehen.`
                  : 'Wähle mindestens eine Quelle aus, damit Antworten belegt werden können.'}
              </p>
            </div>
            <AISuggestions
              className="max-w-lg [&_ul]:justify-center"
              suggestions={suggestedQuestions}
              disabled={selectedCount === 0}
              onSelect={send}
            />
          </div>
        ) : (
          <AIConversation
            className="flex-1"
            // Everything that makes the thread longer, so the view follows
            // a streaming answer as well as a new failure line.
            contentKey={`${messages.length}-${latestText.length}-${status}-${followUps.length}-${failure ? 1 : 0}`}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
              <Marker variant="separator">
                <MarkerContent>
                  Antworten basieren auf {sourceLabel(selectedCount)}
                </MarkerContent>
              </Marker>

              {messages.map((message) => {
                const content = extractMessageText(message)

                if (message.role === 'assistant' && !content) return null

                if (message.role === 'user') {
                  return (
                    <AIMessage key={message.id} from="user">
                      {content}
                    </AIMessage>
                  )
                }

                const isLatest = message.id === latest?.id
                const cited = citedSources(message.metadata?.citations, sources)

                return (
                  <AIMessage
                    key={message.id}
                    from="assistant"
                    bubble={false}
                    copyText={content}
                    actions={[
                      {
                        key: 'note',
                        label: 'Als Notiz speichern',
                        icon: NotebookPen,
                        disabled: saving,
                        onClick: () => saveAsNote(content),
                      },
                    ]}
                  >
                    <div className="flex flex-col gap-3">
                      <AnswerText
                        content={content}
                        citations={message.metadata?.citations}
                        streaming={isLatest && busy}
                        onCitationClick={(citation) =>
                          openSource(citation.sourceId, {
                            charStart: citation.charStart,
                            charEnd: citation.charEnd,
                          })
                        }
                      />

                      {cited.length > 0 && !(isLatest && busy) ? (
                        <AISources
                          sources={cited}
                          onSelect={(source) => openSource(source.id)}
                        />
                      ) : null}

                      {message.metadata?.omitted ? (
                        <p className="text-xs text-muted-foreground">
                          Hinweis: {message.metadata.omitted}{' '}
                          {message.metadata.omitted === 1
                            ? 'Abschnitt passte'
                            : 'Abschnitte passten'}{' '}
                          nicht mehr in die Anfrage und wurden nicht gelesen.
                        </p>
                      ) : null}

                      {/* Only under the newest answer. Older ones had their
                          suggestions when they were new, and the question that
                          followed is right below them. */}
                      {isLatest && followUps.length > 0 ? (
                        <AISuggestions
                          className="pt-1"
                          label="Weiterfragen"
                          suggestions={followUps}
                          disabled={busy || selectedCount === 0}
                          onSelect={send}
                        />
                      ) : null}
                    </div>
                  </AIMessage>
                )
              })}

              {failure && (
                <AIMessage from="assistant" bubble={false}>
                  <p role="alert" className="text-sm text-destructive">
                    {failure}
                  </p>
                </AIMessage>
              )}

              {waiting && (
                <AIMessage from="assistant" bubble={false}>
                  <AILoader label="Quellen werden durchsucht" showElapsed />
                </AIMessage>
              )}
            </div>
          </AIConversation>
        )}

        <div className="border-t border-border px-4 py-3">
          <div className="mx-auto w-full max-w-3xl">
            <AIPromptInput
              value={draft}
              onValueChange={setDraft}
              onSubmit={send}
              onStop={() => void stop()}
              state={busy ? 'streaming' : 'idle'}
              disabled={selectedCount === 0}
              placeholder={
                selectedCount === 0
                  ? 'Wähle zuerst eine Quelle aus…'
                  : 'Stelle eine Frage zu deinen Quellen…'
              }
            >
              {/* A phone keyboard has no Shift + Enter, and the line costs
                  more than it explains there. */}
              <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                <Kbd>Enter</Kbd>
                <span>senden</span>
                <span aria-hidden="true">·</span>
                <Kbd>Shift + Enter</Kbd>
                <span>Zeilenumbruch</span>
              </span>
            </AIPromptInput>
          </div>
        </div>
      </div>
    </div>
  )
}
