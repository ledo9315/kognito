'use client'

import { Check, Copy, type LucideIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const COPIED_RESET_MS = 1600
const ACTION_STAGGER_MS = 30

export type AIMessageAuthor = 'user' | 'assistant'

export type AIMessageAction = {
  key: string
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
}

export type AIMessageProps = {
  /** Rendered to the side of the bubble. */
  avatar?: ReactNode
  /**
   * Draw the tinted bubble. Off for assistant turns, whose answer text and
   * follow-ups carry their own surfaces: a bubble around them reads as a box
   * inside a box.
   */
  bubble?: boolean
  children: ReactNode
  className?: string
  /** Plain text handed to the clipboard. Omit to hide the copy action. */
  copyText?: string
  /** Further actions after the copy button, e.g. saving as a note. */
  actions?: AIMessageAction[]
  /**
   * Who wrote it. Named `from` rather than `role` on purpose: `role` is an
   * ARIA attribute, and a prop of that name misleads readers and linters.
   */
  from?: AIMessageAuthor
}

/**
 * A chat message with actions that stay out of the way. The action row slides
 * out of the bubble's own edge on hover and on focus-within, because a
 * hover-only row is unreachable by keyboard. The reveal is CSS in
 * globals.css under `.ai-message-action`, so it cannot desync from the
 * pointer. Adapted from SmoothUI's ai-message.
 */
export function AIMessage({
  avatar,
  bubble = true,
  children,
  className,
  copyText,
  actions = [],
  from = 'assistant',
}: AIMessageProps) {
  const [hasCopied, setHasCopied] = useState(false)
  const isUser = from === 'user'

  useEffect(() => {
    if (!hasCopied) return
    const timeout = setTimeout(() => setHasCopied(false), COPIED_RESET_MS)
    return () => clearTimeout(timeout)
  }, [hasCopied])

  async function copy() {
    if (!copyText) return
    try {
      await navigator.clipboard.writeText(copyText)
      setHasCopied(true)
    } catch {
      // A blocked clipboard is not worth interrupting the conversation over.
    }
  }

  const allActions: AIMessageAction[] = [
    ...(copyText
      ? [
          {
            key: 'copy',
            label: hasCopied ? 'Kopiert' : 'Kopieren',
            icon: hasCopied ? Check : Copy,
            onClick: copy,
          },
        ]
      : []),
    ...actions,
  ]

  return (
    <div
      className={cn(
        // The reveal is scoped to this class rather than Tailwind's `group`,
        // so a `group` ancestor elsewhere cannot reveal every row at once.
        'ai-message-root flex w-full gap-2.5',
        isUser ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
    >
      {avatar ? <div className="mt-0.5 shrink-0">{avatar}</div> : null}

      <div className={cn('flex min-w-0 flex-col gap-1', isUser && 'items-end')}>
        <div
          className={cn(
            'w-fit max-w-prose min-w-0 text-sm leading-relaxed wrap-break-word',
            bubble && 'rounded-2xl px-3.5 py-2.5',
            bubble && isUser && 'rounded-br-md bg-primary text-primary-foreground',
            bubble && !isUser && 'rounded-bl-md bg-muted text-foreground',
            !bubble && 'w-full text-foreground',
          )}
        >
          {children}
        </div>

        {allActions.length > 0 ? (
          // Always mounted, only faded: mounting on hover changed the height,
          // and every message below jumped as the pointer moved down a thread.
          <div
            className={cn(
              'flex items-center gap-1 px-1',
              isUser ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {allActions.map((action, index) => {
              const Icon = action.icon
              const active = action.key === 'copy' && hasCopied
              return (
                <button
                  key={action.key}
                  type="button"
                  aria-label={action.label}
                  title={action.label}
                  disabled={action.disabled}
                  onClick={action.onClick}
                  style={{ transitionDelay: `${index * ACTION_STAGGER_MS}ms` }}
                  className={cn(
                    'ai-message-action cursor-pointer rounded-lg p-1.5 disabled:pointer-events-none disabled:opacity-50',
                    isUser ? 'ai-message-action-user' : 'ai-message-action-agent',
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon
                    key={active ? 'copied' : 'idle'}
                    aria-hidden="true"
                    className={cn('size-3.5', active && 'ai-message-pop')}
                  />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
