'use client'

import * as React from 'react'
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
import { suggestedQuestions, type Notebook } from '@/lib/data'

export function ChatPanel({ notebook }: { notebook: Notebook }) {
  const { askQuestion, clearChat, openSource, state, addNote } =
    useNotebookStore()
  const [draft, setDraft] = React.useState('')

  const selectedCount = notebook.sources.filter((s) => s.selected).length
  const isEmpty = notebook.messages.length === 0

  async function send(question: string) {
    const value = question.trim()
    if (!value || state.thinking) return
    setDraft('')
    await askQuestion(notebook.id, value)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
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
            onClick={() => clearChat(notebook.id)}
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
                <button
                  key={question}
                  type="button"
                  onClick={() => send(question)}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-[13px] transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <Sparkles
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {question}
                </button>
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

                  {notebook.messages.map((message) => (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.role === 'user'}
                    >
                      {message.role === 'user' ? (
                        <Message align="end">
                          <MessageContent>
                            <Bubble align="end">
                              <BubbleContent>{message.content}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      ) : (
                        <Message align="start">
                          <MessageContent>
                            <Bubble variant="ghost" align="start">
                              <BubbleContent>
                                <AnswerText
                                  content={message.content}
                                  citations={message.citations}
                                  onCitationClick={(citation) =>
                                    openSource(citation.sourceId)
                                  }
                                />
                              </BubbleContent>
                            </Bubble>
                            <MessageFooter className="gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard?.writeText(
                                    message.content,
                                  )
                                  toast.success('Antwort kopiert')
                                }}
                              >
                                <Copy data-icon="inline-start" />
                                Kopieren
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  addNote(
                                    notebook.id,
                                    'Aus dem Chat gespeichert',
                                    message.content,
                                  )
                                  toast.success('Als Notiz gespeichert')
                                }}
                              >
                                <NotebookPen data-icon="inline-start" />
                                Als Notiz
                              </Button>
                            </MessageFooter>
                          </MessageContent>
                        </Message>
                      )}
                    </MessageScrollerItem>
                  ))}

                  {state.thinking && (
                    <MessageScrollerItem messageId="thinking">
                      <Message align="start">
                        <MessageContent>
                          <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span
                              aria-hidden="true"
                              className="flex items-end gap-0.5"
                            >
                              {[0, 1, 2, 3].map((i) => (
                                <span
                                  key={i}
                                  className="animate-wave h-3 w-0.5 origin-bottom rounded-full bg-primary/60"
                                  style={{ animationDelay: `${i * 0.13}s` }}
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
                  disabled={!draft.trim() || state.thinking}
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
