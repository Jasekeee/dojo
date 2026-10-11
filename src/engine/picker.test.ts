import { describe, expect, it } from 'vitest'
import type { Episode, PatternTag } from '@/src/content/types'
import { DAILY_SET_SIZE, pickDailySet, seedFromDate } from './picker'

const TAGS: PatternTag[] = ['breakout', 'fakeout', 'range', 'pump_dump', 'slow_bleed', 'trend_pullback', 'capitulation']

function makeEpisodes(count: number): Episode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ep-${i}`,
    kind: 'daily_pool',
    asset: { symbol: 'SOL', name: 'Solana' },
    timeframe: '1h',
    before: [],
    after: [],
    tags: [TAGS[i % TAGS.length]],
    difficulty: (((i % 3) + 1) as 1 | 2 | 3),
    baselines: { hold_return: 0, bot_return: 0 },
  }))
}

describe('seedFromDate', () => {
  it('produces the same seed for the same calendar date', () => {
    const a = seedFromDate(new Date('2026-10-11T03:00:00Z'))
    const b = seedFromDate(new Date('2026-10-11T21:00:00Z'))
    expect(a).toBe(b)
  })

  it('differs across dates', () => {
    expect(seedFromDate(new Date('2026-10-11T00:00:00Z'))).not.toBe(seedFromDate(new Date('2026-10-12T00:00:00Z')))
  })
})

describe('pickDailySet', () => {
  const episodes = makeEpisodes(200)

  it('is deterministic: same inputs always produce the same set', () => {
    const args = { episodes, date: new Date('2026-10-11T00:00:00Z'), weakTags: ['fakeout'] as PatternTag[], attemptedTags: ['breakout'] as PatternTag[] }
    const a = pickDailySet(args)
    const b = pickDailySet(args)
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id))
  })

  it('returns the requested size when enough episodes exist', () => {
    const set = pickDailySet({ episodes, date: new Date('2026-10-11T00:00:00Z'), weakTags: [], attemptedTags: [] })
    expect(set.length).toBe(DAILY_SET_SIZE)
  })

  it('never duplicates an episode within one set', () => {
    const set = pickDailySet({ episodes, date: new Date('2026-10-11T00:00:00Z'), weakTags: ['pump_dump'], attemptedTags: [] })
    expect(new Set(set.map((e) => e.id)).size).toBe(set.length)
  })

  it('produces a different set on a different date', () => {
    const a = pickDailySet({ episodes, date: new Date('2026-10-11T00:00:00Z'), weakTags: [], attemptedTags: [] })
    const b = pickDailySet({ episodes, date: new Date('2026-10-12T00:00:00Z'), weakTags: [], attemptedTags: [] })
    expect(a.map((e) => e.id)).not.toEqual(b.map((e) => e.id))
  })

  it('degrades gracefully with fewer episodes than the requested size', () => {
    const small = makeEpisodes(4)
    const set = pickDailySet({ episodes: small, date: new Date('2026-10-11T00:00:00Z'), weakTags: [], attemptedTags: [] })
    expect(set.length).toBe(4)
    expect(new Set(set.map((e) => e.id)).size).toBe(4)
  })
})
