'use client'

import { ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useId, useState } from 'react'
import { cn } from '@/lib/utils'

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: 'spring' as const }
const EASE_OUT = [0.23, 1, 0.32, 1] as const
/** Marks shown in the collapsed stack before the "+n" chip. */
const STACK_LIMIT = 3
/** Overlap of the collapsed stack, and how far it fans on hover. */
const STACK_OVERLAP_PX = 8
const FAN_GAP_PX = 3
const ROW_STAGGER = 0.035

export type AISource = {
  id: string
  /** The source's mark, an icon for its kind. */
  icon: ReactNode
  title: string
  /** Short line under the title, e.g. the kind of source. */
  snippet?: string
}

export type AISourcesProps = {
  className?: string
  /** Label before the stack. */
  label?: string
  /** Opens the source in the reader. Documents have no address to link to. */
  onSelect: (source: AISource) => void
  sources: AISource[]
}

function Mark({ source }: { source: AISource }) {
  return (
    <span className="flex size-[18px] items-center justify-center overflow-hidden rounded-full border border-border bg-background text-muted-foreground [&_svg]:size-2.5">
      {source.icon}
    </span>
  )
}

/**
 * The sources behind an answer, collapsed to a stack of overlapping marks
 * because provenance should be available rather than loud. Hovering fans the
 * stack apart as a hint that it is a set; opening moves each mark into its
 * own row with a shared layout id, so the icon the eye was tracking is the
 * icon that lands. Adapted from SmoothUI's ai-sources for documents instead
 * of websites: a row opens the reader instead of following a link.
 */
export function AISources({
  className,
  label = 'Quellen',
  onSelect,
  sources,
}: AISourcesProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const layoutPrefix = useId()

  const stacked = sources.slice(0, STACK_LIMIT)
  const overflow = sources.length - stacked.length
  const fanned = isHovered && !isOpen && !shouldReduceMotion

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex cursor-pointer items-center gap-2 rounded-lg py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        onBlur={() => setIsHovered(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsHovered(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="flex items-center">
          {stacked.map((source, index) => (
            <motion.span
              key={source.id}
              // The same layoutId as the row's mark, so the icon travels
              // instead of one disappearing while another appears.
              layoutId={isOpen ? undefined : `${layoutPrefix}-${source.id}`}
              animate={{
                marginLeft: index === 0 ? 0 : fanned ? FAN_GAP_PX : -STACK_OVERLAP_PX,
              }}
              className="relative block"
              style={{ zIndex: stacked.length - index }}
              transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
            >
              <Mark source={source} />
            </motion.span>
          ))}
          {overflow > 0 && <span className="ml-1 tabular-nums">+{overflow}</span>}
        </span>

        <span>{label}</span>

        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          className="flex size-4 items-center justify-center"
          transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
        >
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.ul
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-1 list-none overflow-hidden"
            exit={
              shouldReduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { height: 0, opacity: 0 }
            }
            initial={
              shouldReduceMotion
                ? { height: 'auto', opacity: 1 }
                : { height: 0, opacity: 0 }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { height: SPRING_DEFAULT, opacity: { duration: 0.18, ease: EASE_OUT } }
            }
          >
            {sources.map((source, index) => (
              <motion.li
                key={source.id}
                animate={{ opacity: 1, y: 0 }}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { ...SPRING_DEFAULT, delay: index * ROW_STAGGER }
                }
              >
                <button
                  type="button"
                  onClick={() => onSelect(source)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <motion.span
                    className="mt-0.5 block shrink-0"
                    layoutId={`${layoutPrefix}-${source.id}`}
                    transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
                  >
                    <Mark source={source} />
                  </motion.span>

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {source.title}
                    </span>
                    {source.snippet ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {source.snippet}
                      </span>
                    ) : null}
                  </span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
