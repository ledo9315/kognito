'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: 'spring' as const }
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const VIEWBOX = 32
const CENTER = VIEWBOX / 2
const RADIUS = 13
const STROKE_WIDTH = 3
/** Fraction of the window at which the ring changes hue. */
const DEFAULT_WARNING_AT = 0.8
const DEFAULT_DANGER_AT = 0.95
const WARNING_COLOR = 'oklch(78% 0.16 75)'
const DANGER_COLOR = 'oklch(63% 0.21 25)'

const THOUSAND = 1000
const MILLION = 1_000_000

export type AIContextBreakdownItem = {
  label: string
  amount: number
}

export type AIContextMeterProps = {
  /** What is filling the window, shown on hover. */
  breakdown?: AIContextBreakdownItem[]
  className?: string
  /** Fraction at which the ring turns red. */
  dangerAt?: number
  /** Total size of the window, in the unit named by `unit`. */
  limit: number
  /** What the numbers count, e.g. "Zeichen". */
  unit: string
  /** Currently used, in the same unit. */
  used: number
  /** Fraction at which the ring turns amber. */
  warningAt?: number
}

/** 1.800 stays "1,8 k": rounding it to "2 k" would be a lie. */
export function formatCompact(amount: number): string {
  if (amount >= MILLION) return `${(amount / MILLION).toFixed(1).replace('.', ',')} M`
  if (amount >= 10 * THOUSAND) return `${Math.round(amount / THOUSAND)} k`
  if (amount >= THOUSAND) return `${(amount / THOUSAND).toFixed(1).replace('.', ',')} k`
  return String(amount)
}

/**
 * How much of the context window the selected sources take. Crossing a
 * threshold changes the hue, never the size: growing the ring would read as
 * progress, the opposite of the message. Adapted from SmoothUI's
 * ai-context-meter, counting characters rather than tokens because that is
 * the unit the prompt limit is defined in.
 */
export function AIContextMeter({
  breakdown,
  className,
  dangerAt = DEFAULT_DANGER_AT,
  limit,
  unit,
  used,
  warningAt = DEFAULT_WARNING_AT,
}: AIContextMeterProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isOpen, setIsOpen] = useState(false)

  const fraction = limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0
  const percent = Math.round(fraction * 100)
  const color =
    fraction >= dangerAt
      ? DANGER_COLOR
      : fraction >= warningAt
        ? WARNING_COLOR
        : 'currentColor'
  const hasBreakdown = Boolean(breakdown?.length)

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-expanded={hasBreakdown ? isOpen : undefined}
        aria-label={`Kontext zu ${percent} % belegt, ${formatCompact(used)} von ${formatCompact(limit)} ${unit}`}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        disabled={!hasBreakdown}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => hasBreakdown && setIsOpen(true)}
        onMouseEnter={() => hasBreakdown && setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <svg aria-hidden="true" className="size-4 -rotate-90" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <circle
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={RADIUS}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={STROKE_WIDTH}
          />
          {/* pathLength normalises the dash maths, so the fill is the
              fraction itself, with no circumference arithmetic. */}
          <motion.circle
            animate={{ stroke: color, strokeDasharray: `${fraction} ${1 - fraction}` }}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            pathLength={1}
            r={RADIUS}
            strokeLinecap="round"
            strokeWidth={STROKE_WIDTH}
            transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
          />
        </svg>

        <span className="tabular-nums">
          {formatCompact(used)} / {formatCompact(limit)} {unit}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && hasBreakdown ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute top-full right-0 z-50 mt-1.5 w-64 rounded-xl border border-border bg-background p-2.5 shadow-lg"
            exit={
              shouldReduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, scale: 0.96, y: -4 }
            }
            initial={
              shouldReduceMotion
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 0, scale: 0.96, y: -4 }
            }
            style={{ transformOrigin: 'top right' }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT }}
          >
            <ul className="list-none space-y-1">
              {breakdown?.map((item) => (
                <li
                  key={item.label}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <span className="truncate text-muted-foreground">{item.label}</span>
                  <span className="shrink-0 text-foreground tabular-nums">
                    {formatCompact(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
