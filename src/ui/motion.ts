// Shared Reanimated spring/timing presets. SPEC.md section 7 — every state change animated,
// no abrupt jumps. Respect reduce-motion.

import { AccessibilityInfo } from 'react-native'
import { FadeInDown, FadeInUp, FadeIn, SlideInDown } from 'react-native-reanimated'
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated'

export const springs = {
  snappy: { damping: 20, stiffness: 300, mass: 0.6 } satisfies WithSpringConfig,
  smooth: { damping: 18, stiffness: 160, mass: 0.8 } satisfies WithSpringConfig,
  gentle: { damping: 22, stiffness: 90, mass: 1 } satisfies WithSpringConfig,
} as const

export const timings = {
  fast: { duration: 150 } satisfies WithTimingConfig,
  normal: { duration: 250 } satisfies WithTimingConfig,
  slow: { duration: 450 } satisfies WithTimingConfig,
} as const

let reduceMotionEnabled = false

AccessibilityInfo.isReduceMotionEnabled?.()
  .then((enabled) => { reduceMotionEnabled = enabled })
  .catch(() => {})

AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled: boolean) => {
  reduceMotionEnabled = enabled
})

export function isReduceMotionEnabled(): boolean {
  return reduceMotionEnabled
}

// Entering animations that respect reduce-motion.
// Pass duration and optional delay; returns the correct entering spec.
export function fadeDown(duration = 350, delay = 0) {
  if (reduceMotionEnabled) return FadeIn.duration(1)
  const anim = FadeInDown.duration(duration).springify()
  return delay > 0 ? anim.delay(delay) : anim
}

export function fadeUp(duration = 350, delay = 0) {
  if (reduceMotionEnabled) return FadeIn.duration(1)
  const anim = FadeInUp.duration(duration).springify()
  return delay > 0 ? anim.delay(delay) : anim
}

export function slideUp(duration = 350) {
  if (reduceMotionEnabled) return FadeIn.duration(1)
  return SlideInDown.duration(duration).springify()
}
