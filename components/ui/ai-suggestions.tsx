'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: 'spring' as const }
const STAGGER_SECONDS = 0.045

export type AISuggestionsProps = {
  className?: string
  disabled?: boolean
  /** Optional heading, e.g. "Weiterfragen". */
  label?: string
  onSelect: (suggestion: string) => void
  suggestions: string[]
}

/**
 * Distance from the middle of the row, so the stagger radiates outwards from
 * the centre. A left-to-right sweep implies that the first chip matters most;
 * these are alternatives of equal weight.
 */
function centreOutOrder(count: number): number[] {
  const middle = (count - 1) / 2
  return Array.from({ length: count }, (_, index) => Math.abs(index - middle))
}

/**
 * Prompt suggestion chips: the empty state of a chat and the follow-up row
 * after an answer. They arrive without feeling like a notification. Adapted
 * from SmoothUI's ai-suggestions.
 */
export function AISuggestions({
  className,
  disabled = false,
  label,
  onSelect,
  suggestions,
}: AISuggestionsProps) {
  const shouldReduceMotion = useReducedMotion()
  const delays = useMemo(
    () => centreOutOrder(suggestions.length),
    [suggestions.length],
  )

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {label ? (
        <p className="text-xs text-muted-foreground">{label}</p>
      ) : null}

      <ul className="flex list-none flex-wrap gap-2">
        <AnimatePresence initial>
          {suggestions.map((suggestion, index) => (
            <motion.li
              key={suggestion}
              layout={!shouldReduceMotion}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { opacity: 0, scale: 0.94 }
              }
              initial={
                shouldReduceMotion
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 0, scale: 0.94, y: 6 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { ...SPRING_DEFAULT, delay: (delays[index] ?? 0) * STAGGER_SECONDS }
              }
            >
              <motion.button
                type="button"
                disabled={disabled}
                className="cursor-pointer rounded-full border border-border bg-background px-3 py-1.5 text-left text-[13px] text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                onClick={() => onSelect(suggestion)}
                transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              >
                {suggestion}
              </motion.button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
