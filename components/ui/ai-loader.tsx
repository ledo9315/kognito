'use client'

import { motion, useAnimationFrame, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** One cycle length, shared so two loaders on one screen read as one system. */
export const AI_LOADER_CYCLE_SECONDS = 1.2

const DOT_COUNT = 3
const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const
const MS_PER_SECOND = 1000

export type AILoaderProps = {
  className?: string
  /** Text before the indicator, e.g. "Quellen werden durchsucht". */
  label?: string
  /** Appends a live elapsed counter. Long waits need a sign of progress. */
  showElapsed?: boolean
}

function Dots({ reduced }: { reduced: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: DOT_COUNT }, (_, index) => (
        <motion.span
          key={index}
          animate={reduced ? { opacity: 0.5 } : { opacity: [0.25, 1, 0.25] }}
          className="size-1.5 rounded-full bg-current"
          transition={
            reduced
              ? { duration: 0 }
              : {
                  delay: (index * AI_LOADER_CYCLE_SECONDS) / (DOT_COUNT * 2),
                  duration: AI_LOADER_CYCLE_SECONDS,
                  ease: EASE_IN_OUT,
                  repeat: Number.POSITIVE_INFINITY,
                }
          }
        />
      ))}
    </span>
  )
}

function Elapsed() {
  const startRef = useRef<number | null>(null)
  const [seconds, setSeconds] = useState(0)

  useAnimationFrame((time) => {
    const start = startRef.current ?? time
    startRef.current = start
    const next = (time - start) / MS_PER_SECOND
    // Only re-render when a tenth changes: a 60 fps counter is unreadable.
    setSeconds((current) =>
      next.toFixed(1) === current.toFixed(1) ? current : next,
    )
  })

  return (
    <span className="tabular-nums opacity-60">
      {seconds.toFixed(1).replace('.', ',')} s
    </span>
  )
}

/**
 * The waiting indicator: three dots and, on request, the elapsed time. It
 * never fakes determinate progress. Adapted from SmoothUI's ai-loader.
 */
export function AILoader({ className, label, showElapsed = false }: AILoaderProps) {
  const reduced = Boolean(useReducedMotion())

  return (
    <span
      aria-live="polite"
      role="status"
      className={cn(
        'inline-flex items-center gap-2 text-sm text-muted-foreground',
        className,
      )}
    >
      {label ? <span>{label}</span> : null}
      <Dots reduced={reduced} />
      {showElapsed ? <Elapsed /> : null}
      {label ? null : <span className="sr-only">Wird geladen</span>}
    </span>
  )
}
