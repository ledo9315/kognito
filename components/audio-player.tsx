'use client'

import { useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import type { AudioOverview } from '@/lib/audio'

/**
 * The overview, one file and one slider over the whole of it.
 *
 * The element carries the sound and nothing else, the controls above it are
 * ours. That costs a play button, a slider and the two events that keep them
 * in step, and it buys the look the prototype had.
 *
 * Nothing here starts playing on its own. This layout mounts the reader
 * twice, once for the wide screen and once for the narrow one, and hides one
 * of them with css. A hidden `audio` element is inaudible to nobody: it
 * plays, and the listener hears the overview twice, a moment apart.
 */
export function AudioPlayer({
  artifactId,
  overview,
}: {
  artifactId: string
  overview: AudioOverview
}) {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const player = useRef<HTMLAudioElement>(null)

  function toggle() {
    if (!player.current) return
    if (player.current.paused) void player.current.play()
    else player.current.pause()
  }

  function seek(seconds: number) {
    if (player.current) player.current.currentTime = seconds
    setPosition(seconds)
  }

  // Fixed heights, so the bars stand still while the sound runs through
  // them. They are decoration, and decoration that redraws is a distraction.
  const bars = useMemo(
    () => Array.from({ length: 40 }, (_, index) => 0.3 + ((index * 37) % 70) / 100),
    [],
  )

  const played = duration > 0 ? position / duration : 0

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4">
        <audio
          ref={player}
          hidden
          preload="metadata"
          src={`/api/audio/${artifactId}`}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        <div
          aria-hidden="true"
          className="flex h-10 items-center gap-0.5 overflow-hidden"
        >
          {bars.map((height, index) => {
            const active = index / bars.length <= played
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
          max={duration || 1}
          step={1}
          onValueChange={(value) => seek(value as number)}
          aria-label="Wiedergabeposition"
        />

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {format(position)} / {format(duration)}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => seek(0)}
              aria-label="Von vorne beginnen"
            >
              <RotateCcw />
            </Button>
            <Button
              size="icon-sm"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Abspielen'}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {overview.script.split('\n\n').map((paragraph, index) => (
          <p
            key={index}
            className="text-[13px] leading-relaxed text-pretty text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  )
}

function format(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
