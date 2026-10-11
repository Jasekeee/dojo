import { describe, expect, it } from 'vitest'
import { attemptedTags, type EpisodeResultRecord, weakestTags } from './metrics'

const record = (tags: EpisodeResultRecord['tags'], score: number): EpisodeResultRecord => ({
  episodeId: Math.random().toString(),
  tags,
  action: 'buy',
  score,
  dateISO: '2026-10-11',
})

describe('weakestTags', () => {
  it('ranks tags by lowest average score first', () => {
    const history = [
      record(['fakeout'], -0.5),
      record(['fakeout'], -0.3),
      record(['breakout'], 0.8),
      record(['breakout'], 0.6),
    ]
    expect(weakestTags(history, 2)).toEqual(['fakeout', 'breakout'])
  })

  it('excludes tags without enough samples', () => {
    const history = [record(['fakeout'], -0.9), record(['breakout'], 0.8), record(['breakout'], 0.6)]
    expect(weakestTags(history, 5)).toEqual(['breakout'])
  })

  it('returns an empty array for no history', () => {
    expect(weakestTags([])).toEqual([])
  })
})

describe('attemptedTags', () => {
  it('returns the unique set of tags ever seen', () => {
    const history = [record(['fakeout', 'range'], 0), record(['fakeout'], 0.1)]
    expect(attemptedTags(history).sort()).toEqual(['fakeout', 'range'])
  })
})
