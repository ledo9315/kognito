'use client'

import { useRef, useState, useTransition } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { ArrowUp, Copy, NotebookPen, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useNotebookStore } from '@/components/notebook-store'
import { AnswerText } from '@/components/answer-text'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Kbd } from '@/components/ui/kbd'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Marker, MarkerContent } from '@/components/ui/marker'
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import {
  clearChatAction,
  suggestFollowUpsAction,
} from '@/lib/chat-actions'
import { suggestedQuestions } from '@/lib/data'
import type { Citation } from '@/lib/db/schema'
import type { MessageRow } from '@/lib/messages'
import { createNoteAction } from '@/lib/note-actions'

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

function SuggestionButton({
  question,
  disabled,
  onClick,
}: {
  question: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-[13px] transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
    >
      <Sparkles
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      {question}
    </button>
  )
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

  const { messages, sendMessage, status, setMessages } = useChat<ChatMessage>(
    {
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
    }
  )

  const selected = sources.filter((source) => source.selected)
  const selectedCount = selected.length
  const busy = status === 'submitted' || status === 'streaming'
  const isEmpty = messages.length === 0

  const latest = messages.at(-1)
  const waiting = busy && (latest?.role !== 'assistant' || extractMessageText(latest) === '')

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-13 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-medium">Chat</h2>
          <Badge variant="secondary" className="font-normal">
            {selectedCount} {selectedCount === 1 ? 'Quelle' : 'Quellen'} aktiv
          </Badge>
        </div>
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
                  ? `${selectedCount} ${selectedCount === 1 ? 'Quelle ist' : 'Quellen sind'} bereit. Stelle eine Frage. Jede Aussage wird mit einer Belegstelle versehen.`
                  : 'Wähle links mindestens eine Quelle aus, damit Antworten belegt werden können.'}
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2">
              {suggestedQuestions.map((question) => (
                <SuggestionButton
                  key={question}
                  question={question}
                  disabled={selectedCount === 0}
                  onClick={() => send(question)}
                />
              ))}
            </div>
          </div>
        ) : (
          <MessageScrollerProvider autoScroll>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-8 px-4 py-6">
                  <Marker variant="separator">
                    <MarkerContent>
                      Antworten basieren auf {selectedCount}{' '}
                      {selectedCount === 1 ? 'Quelle' : 'Quellen'}
                    </MarkerContent>
                  </Marker>

                  {messages.map((message) => {
                    const content = extractMessageText(message)

                    if (message.role === 'assistant' && !content) return null

                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.role === 'user'}
                      >
                        {message.role === 'user' ? (
                          <Message align="end">
                            <MessageContent>
                              <Bubble align="end">
                                <BubbleContent>{content}</BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        ) : (
                          <Message align="start">
                            <MessageContent>
                              <Bubble variant="ghost" align="start">
                                <BubbleContent>
                                  <AnswerText
                                    content={content}
                                    citations={message.metadata?.citations}
                                    onCitationClick={(citation) =>
                                      openSource(citation.sourceId, {
                                        charStart: citation.charStart,
                                        charEnd: citation.charEnd,
                                      })
                                    }
                                  />
                                </BubbleContent>
                              </Bubble>
                              {message.metadata?.omitted ? (
                                <p className="text-xs text-muted-foreground">
                                  Hinweis: {message.metadata.omitted}{' '}
                                  {message.metadata.omitted === 1
                                    ? 'Abschnitt passte'
                                    : 'Abschnitte passten'}{' '}
                                  nicht mehr in die Anfrage und wurden nicht
                                  gelesen.
                                </p>
                              ) : null}

                              <MessageFooter className="gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(content)
                                    toast.success('Antwort kopiert')
                                  }}
                                >
                                  <Copy data-icon="inline-start" />
                                  Kopieren
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={saving}
                                  onClick={() =>
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
                                >
                                  <NotebookPen data-icon="inline-start" />
                                  Als Notiz
                                </Button>
                              </MessageFooter>

                              {/* Only under the newest answer. Older ones had
                                  their suggestions when they were new, and the
                                  question that followed is right below them. */}
                              {message.id === latest?.id &&
                              followUps.length > 0 ? (
                                <div className="flex flex-col items-start gap-2 pt-1">
                                  <span className="text-xs text-muted-foreground">
                                    Weiterfragen
                                  </span>
                                  {followUps.map((question) => (
                                    <SuggestionButton
                                      key={question}
                                      question={question}
                                      disabled={busy || selectedCount === 0}
                                      onClick={() => send(question)}
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </MessageContent>
                          </Message>
                        )}
                      </MessageScrollerItem>
                    )
                  })}

                  {failure && (
                    <MessageScrollerItem messageId="failure">
                      <Message align="start">
                        <MessageContent>
                          <p role="alert" className="text-sm text-destructive">
                            {failure}
                          </p>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  )}

                  {waiting && (
                    <MessageScrollerItem messageId="thinking">
                      <Message align="start">
                        <MessageContent>
                          <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span
                              aria-hidden="true"
                              className="flex items-end gap-0.5"
                            >
                              {[0, 1, 2, 3].map((index) => (
                                <span
                                  key={index}
                                  className="animate-wave h-3 w-0.5 origin-bottom rounded-full bg-primary/60"
                                  style={{ animationDelay: `${index * 0.13}s` }}
                                />
                              ))}
                            </span>
                            Quellen werden durchsucht…
                          </span>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}

        <div className="border-t border-border px-4 py-3">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              send(draft)
            }}
            className="mx-auto w-full max-w-3xl"
          >
            <InputGroup>
              <InputGroupTextarea
                rows={2}
                disabled={selectedCount === 0}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                  ) {
                    event.preventDefault()
                    send(draft)
                  }
                }}
                placeholder={
                  selectedCount === 0
                    ? 'Wähle zuerst eine Quelle aus…'
                    : 'Stelle eine Frage zu deinen Quellen…'
                }
                aria-label="Frage eingeben"
              />
              <InputGroupAddon align="block-end">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Kbd>Enter</Kbd>
                  <span>senden</span>
                  <span aria-hidden="true">·</span>
                  <Kbd>Shift + Enter</Kbd>
                  <span className="hidden sm:inline">Zeilenumbruch</span>
                </span>
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ml-auto"
                  disabled={!draft.trim() || busy || selectedCount === 0}
                  aria-label="Frage senden"
                >
                  <ArrowUp />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </div>
  )
}
