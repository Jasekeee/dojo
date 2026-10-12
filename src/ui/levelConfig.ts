// Level band configuration — single source for SR ladder UI.
// Screens import from here instead of defining their own copies.

import { getLevel } from '@/src/engine/rating'
import type { Level } from '@/src/engine/rating'
import { levelColors } from '@/src/ui/theme'

export interface LevelBand {
  level: Level
  min: number
  max: number
  color: string
}

export const LEVEL_BANDS: LevelBand[] = [
  { level: 'Rookie',  min: 0,   max: 300,  color: levelColors.Rookie  },
  { level: 'Analyst', min: 300, max: 500,  color: levelColors.Analyst },
  { level: 'Trader',  min: 500, max: 700,  color: levelColors.Trader  },
  { level: 'Sniper',  min: 700, max: 850,  color: levelColors.Sniper  },
  { level: 'Legend',  min: 850, max: 1000, color: levelColors.Legend  },
]

export function getLevelColor(level: Level): string {
  return levelColors[level]
}

export function getLevelBand(sr: number): {
  band: LevelBand
  nextBand: LevelBand | null
  progress: number
} {
  const level = getLevel(sr)
  const idx = LEVEL_BANDS.findIndex((b) => b.level === level)
  const band = LEVEL_BANDS[idx] ?? LEVEL_BANDS[0]!
  const nextBand = idx < LEVEL_BANDS.length - 1 ? LEVEL_BANDS[idx + 1]! : null
  const range = band.max - band.min
  const progress = range > 0 ? Math.max(0, Math.min(1, (sr - band.min) / range)) : 1
  return { band, nextBand, progress }
}
