'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

const TOTAL = 724 // Seconds (12:04)

/**
 * Simulated player for the audio overview. It does not produce sound; the
 * progress advances on a timer to make the prototype flow interactive.
 */
export function AudioPlayer({
  title,
  meta,
  notebookTitle,
}: {
  title: string
  meta: string
  notebookTitle: string
}) {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)

  useEffect(() => {
    if (!playing) return
    const interval = window.setInterval(() => {
      setPosition((current) => {
        if (current >= TOTAL) {
          setPlaying(false)
          return TOTAL
        }
        return current + 1
      })
    }, 250)
    return () => window.clearInterval(interval)
  }, [playing])

  const bars = useMemo(
    () => Array.from({ length: 40 }, (_, i) => 0.3 + ((i * 37) % 70) / 100),
    [],
  )

  return (
    <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[13px] font-medium">{title}</h3>
        <p className="truncate text-[11px] text-muted-foreground">
          {notebookTitle} · {meta}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="flex h-10 items-center gap-0.5 overflow-hidden"
      >
        {bars.map((height, index) => {
          const active = index / bars.length <= position / TOTAL
          return (
            <span
              key={index}
              className={
                'flex-1 rounded-full transition-colors ' +
                (active ? 'bg-primary' : 'bg-border') +
                (playing && active ? ' animate-wave' : '')
              }
              style={{
                height: `${Math.round(height * 100)}%`,
                animationDelay: `${(index % 8) * 90}ms`,
              }}
            />
          )
        })}
      </div>

      <Slider
        value={position}
        max={TOTAL}
        step={1}
        onValueChange={(value) => setPosition(value as number)}
        aria-label="Wiedergabeposition"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {format(position)} / {format(TOTAL)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setPosition(0)
              setPlaying(false)
            }}
            aria-label="Von vorne beginnen"
          >
            <RotateCcw />
          </Button>
          <Button
            size="icon-sm"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? 'Pause' : 'Abspielen'}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
        </div>
      </div>
    </section>
  )
}

function format(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
