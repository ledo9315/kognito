'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Momentum scrolling for the landing page, the way the reference site does
 * it. Mounted there and nowhere else: the notebook workspace scrolls inside
 * its own panels, and taking the wheel away from them would break them.
 *
 * Anyone who asked the system for less motion keeps the browser's own
 * scrolling, which is also what happens if this never mounts.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // The sticky navbar is 66 pixels, so an anchor stops below it.
    const lenis = new Lenis({ duration: 1.2, anchors: { offset: -80 } })

    let frame = requestAnimationFrame(function step(time) {
      lenis.raf(time)
      frame = requestAnimationFrame(step)
    })

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [])

  return null
}
