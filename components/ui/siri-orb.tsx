'use client'

import {
  type MotionStyle,
  motion,
  type TargetAndTransition,
  type Transition,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import {
  type AIAmplitude,
  type AIState,
  getAIStateMotion,
  useAmplitudeValue,
} from '@/components/ui/ai-core'
import { cn } from '@/lib/utils'

const SIZE_THRESHOLD_SMALL = 50
const SIZE_THRESHOLD_TINY = 30
const SIZE_THRESHOLD_MEDIUM = 100
const BLUR_MULTIPLIER_SMALL = 0.008
const BLUR_MIN_SMALL = 1
const BLUR_MULTIPLIER_LARGE = 0.015
const BLUR_MIN_LARGE = 4
const CONTRAST_MULTIPLIER_SMALL = 0.004
const CONTRAST_MIN_SMALL = 1.2
const CONTRAST_MULTIPLIER_LARGE = 0.008
const CONTRAST_MIN_LARGE = 1.5
const DOT_SIZE_MULTIPLIER_SMALL = 0.004
const DOT_SIZE_MIN_SMALL = 0.05
const DOT_SIZE_MULTIPLIER_LARGE = 0.008
const DOT_SIZE_MIN_LARGE = 0.1
const SHADOW_MULTIPLIER_SMALL = 0.004
const SHADOW_MIN_SMALL = 0.5
const SHADOW_MULTIPLIER_LARGE = 0.008
const SHADOW_MIN_LARGE = 2
const CONTRAST_TINY = 1.1
const CONTRAST_MULTIPLIER_FINAL = 1.2
const CONTRAST_MIN_FINAL = 1.3

/** Loud audio tightens the gradient, which reads as the orb focusing. */
const AMPLITUDE_BLUR_FALLOFF = 0.45
/** Amplitude adds at most 12 % of extra size on top of the state scale. */
const AMPLITUDE_SCALE_GAIN = 0.12
/** Single lateral nudge used to signal `error`, well under 200 ms. */
const ERROR_SHAKE_KEYFRAMES = [0, -3, 3, 0]
const ERROR_SHAKE_DURATION = 0.18
const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const
const GLOW_BLUR_RATIO = 0.28
const GLOW_MAX_OPACITY = 0.7
/** Depth rim, as a fraction of the orb size. */
const RIM_RATIO = 0.06
const RIM_MIN = 1.5
/** Sheen drift period at rest, before the state speed divides it. */
const DRIFT_BASE_SECONDS = 12
/** `idle` breathes: a slow, shallow scale cycle that never draws attention. */
const BREATHE_SCALE = [1, 1.035, 1]
const BREATHE_SECONDS = 5.5
const SPRING_DEFAULT: Transition = {
  bounce: 0.1,
  duration: 0.25,
  type: 'spring',
}

/**
 * The project's blues: the primary indigo (hue 269, see globals.css), a
 * deeper indigo, the periwinkle and the cyan of the landing page's hero
 * wash. Higher chroma than the interface uses, because the mesh is blurred
 * and a dot pattern is overlaid on top, and the colour has to survive both.
 * c2 also tints the bloom around the orb.
 */
const defaultColors = {
  bg: 'oklch(93% 0.03 260)',
  c1: 'oklch(74% 0.14 212)',
  c2: 'oklch(56% 0.2 269)',
  c3: 'oklch(46% 0.19 278)',
  c4: 'oklch(70% 0.15 262)',
}

export type SiriOrbProps = {
  /** Live level, 0 to 1. Pass a MotionValue so the signal never re-renders React. */
  amplitude?: AIAmplitude
  /** Ambient rotation period in seconds, before the state speed multiplier. */
  animationDuration?: number
  className?: string
  colors?: Partial<typeof defaultColors>
  /** CSS length in pixels, e.g. "26px". */
  size?: string
  /** Shared AI state driving speed, scale, saturation and reactivity. */
  state?: AIState
}

/**
 * An orb of layered conic gradients, the face the chat gives the model. The
 * static stylesheet for it lives in globals.css under `.siri-orb`, so many
 * orbs on one page share one rule set. Adapted from SmoothUI's siri-orb.
 */
export function SiriOrb({
  size = '192px',
  className,
  colors,
  animationDuration = 20,
  amplitude,
  state = 'idle',
}: SiriOrbProps) {
  const shouldReduceMotion = useReducedMotion()
  const amplitudeValue = useAmplitudeValue(amplitude)
  const stateMotion = getAIStateMotion(state)
  const finalColors = { ...defaultColors, ...colors }
  const glowColor = finalColors.c2

  const sizeValue = Number.parseInt(size.replace('px', ''), 10)
  const small = sizeValue < SIZE_THRESHOLD_SMALL

  const blurAmount = small
    ? Math.max(sizeValue * BLUR_MULTIPLIER_SMALL, BLUR_MIN_SMALL)
    : Math.max(sizeValue * BLUR_MULTIPLIER_LARGE, BLUR_MIN_LARGE)
  const contrastAmount = small
    ? Math.max(sizeValue * CONTRAST_MULTIPLIER_SMALL, CONTRAST_MIN_SMALL)
    : Math.max(sizeValue * CONTRAST_MULTIPLIER_LARGE, CONTRAST_MIN_LARGE)
  const dotSize = small
    ? Math.max(sizeValue * DOT_SIZE_MULTIPLIER_SMALL, DOT_SIZE_MIN_SMALL)
    : Math.max(sizeValue * DOT_SIZE_MULTIPLIER_LARGE, DOT_SIZE_MIN_LARGE)
  const shadowSpread = small
    ? Math.max(sizeValue * SHADOW_MULTIPLIER_SMALL, SHADOW_MIN_SMALL)
    : Math.max(sizeValue * SHADOW_MULTIPLIER_LARGE, SHADOW_MIN_LARGE)

  // A small orb gets no dot mask at all: the mask left a dark centre there.
  const maskRadius =
    sizeValue < SIZE_THRESHOLD_TINY
      ? '0%'
      : sizeValue < SIZE_THRESHOLD_SMALL
        ? '5%'
        : sizeValue < SIZE_THRESHOLD_MEDIUM
          ? '15%'
          : '25%'

  const finalContrast =
    sizeValue < SIZE_THRESHOLD_TINY
      ? CONTRAST_TINY
      : small
        ? Math.max(contrastAmount * CONTRAST_MULTIPLIER_FINAL, CONTRAST_MIN_FINAL)
        : contrastAmount

  // Reactivity is gated by the state preset: `thinking` barely listens so the
  // orb keeps churning internally instead of throbbing with room noise.
  const reactivity = shouldReduceMotion ? 0 : stateMotion.reactivity

  const reactiveBlur = useTransform(amplitudeValue, (level) => {
    const focus = 1 - level * reactivity * AMPLITUDE_BLUR_FALLOFF
    return `${blurAmount * focus}px`
  })

  const reactiveScale = useTransform(
    amplitudeValue,
    (level) => stateMotion.scale + level * reactivity * AMPLITUDE_SCALE_GAIN,
  )

  const loopDuration = shouldReduceMotion
    ? animationDuration
    : animationDuration / stateMotion.speed

  // Rim thickness scales with the orb, so the lit edge reads the same at
  // 24 px and at 240 px instead of swallowing the small one.
  const rim = Math.max(sizeValue * RIM_RATIO, RIM_MIN)
  // The sheen drifts slower than the mesh rotates; matching the rotation
  // would look mechanical.
  const driftDuration = (DRIFT_BASE_SECONDS / (1 + stateMotion.speed)) * 2

  function rootAnimate(): TargetAndTransition {
    if (shouldReduceMotion) return { scale: 1, x: 0 }
    if (state === 'error') return { scale: 1, x: ERROR_SHAKE_KEYFRAMES }
    if (stateMotion.motif === 'breathe') return { scale: BREATHE_SCALE, x: 0 }
    return { scale: 1, x: 0 }
  }

  function rootTransition(): Transition {
    if (shouldReduceMotion) return { duration: 0 }
    if (state === 'error') {
      return { duration: ERROR_SHAKE_DURATION, ease: EASE_IN_OUT }
    }
    if (stateMotion.motif === 'breathe') {
      return {
        duration: BREATHE_SECONDS,
        ease: EASE_IN_OUT,
        repeat: Number.POSITIVE_INFINITY,
      }
    }
    return SPRING_DEFAULT
  }

  return (
    // The gradient disc clips its own overflow, so the bloom lives in a
    // wrapper rather than inside it.
    <motion.div
      aria-hidden="true"
      animate={rootAnimate()}
      className={cn('relative', className)}
      style={{ '--orb-size': size, height: size, width: size } as MotionStyle}
      transition={rootTransition()}
    >
      <motion.div
        animate={{ opacity: stateMotion.glow * GLOW_MAX_OPACITY }}
        className="absolute rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 64%)`,
          filter: `blur(calc(var(--orb-size) * ${GLOW_BLUR_RATIO}))`,
          inset: '-12%',
        }}
        transition={shouldReduceMotion ? { duration: 0 } : SPRING_DEFAULT}
      />

      <motion.div
        className="siri-orb"
        data-mask={maskRadius === '0%' ? 'off' : 'on'}
        style={
          {
            '--animation-duration': `${loopDuration}s`,
            '--bg': finalColors.bg,
            '--blur-amount': reactiveBlur,
            '--c1': finalColors.c1,
            '--c2': finalColors.c2,
            '--c3': finalColors.c3,
            '--c4': finalColors.c4,
            '--contrast-amount': finalContrast,
            '--dot-size': `${dotSize}px`,
            '--drift-duration': `${driftDuration}s`,
            '--mask-radius': maskRadius,
            '--rim': `${rim}px`,
            '--shadow-spread': `${shadowSpread}px`,
            // Saturation and hue only touch the gradient disc, so the
            // semantic accent of `error` keeps its red.
            filter: `saturate(${stateMotion.saturation}) hue-rotate(${stateMotion.hueRotate}deg)`,
            height: '100%',
            scale: reactiveScale,
            width: '100%',
          } as MotionStyle
        }
      >
        {/* Specular sheen and depth rim: the mesh alone reads as a flat
            blurred disc, the drifting highlight and lit edge make it a sphere. */}
        <span className="siri-orb-layer siri-orb-sheen" />
        <span className="siri-orb-layer siri-orb-rim" />
      </motion.div>
    </motion.div>
  )
}
