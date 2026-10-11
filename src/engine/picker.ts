// Daily set picker. SPEC.md section 3.8. Zero UI/chain imports.
// Deterministic: same (episodes, date, weakTags, attemptedTags) always yields the same set,
// so a given day's draw is reproducible/shareable.

import type { Episode, PatternTag } from '@/src/content/types'

export const DAILY_SET_SIZE = 10
const WEAK_TAG_SHARE = 0.6
const RANDOM_SHARE = 0.3
// remainder (~0.1) goes to "new tag" slots

export function seedFromDate(date: Date): number {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
}

/** Small, fast, deterministic PRNG (mulberry32). Good enough for content selection, not crypto. */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffledPick<T>(items: T[], count: number, rng: () => number): T[] {
  const copy = [...items]
  const out: T[] = []
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length)
    out.push(copy[idx])
    copy.splice(idx, 1)
  }
  return out
}

function difficultyForSlot(slot: number, total: number): 1 | 2 | 3 {
  const t = slot / Math.max(1, total - 1) // 0..1 ramp across the set
  if (t < 0.4) return 1
  if (t < 0.8) return 2
  return 3
}

export function pickDailySet({
  episodes,
  date,
  weakTags,
  attemptedTags,
  size = DAILY_SET_SIZE,
}: {
  episodes: Episode[]
  date: Date
  weakTags: PatternTag[]
  attemptedTags: PatternTag[]
  size?: number
}): Episode[] {
  const rng = mulberry32(seedFromDate(date))
  const used = new Set<string>()
  const result: Episode[] = []

  const weakCount = Math.round(size * WEAK_TAG_SHARE)
  const randomCount = Math.round(size * RANDOM_SHARE)
  const newCount = size - weakCount - randomCount

  const weakSet = new Set(weakTags)
  const attemptedSet = new Set(attemptedTags)

  const byBucket = (predicate: (ep: Episode) => boolean, difficulty: 1 | 2 | 3) => {
    const candidates = episodes.filter((ep) => !used.has(ep.id) && predicate(ep))
    const sameDifficulty = candidates.filter((ep) => ep.difficulty === difficulty)
    return sameDifficulty.length > 0 ? sameDifficulty : candidates
  }

  const fill = (count: number, predicate: (ep: Episode) => boolean) => {
    for (let i = 0; i < count; i++) {
      const slot = result.length
      const difficulty = difficultyForSlot(slot, size)
      const pool = byBucket(predicate, difficulty)
      const [picked] = shuffledPick(pool, 1, rng)
      if (picked) {
        used.add(picked.id)
        result.push(picked)
      }
    }
  }

  fill(weakCount, (ep) => ep.tags.some((t) => weakSet.has(t)))
  fill(newCount, (ep) => ep.tags.some((t) => !attemptedSet.has(t)))
  fill(randomCount, () => true)

  // Backfill if any bucket ran dry (small content sets) so the set stays full when possible.
  if (result.length < Math.min(size, episodes.length)) {
    fill(size - result.length, () => true)
  }

  return result
}
