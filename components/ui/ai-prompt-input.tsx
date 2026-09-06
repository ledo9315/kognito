'use client'

import { ArrowUp, Square } from 'lucide-react'
import {
  AnimatePresence,
  type MotionStyle,
  motion,
  type Transition,
  useReducedMotion,
} from 'motion/react'
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  type AIState,
  getAIStateAccentColor,
  getAIStateMotion,
} from '@/components/ui/ai-core'
import { cn } from '@/lib/utils'

const MAX_ROWS = 8
const SPRING_DEFAULT: Transition = { bounce: 0.1, duration: 0.25, type: 'spring' }
const EASE_OUT = [0.23, 1, 0.32, 1] as const

export type AIPromptInputProps = {
  /** Extra controls on the left of the toolbar, e.g. a keyboard hint. */
  children?: ReactNode
  className?: string
  disabled?: boolean
  /** Called when the submit control is pressed while `state` is `streaming`. */
  onStop?: () => void
  onSubmit: (value: string) => void
  onValueChange: (value: string) => void
  placeholder?: string
  /** Shared AI state. `streaming` turns submit into stop. */
  state?: AIState
  /** The draft, owned by the caller so it can clear it after sending. */
  value: string
}

/**
 * The prompt composer: an autogrowing textarea and a send button that turns
 * into a stop button while the model writes. The height is measured from the
 * textarea's own scroll height, so the surrounding page never reflows
 * mid-keystroke. Adapted from SmoothUI's ai-prompt-input, without file
 * attachments: sources enter through their own panel.
 */
export function AIPromptInput({
  children,
  className,
  disabled = false,
  onStop,
  onSubmit,
  onValueChange,
  placeholder = 'Stelle eine Frage…',
  state = 'idle',
  value,
}: AIPromptInputProps) {
  const shouldReduceMotion = useReducedMotion()
  const stateMotion = getAIStateMotion(state)
  const accentColor = getAIStateAccentColor(state, 'transparent')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const isStreaming = state === 'streaming'
  const canSubmit = value.trim().length > 0 && !disabled

  const resize = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    // Collapse first, otherwise scrollHeight only ever grows.
    textarea.style.height = 'auto'
    const lineHeight = Number.parseFloat(
      getComputedStyle(textarea).lineHeight || '20',
    )
    const maxHeight = lineHeight * MAX_ROWS
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    // Collapsing on an empty draft matters after submit: the box returns to
    // one row instead of holding the height of the question just sent.
    if (value.length === 0 && textareaRef.current) {
      textareaRef.current.style.height = ''
    }
    resize()
  }, [value, resize])

  function submit() {
    if (isStreaming) {
      onStop?.()
      return
    }
    if (!canSubmit) return
    onSubmit(value.trim())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift + Enter breaks the line. A composing IME also fires
    // Enter, and that one must not send half a word.
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <motion.div
      className={cn(
        'relative w-full rounded-2xl border bg-background shadow-xs transition-colors',
        isFocused ? 'border-ring' : 'border-border',
        disabled && 'opacity-60',
        className,
      )}
      layout={shouldReduceMotion ? false : 'position'}
      style={
        {
          // The accent ring is the only place status shows here: a composer
          // that changes shape per state would fight the text being written.
          boxShadow:
            state === 'error' || state === 'done'
              ? `0 0 0 1px ${accentColor}`
              : undefined,
        } as MotionStyle
      }
      transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
    >
      <textarea
        ref={textareaRef}
        aria-label="Frage eingeben"
        className="max-h-64 w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        disabled={disabled}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        value={value}
      />

      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex min-w-0 items-center gap-1 pl-2">{children}</div>

        <SubmitButton
          disabled={disabled || !(canSubmit || isStreaming)}
          isStreaming={isStreaming}
          onClick={submit}
          shouldReduceMotion={Boolean(shouldReduceMotion)}
          speed={stateMotion.speed}
        />
      </div>
    </motion.div>
  )
}

function SubmitButton({
  disabled,
  isStreaming,
  onClick,
  shouldReduceMotion,
  speed,
}: {
  disabled: boolean
  isStreaming: boolean
  onClick: () => void
  shouldReduceMotion: boolean
  speed: number
}) {
  return (
    <motion.button
      type="button"
      aria-label={isStreaming ? 'Antwort stoppen' : 'Frage senden'}
      className={cn(
        'flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
        disabled
          ? 'bg-muted text-muted-foreground'
          : 'bg-primary text-primary-foreground',
      )}
      disabled={disabled}
      onClick={onClick}
      transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
      whileHover={disabled || shouldReduceMotion ? undefined : { scale: 1.05 }}
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.95 }}
    >
      {/* Real lucide glyphs, swapped with a scale-and-fade rather than
          morphed, so it still reads as one control. */}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isStreaming ? 'stop' : 'send'}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center"
          exit={
            shouldReduceMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, scale: 0.6 }
          }
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.6 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.18 / speed, ease: EASE_OUT }
          }
        >
          {isStreaming ? (
            <Square aria-hidden="true" className="size-3 fill-current" strokeWidth={0} />
          ) : (
            <ArrowUp aria-hidden="true" className="size-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
