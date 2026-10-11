// Behaviour metrics derived from episode history. SPEC.md section 3.7 (weakest-tag part,
// used by the picker). Zero UI/chain imports.

import type { PatternTag } from '@/src/content/types'

export interface EpisodeResultRecord {
  episodeId: string
  tags: PatternTag[]
  action: 'buy' | 'skip'
  score: number
  dateISO: string
}

const MIN_SAMPLES_FOR_WEAK_TAG = 2

/** Tags with the lowest average score across history (min sample size required). */
export function weakestTags(history: EpisodeResultRecord[], count = 3): PatternTag[] {
  const sums = new Map<PatternTag, { total: number; n: number }>()
  for (const record of history) {
    for (const tag of record.tags) {
      const entry = sums.get(tag) ?? { total: 0, n: 0 }
      entry.total += record.score
      entry.n += 1
      sums.set(tag, entry)
    }
  }
  return [...sums.entries()]
    .filter(([, v]) => v.n >= MIN_SAMPLES_FOR_WEAK_TAG)
    .sort((a, b) => a[1].total / a[1].n - b[1].total / b[1].n)
    .slice(0, count)
    .map(([tag]) => tag)
}

export function attemptedTags(history: EpisodeResultRecord[]): PatternTag[] {
  return [...new Set(history.flatMap((r) => r.tags))]
}
