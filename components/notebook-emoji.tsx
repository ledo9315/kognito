'use client'

import { useState, useTransition } from 'react'
import { EmojiPicker } from 'frimousse'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { updateNotebookAction } from '@/lib/notebook-actions'
import { cn } from '@/lib/utils'

/**
 * The emoji of a notebook, and a picker behind it.
 *
 * Clicking the symbol is the whole interaction, there is no form to submit:
 * the choice is written right away and shown before the server answers,
 * because a symbol one has just clicked should not wait for a round trip.
 *
 * Frimousse loads the emoji list from the emojibase cdn on first use and keeps
 * it in localStorage. That is a request to jsdelivr, which is why the picker
 * only mounts once the popover is open.
 */
export function NotebookEmoji({
  notebookId,
  title,
  emoji,
  className,
}: {
  notebookId: string
  title: string
  emoji: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(emoji)
  const [, startTransition] = useTransition()

  function choose(next: string) {
    setOpen(false)
    if (next === shown) return

    const previous = shown
    setShown(next)

    startTransition(async () => {
      const result = await updateNotebookAction(notebookId, title, next)
      if (!result) return

      setShown(previous)
      toast.error(result.error)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex items-center justify-center rounded-lg leading-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
          className,
        )}
        aria-label={`Symbol von ${title} ändern`}
      >
        {shown}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <EmojiPicker.Root
          locale="de"
          onEmojiSelect={(selected) => choose(selected.emoji)}
          className="flex h-80 w-72 flex-col"
        >
          <EmojiPicker.Search
            placeholder="Suchen"
            className="m-2 h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <EmojiPicker.Viewport className="scrollbar-slim relative flex-1 outline-none">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Emojis werden geladen…
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Kein Emoji gefunden
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="pb-2 select-none"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji: candidate, ...props }) => (
                  <button
                    className="flex size-8 items-center justify-center rounded-lg text-lg data-[active]:bg-accent"
                    title={candidate.label}
                    {...props}
                  >
                    {candidate.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  )
}
