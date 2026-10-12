// Design tokens. SPEC.md section 7. Screens/components must read from here — no hard-coded
// colors or spacing. Dark, premium, fintech-meets-game mood with one electric accent.
import type { Level } from '@/src/engine/rating'

export const colors = {
  bg0: '#0A0B0F',
  bg1: '#12141A',
  bg2: '#1A1D26',
  line: '#262A36',
  text: '#F4F6FA',
  muted: '#8A91A3',
  brand: '#8B5CFF',
  gain: '#9CFF57',
  loss: '#FF5C7A',
  warn: '#FFB84D',
} as const

// 4-pt spacing grid.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

export const radius = {
  card: 16,
  sheet: 24,
  chip: 999,
} as const

// Inter for UI copy, Space Grotesk for numbers/headlines (tabular figures for all numbers).
// Verified available via @expo-google-fonts/{inter,space-grotesk} (2026-10-11, see DECISIONS.md).
export const fonts = {
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemiBold: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
  display: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
} as const

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const

// Level progression colors — single source of truth across all screens
// Uses Level type from engine (type-only import — no runtime dep on bundle size)
export const levelColors: Record<Level, string> = {
  Rookie:  colors.muted,    // '#8A91A3'
  Analyst: '#4CC9F0',
  Trader:  colors.brand,    // '#8B5CFF'
  Sniper:  colors.gain,     // '#9CFF57'
  Legend:  colors.warn,     // '#FFB84D'
}

// Semantic icon sizes — minimum 44pt for touch targets (WCAG)
export const iconSize = {
  xs:  20,
  sm:  32,
  md:  44,
  lg:  56,
  xl:  72,
} as const

export type Colors = typeof colors
