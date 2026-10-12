// Design tokens — luxury "old money" palette.
// Amex Centurion × Apple Card × Patek Philippe.
// ONE accent: muted champagne gold. No neon, no glows, no bright gradients.
import type { Level } from '@/src/engine/rating'

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  // Warm near-black base — 3 matte surface levels separated by FILL, not border
  bg0: '#0B0B0D',
  bg1: '#101012',
  bg2: '#161618',
  bg3: '#1E1E22',

  // Hairline borders — 6 % white; champagne hairline for hero elements
  line:              'rgba(255,255,255,0.06)',
  lineChampagne:     'rgba(201,169,110,0.22)',
  lineChampagneSoft: 'rgba(201,169,110,0.10)',

  // Text — warm ivory scale
  text:    '#F4F1EA',   // primary
  textSub: '#A8A49A',   // secondary — must pass WCAG AA on bg0
  muted:   '#6E6B64',   // tertiary

  // ONE brand accent: champagne gold
  gold:     '#C9A96E',   // primary accent
  goldSoft: '#E8D9B5',   // light detail, small text on dark bg
  goldDeep: '#8A7347',   // deep variant, pressed states

  // P&L — rich, desaturated, not neon
  gain:    '#3FB68B',             // deep emerald
  gainSoft:'rgba(63,182,139,0.10)',
  loss:    '#C8554F',             // muted burgundy-coral
  lossSoft:'rgba(200,85,79,0.10)',

  // Neutral signal (skip/neutral)
  neutral:    '#6E6B64',
  neutralSoft:'rgba(110,107,100,0.12)',

  // Shadow
  shadow: '#000000',

  // ── Backward-compat aliases (screens being redesigned reference these) ──────
  brand:     '#C9A96E',   // was neon purple → now champagne gold
  brandSoft: 'rgba(201,169,110,0.12)',
  brandGlow: 'rgba(201,169,110,0.18)',
  warn:      '#C9A96E',   // was orange-warn → champagne (no more orange boxes)
  warnSoft:  'rgba(201,169,110,0.10)',
} as const

// ─── Spacing — strict 4-pt grid ───────────────────────────────────────────────
export const space = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,   // screen horizontal padding
  xxxl: 32,
  huge: 48,
} as const

export const SCREEN_PAD = space.xxl  // 24

// ─── Border radii ─────────────────────────────────────────────────────────────
export const radius = {
  xs:   4,
  sm:   8,
  md:   14,   // inner elements
  card: 20,   // cards
  lg:   24,
  sheet:28,
  chip: 999,
  pill: 999,
} as const

// ─── Typography ───────────────────────────────────────────────────────────────
// Playfair Display → hero numbers + screen titles (elegant, expensive-feeling)
// Space Grotesk → secondary headings, UI numbers
// Inter → body / labels / captions
export const fonts = {
  // Playfair Display
  serif:       'PlayfairDisplay_400Regular',
  serifMedium: 'PlayfairDisplay_500Medium',
  serifBold:   'PlayfairDisplay_700Bold',

  // Space Grotesk (numeric fallback, secondary display)
  display:     'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',

  // Inter UI
  ui:          'Inter_400Regular',
  uiMedium:    'Inter_500Medium',
  uiSemiBold:  'Inter_600SemiBold',
  uiBold:      'Inter_700Bold',
} as const

export const fontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   22,
  xxl:  28,
  hero: 56,
} as const

// ─── Level ladder ─────────────────────────────────────────────────────────────
// All within the champagne/gold family — no rainbow
export const levelColors: Record<Level, string> = {
  Rookie:  colors.muted,       // '#6E6B64' quiet grey
  Analyst: '#7E9BAF',          // muted steel blue
  Trader:  colors.gold,        // champagne gold  (the "you've arrived" tier)
  Sniper:  '#B0C4A4',          // pale sage
  Legend:  colors.goldSoft,    // warm ivory gold
} as const

// ─── Icon sizes ───────────────────────────────────────────────────────────────
export const iconSize = {
  xs: 20,
  sm: 32,
  md: 44,
  lg: 56,
  xl: 72,
} as const

export type Colors = typeof colors
