'use client'

import { Fragment } from 'react'
import { splitAnswer } from '@/features/chat/citations'
import type { Citation } from '@/lib/db/schema'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  content: string
  citations?: Citation[]
  onCitationClick?: (citation: Citation) => void
}

export function AnswerText({ content, citations = [], onCitationClick }: Props) {
  const blocks = content.split('\n\n')

  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n')
        const isList = lines.every((line) => line.trim().startsWith('- '))

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
                    />
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
                />
              </Fragment>
            ))}
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
}: {
  text: string
  citations: Citation[]
  onCitationClick?: (citation: Citation) => void
}) {
  return (
    <>
      {splitAnswer(text, citations).map((segment, index) => {
        switch (segment.type) {
          case 'emphasis':
            return (
              <strong key={index} className="font-medium text-foreground">
                {segment.text}
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
            return <span key={index}>{segment.text}</span>
        }
      })}
    </>
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
