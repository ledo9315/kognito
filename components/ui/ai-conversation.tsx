'use client'

import { ArrowDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'

const SPRING_DEFAULT = { bounce: 0.1, duration: 0.25, type: 'spring' as const }

/**
 * How close to the bottom still counts as "at the bottom". Zero breaks on
 * fractional scroll heights, anything large keeps yanking the view down while
 * someone reads a few lines up.
 */
const BOTTOM_THRESHOLD_PX = 48

export type AIConversationProps = {
  children: ReactNode
  className?: string
  /** Changes whenever content grows: message count, or streamed text length. */
  contentKey?: string | number
}

/**
 * Scroll container for a thread. It follows the bottom only while the reader
 * is already there: scrolling up during a stream is a deliberate act, and
 * dragging the reader back down is what makes chat interfaces unusable. When
 * it stops following, a pill offers the trip back. Adapted from SmoothUI.
 */
export function AIConversation({
  children,
  className,
  contentKey,
}: AIConversationProps) {
  const shouldReduceMotion = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [isPinned, setIsPinned] = useState(true)

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const distance =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    setIsPinned(distance <= BOTTOM_THRESHOLD_PX)
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ behavior, top: viewport.scrollHeight })
    setIsPinned(true)
  }, [])

  // A layout effect, so the jump happens in the frame the content grew and
  // the reader never sees the pre-scroll position.
  useLayoutEffect(() => {
    if (isPinned) scrollToBottom(shouldReduceMotion ? 'auto' : 'smooth')
  }, [contentKey, isPinned, scrollToBottom, shouldReduceMotion])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    // Catches content that grows without contentKey changing, a details
    // element opening for instance.
    const observer = new ResizeObserver(measure)
    for (const child of Array.from(viewport.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div className={cn('relative min-h-0 w-full', className)}>
      <div
        className="h-full overflow-y-auto overscroll-contain scrollbar-slim"
        onScroll={measure}
        ref={viewportRef}
      >
        {children}
      </div>

      <AnimatePresence initial={false}>
        {!isPinned && (
          <motion.button
            type="button"
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute inset-x-0 bottom-3 mx-auto flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background/90 py-1.5 pr-3 pl-2.5 text-xs text-foreground shadow-sm backdrop-blur"
            exit={
              shouldReduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            initial={
              shouldReduceMotion
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            onClick={() => scrollToBottom(shouldReduceMotion ? 'auto' : 'smooth')}
            transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
          >
            <ArrowDown aria-hidden="true" className="size-3.5" />
            Zum Ende
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
