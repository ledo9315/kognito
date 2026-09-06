'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Fragment } from 'react'
import { splitAnswer } from '@/features/chat/citations'
import type { Citation } from '@/lib/db/schema'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
/**
 * Hoisted and frozen. Motion restarts an animation whenever the transition it
 * is given changes, and this component re-renders on every token, so the
 * object has to be the same reference every time.
 */
const WORD_TRANSITION = { duration: 0.22, ease: EASE_OUT } as const
const WORD_HIDDEN = { filter: 'blur(4px)', opacity: 0, y: 2 } as const
const WORD_SHOWN = { filter: 'blur(0px)', opacity: 1, y: 0 } as const
const WORD_SPLIT = /(\s+)/
const WHITESPACE_ONLY = /^\s+$/
/**
 * How many words at the end of a streaming answer are animated spans. New
 * words only ever arrive at the end, and an entrance lasts 220 ms, so a dozen
 * covers it. Everything before is plain text again: a long answer otherwise
 * grows into hundreds of motion elements that every chunk re-renders, the
 * main thread saturates and the entrances stall until the stream ends.
 */
const ANIMATED_TAIL_WORDS = 12

type Props = {
  content: string
  citations?: Citation[]
  onCitationClick?: (citation: Citation) => void
  /**
   * While the answer is still arriving, new words fade in as they land and a
   * caret rides the last one. Off for finished answers, which then render as
   * plain text without a span per word.
   */
  streaming?: boolean
}

export function AnswerText({
  content,
  citations = [],
  onCitationClick,
  streaming = false,
}: Props) {
  const shouldReduceMotion = useReducedMotion()
  const animate = streaming && !shouldReduceMotion
  const blocks = content.split('\n\n')
  const lastBlockIndex = blocks.length - 1

  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n')
        const isList = lines.every((line) => line.trim().startsWith('- '))
        const isLast = blockIndex === blocks.length - 1

        if (isList) {
          return (
            <ul key={blockIndex} className="flex list-none flex-col gap-1.5 pl-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[0.6em] size-1 shrink-0 rounded-full bg-muted-foreground/60"
                  />
                  <span>
                    <Inline
                      text={line.trim().slice(2)}
                      citations={citations}
                      onCitationClick={onCitationClick}
                      animate={
                        animate &&
                        blockIndex === lastBlockIndex &&
                        lineIndex === lines.length - 1
                      }
                    />
                    {streaming && isLast && lineIndex === lines.length - 1 ? (
                      <Caret reduced={Boolean(shouldReduceMotion)} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={blockIndex} className="text-pretty">
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Inline
                  text={line}
                  citations={citations}
                  onCitationClick={onCitationClick}
                  animate={
                    animate &&
                    blockIndex === lastBlockIndex &&
                    lineIndex === lines.length - 1
                  }
                />
              </Fragment>
            ))}
            {streaming && isLast ? <Caret reduced={Boolean(shouldReduceMotion)} /> : null}
          </p>
        )
      })}
    </div>
  )
}

function Inline({
  text,
  citations,
  onCitationClick,
  animate,
}: {
  text: string
  citations: Citation[]
  onCitationClick?: (citation: Citation) => void
  /** True only for the last line of the answer while it streams. */
  animate: boolean
}) {
  const segments = splitAnswer(text, citations)
  const lastIndex = segments.length - 1

  return (
    <>
      {segments.map((segment, index) => {
        // Only the final segment of the final line is still being written.
        const tail = animate && index === lastIndex
        switch (segment.type) {
          case 'emphasis':
            return (
              <strong key={index} className="font-medium text-foreground">
                <Words text={segment.text} animate={tail} />
              </strong>
            )
          case 'citation':
            return (
              <CitationChip
                key={index}
                citation={segment.citation}
                onClick={onCitationClick}
              />
            )
          default:
            return <Words key={index} text={segment.text} animate={tail} />
        }
      })}
    </>
  )
}

/**
 * Plain text while nothing streams. At the streaming end of the answer, one
 * span per word for the last few words, keyed by position: a span mounts
 * when its word first arrives and gets the entrance then, and a token that
 * merely extends the last word changes its text without remounting, so
 * nothing re-animates. Words animate as they arrive, not on a timer, which
 * drifts out of step with the real stream. Whitespace stays text: wrapping
 * it would let the line break wrongly.
 */
function Words({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>

  // Number the words first, so the map below stays a pure lookup.
  const items: { token: string; word: number | null }[] = []
  let wordCount = 0
  for (const token of text.split(WORD_SPLIT)) {
    if (token === '') continue
    if (WHITESPACE_ONLY.test(token)) {
      items.push({ token, word: null })
    } else {
      items.push({ token, word: wordCount })
      wordCount += 1
    }
  }
  const firstAnimated = Math.max(0, wordCount - ANIMATED_TAIL_WORDS)

  return (
    <>
      {items.map(({ token, word }, index) => {
        if (word === null) return <Fragment key={index}>{token}</Fragment>
        // Settled words go back to text. Their entrance is long over, and a
        // text node costs nothing on the next re-render.
        if (word < firstAnimated) return <Fragment key={index}>{token}</Fragment>

        return (
          <motion.span
            key={index}
            className="inline-block"
            initial={WORD_HIDDEN}
            animate={WORD_SHOWN}
            // No stagger delay, deliberately: a delay derived from the index
            // grows with the text and the entrance never resolves. Token
            // arrival is the stagger.
            transition={WORD_TRANSITION}
          >
            {token}
          </motion.span>
        )
      })}
    </>
  )
}

function Caret({ reduced }: { reduced: boolean }) {
  return (
    // Inline rather than absolutely positioned, so it rides the last glyph
    // and never has to be told where the text ended.
    <motion.span
      aria-hidden="true"
      animate={reduced ? { opacity: 1 } : { opacity: [1, 0.15, 1] }}
      className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] rounded-full bg-current align-baseline"
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 1, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
      }
    />
  )
}

function CitationChip({
  citation,
  onClick,
}: {
  citation: Citation
  onClick?: (citation: Citation) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onClick?.(citation)}
            aria-label={`Beleg ${citation.index} anzeigen`}
            className="mx-0.5 inline-flex size-[1.15rem] -translate-y-px items-center justify-center rounded-full bg-accent align-middle font-mono text-[10px] font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {citation.index}
          </button>
        }
      />
      <TooltipContent className="max-w-72 text-left">
        <span className="line-clamp-4">{citation.quote}</span>
      </TooltipContent>
    </Tooltip>
  )
}
