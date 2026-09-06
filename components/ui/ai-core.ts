'use client'

import { type MotionValue, useMotionValue } from 'motion/react'
import { useEffect } from 'react'

/**
 * The state contract shared by the orb, the prompt input and the loader, so
 * the whole chat surface moves as one thing rather than as separate widgets.
 * Adapted from SmoothUI's ai-core, without the microphone hooks: the chat
 * never listens, and the orb's amplitude input stays for the audio overview.
 */
export type AIState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'streaming'
  | 'done'
  | 'error'

/** A behavioural hint each component expresses in its own material. */
export type AIStateMotif =
  | 'breathe'
  | 'receive'
  | 'scan'
  | 'pulse'
  | 'ping'
  | 'fault'

export type AIStateAccent = 'success' | 'danger' | null

export type AIStateMotion = {
  accent: AIStateAccent
  /** Outer bloom strength, 0 to 1. */
  glow: number
  /** Palette hue rotation in degrees. */
  hueRotate: number
  /** Overall motion energy, 0 to 1. */
  intensity: number
  motif: AIStateMotif
  /** Seconds between discrete pulses. */
  pulseSeconds: number
  /** How far a shader's domain warp pushes the field, 0 to 1. */
  turbulence: number
  /** Revolutions per second of the noise field. */
  tumble: number
  /** How much external amplitude reaches the surface, 0 = ignore it. */
  reactivity: number
  /** Chroma multiplier. Below 1 desaturates. */
  saturation: number
  /** Resting scale of the surface, 1 = no change. */
  scale: number
  /** Ambient loop speed multiplier, 1 = the component's base tempo. */
  speed: number
}

/**
 * Per-state presets. `thinking` keeps scale 1 so the layout stays calm while
 * the model works; `error` desaturates instead of growing, so it reads as a
 * state change rather than an attention grab.
 */
export const AI_STATE_MOTION: Record<AIState, AIStateMotion> = {
  done: {
    accent: 'success',
    glow: 0.7,
    hueRotate: 0,
    intensity: 0.4,
    motif: 'ping',
    pulseSeconds: 0.65,
    reactivity: 0,
    saturation: 1,
    scale: 1.1,
    speed: 0.8,
    tumble: 0.02,
    turbulence: 0.08,
  },
  error: {
    accent: 'danger',
    glow: 0.25,
    hueRotate: 0,
    intensity: 0.5,
    motif: 'fault',
    pulseSeconds: 0.9,
    reactivity: 0,
    saturation: 0.3,
    scale: 0.96,
    speed: 1,
    tumble: 0,
    turbulence: 0.55,
  },
  idle: {
    accent: null,
    glow: 0.15,
    hueRotate: 0,
    intensity: 0.3,
    motif: 'breathe',
    pulseSeconds: 4.5,
    reactivity: 0,
    saturation: 0.75,
    scale: 0.94,
    speed: 0.6,
    tumble: 0.012,
    turbulence: 0.14,
  },
  listening: {
    accent: null,
    glow: 0.6,
    hueRotate: 0,
    intensity: 0.75,
    motif: 'receive',
    pulseSeconds: 1.6,
    reactivity: 1,
    saturation: 1.05,
    scale: 1.06,
    speed: 1,
    tumble: 0.03,
    turbulence: 0.42,
  },
  streaming: {
    accent: null,
    glow: 0.45,
    hueRotate: -10,
    intensity: 0.6,
    motif: 'pulse',
    pulseSeconds: 1.25,
    reactivity: 0.6,
    saturation: 1,
    scale: 1.02,
    speed: 1.4,
    tumble: 0.06,
    turbulence: 0.5,
  },
  thinking: {
    accent: null,
    glow: 0.35,
    hueRotate: 18,
    intensity: 1,
    motif: 'scan',
    pulseSeconds: 1.1,
    reactivity: 0.15,
    saturation: 1,
    scale: 1,
    speed: 2.4,
    tumble: 0.14,
    turbulence: 0.95,
  },
}

/** Semantic accents. Deliberately not theme tokens: orbs render outside a theme. */
export const AI_ACCENT_COLORS: Record<'success' | 'danger', string> = {
  danger: 'oklch(63% 0.21 25)',
  success: 'oklch(72% 0.17 150)',
}

export function getAIStateAccentColor(
  state: AIState | undefined,
  fallback: string,
): string {
  const accent = AI_STATE_MOTION[state ?? 'idle']?.accent
  return accent ? AI_ACCENT_COLORS[accent] : fallback
}

export function getAIStateMotion(state: AIState | undefined): AIStateMotion {
  return AI_STATE_MOTION[state ?? 'idle'] ?? AI_STATE_MOTION.idle
}

/**
 * Amplitude accepted by the orb. A MotionValue is the preferred form: it
 * updates outside React, so a 60 fps signal never triggers a re-render.
 */
export type AIAmplitude = number | MotionValue<number> | undefined

function isMotionValue(value: AIAmplitude): value is MotionValue<number> {
  return typeof value === 'object' && value !== null && 'get' in value
}

/** Normalises the amplitude prop into one stable MotionValue. */
export function useAmplitudeValue(amplitude: AIAmplitude): MotionValue<number> {
  const fallback = useMotionValue(0)
  const numeric = typeof amplitude === 'number' ? amplitude : null

  useEffect(() => {
    if (numeric !== null) fallback.set(numeric)
  }, [numeric, fallback])

  return isMotionValue(amplitude) ? amplitude : fallback
}
