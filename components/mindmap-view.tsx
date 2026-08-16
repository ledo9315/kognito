'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toMermaid, type Mindmap } from '@/lib/mindmap'

/**
 * A mindmap, drawn by mermaid and moved around by the reader.
 *
 * Its own file and not another body in the artifact reader, because this is
 * the one kind that does not fit the reader: measured against mermaid, even a
 * map of 25 nodes comes out 1099 pixels wide and the panel is 384. It is
 * opened from the studio in a dialog instead, see components/studio-panel.tsx.
 */
export function MindmapView({ mindmap }: { mindmap: Mindmap }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState(atRest)

  const frame = useRef<HTMLDivElement>(null)
  const grabbedAt = useRef({ x: 0, y: 0 })

  const definition = useMemo(() => toMermaid(mindmap), [mindmap])
  // Mermaid writes this into the id of the svg it returns, and React's own
  // ids carry characters that are not valid there.
  const domId = `mindmap-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    let dropped = false

    // Loaded when a mindmap is opened and not before. Mermaid is by far the
    // largest dependency in this project and nobody else should pay for it.
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          // The app sets colorScheme light in the root layout and never puts
          // the dark class anywhere. A dark mode has to pick a theme here.
          theme: 'default',
        })
        const rendered = await mermaid.render(domId, definition)
        if (!dropped) setSvg(rendered.svg)
      })
      .catch(() => {
        if (!dropped) setFailed(true)
      })

    return () => {
      dropped = true
    }
  }, [definition, domId])

  /**
   * Mermaid ships the drawing as `width="100%"` over a viewBox, so it shrinks
   * to whatever it is put in and every label shrinks with it. The viewBox
   * carries the size the layout actually wanted, and that goes back on as
   * pixels.
   */
  useEffect(() => {
    const drawing = frame.current?.querySelector('svg')
    const box = drawing?.getAttribute('viewBox')?.split(/\s+/).map(Number)
    if (!drawing || !box || box.length !== 4) return

    const [, , width, height] = box
    drawing.setAttribute('width', String(width))
    drawing.setAttribute('height', String(height))
    drawing.style.maxWidth = 'none'

    setView(centred(frame.current, width, height))
  }, [svg])

  /**
   * The wheel listener is attached by hand because react registers `wheel`
   * passively at the root, and in a passive listener `preventDefault` does
   * nothing. Without it the page scrolls away under the zoom.
   */
  useEffect(() => {
    const node = frame.current
    if (!node) return

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = node!.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top

      setView((current) => {
        const scale = Math.min(
          4,
          Math.max(0.2, current.scale * Math.exp(-event.deltaY * 0.002)),
        )
        const ratio = scale / current.scale
        // Whatever sits under the cursor stays under the cursor.
        return {
          scale,
          x: pointerX - (pointerX - current.x) * ratio,
          y: pointerY - (pointerY - current.y) * ratio,
        }
      })
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Capture, so a drag that leaves the frame keeps working and no listener
    // has to be hung on the window.
    event.currentTarget.setPointerCapture(event.pointerId)
    grabbedAt.current = { x: event.clientX - view.x, y: event.clientY - view.y }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    setView((current) => ({
      ...current,
      x: event.clientX - grabbedAt.current.x,
      y: event.clientY - grabbedAt.current.y,
    }))
  }

  if (failed) {
    return (
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <p role="alert" className="text-[13px] leading-relaxed text-muted-foreground">
          Die Grafik konnte nicht gezeichnet werden. Hier ist dieselbe
          Gliederung als Liste.
        </p>
        <MindmapOutline mindmap={mindmap} />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        ref={frame}
        // touch-none, or dragging on a phone scrolls the page instead of
        // moving the map.
        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-lg border border-border bg-card"
      >
        {svg ? (
          <div
            aria-hidden="true"
            role="presentation"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            className="size-full cursor-grab active:cursor-grabbing"
          >
            <div
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                transformOrigin: '0 0',
              }}
              className="w-max"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        ) : (
          <Skeleton className="size-full" />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Mausrad zum Zoomen, ziehen zum Verschieben.
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={!svg}
          onClick={() => setView(centred(frame.current))}
        >
          <RotateCcw />
          Ansicht zurücksetzen
        </Button>
      </div>

      {/* The accessible copy. An svg full of `<text>` has no hierarchy a
          screen reader can follow, so the drawing is hidden from the tree
          and the list carries the structure. */}
      <MindmapOutline mindmap={mindmap} className="sr-only" />
    </div>
  )
}

function MindmapOutline({
  mindmap,
  className,
}: {
  mindmap: Mindmap
  className?: string
}) {
  return (
    <ul className={cn('flex list-disc flex-col gap-1.5 pl-4', className)}>
      {mindmap.branches.map((branch, index) => (
        <li key={index} className="text-[13px] leading-relaxed text-pretty">
          {branch.label}
          {branch.children.length > 0 ? (
            <ul className="flex list-[circle] flex-col gap-1 pt-1 pl-4">
              {branch.children.map((child, position) => (
                <li key={position} className="text-muted-foreground">
                  {child.label}
                  {child.children.length > 0 ? (
                    <ul className="flex list-[square] flex-col pt-0.5 pl-4">
                      {child.children.map((leaf, leafIndex) => (
                        <li key={leafIndex}>{leaf}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

const atRest = { scale: 1, x: 0, y: 0 }

/** How far in the map opens, and where the reset button puts it back to. */
const opensAt = 0.5

/**
 * The middle of the map in the middle of the frame.
 *
 * Only the map is scaled, the frame keeps its size, so half the frame stays
 * half the frame and only the half map is multiplied. Getting that wrong
 * shifts the map by a quarter of the frame and looks like a centring bug in
 * the drawing.
 *
 * Fitting the whole width in was the obvious first idea and it is wrong here:
 * even a small map measures around 1100 pixels across, so fitting lands at a
 * third of its size and the labels are unreadable again.
 */
function centred(frame: HTMLDivElement | null, width?: number, height?: number) {
  const drawing = frame?.querySelector('svg')
  const across = width ?? Number(drawing?.getAttribute('width'))
  const down = height ?? Number(drawing?.getAttribute('height'))
  if (!frame || !across || !down) return atRest

  return {
    scale: opensAt,
    x: frame.clientWidth / 2 - (across * opensAt) / 2,
    y: frame.clientHeight / 2 - (down * opensAt) / 2,
  }
}
