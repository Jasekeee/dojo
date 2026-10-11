// Skill Rating. SPEC.md section 3.6. Zero UI/chain imports.

export const SR_START = 500
export const SR_MIN = 0
export const SR_MAX = 1000
export const SR_K = 12

export const DIFFICULTY_WEIGHT: Record<1 | 2 | 3, number> = { 1: 0.8, 2: 1.0, 3: 1.2 }

export type Level = 'Rookie' | 'Analyst' | 'Trader' | 'Sniper' | 'Legend'

const LEVEL_THRESHOLDS: { min: number; level: Level }[] = [
  { min: 850, level: 'Legend' },
  { min: 700, level: 'Sniper' },
  { min: 500, level: 'Trader' },
  { min: 300, level: 'Analyst' },
  { min: 0, level: 'Rookie' },
]

export function getLevel(sr: number): Level {
  return LEVEL_THRESHOLDS.find((t) => sr >= t.min)!.level
}

export function applySrDelta(sr: number, score: number, difficulty: 1 | 2 | 3): number {
  const next = sr + SR_K * score * DIFFICULTY_WEIGHT[difficulty]
  return Math.max(SR_MIN, Math.min(SR_MAX, next))
}
