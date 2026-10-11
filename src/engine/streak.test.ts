import { describe, expect, it } from 'vitest'
import { applyDailyCompletion } from './streak'

describe('applyDailyCompletion', () => {
  it('starts a streak at 1 on the first-ever completion', () => {
    const result = applyDailyCompletion({ streakDays: 0, lastCompletedDateISO: null }, '2026-10-11')
    expect(result).toEqual({ streakDays: 1, lastCompletedDateISO: '2026-10-11' })
  })

  it('extends the streak when completed on the consecutive day', () => {
    const result = applyDailyCompletion({ streakDays: 5, lastCompletedDateISO: '2026-10-10' }, '2026-10-11')
    expect(result.streakDays).toBe(6)
  })

  it('resets the streak to 1 after a gap of more than one day', () => {
    const result = applyDailyCompletion({ streakDays: 5, lastCompletedDateISO: '2026-10-08' }, '2026-10-11')
    expect(result.streakDays).toBe(1)
  })

  it('does not double-count completing the same day twice', () => {
    const result = applyDailyCompletion({ streakDays: 3, lastCompletedDateISO: '2026-10-11' }, '2026-10-11')
    expect(result.streakDays).toBe(3)
  })

  it('handles a month boundary correctly', () => {
    const result = applyDailyCompletion({ streakDays: 2, lastCompletedDateISO: '2026-09-30' }, '2026-10-01')
    expect(result.streakDays).toBe(3)
  })
})
