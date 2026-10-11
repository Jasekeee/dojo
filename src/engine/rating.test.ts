import { describe, expect, it } from 'vitest'
import { applySrDelta, getLevel, SR_MAX, SR_MIN, SR_START } from './rating'

describe('getLevel', () => {
  it('maps SR to the correct level at each boundary', () => {
    expect(getLevel(0)).toBe('Rookie')
    expect(getLevel(299)).toBe('Rookie')
    expect(getLevel(300)).toBe('Analyst')
    expect(getLevel(499)).toBe('Analyst')
    expect(getLevel(500)).toBe('Trader')
    expect(getLevel(699)).toBe('Trader')
    expect(getLevel(700)).toBe('Sniper')
    expect(getLevel(849)).toBe('Sniper')
    expect(getLevel(850)).toBe('Legend')
    expect(getLevel(1000)).toBe('Legend')
  })

  it('starts new users as Trader at SR_START', () => {
    expect(getLevel(SR_START)).toBe('Trader')
  })
})

describe('applySrDelta', () => {
  it('increases SR for a positive score, scaled by difficulty weight', () => {
    const easy = applySrDelta(500, 1, 1)
    const hard = applySrDelta(500, 1, 3)
    expect(easy).toBeGreaterThan(500)
    expect(hard).toBeGreaterThan(easy)
  })

  it('decreases SR for a negative score', () => {
    expect(applySrDelta(500, -1, 1)).toBeLessThan(500)
  })

  it('clamps at SR_MAX', () => {
    expect(applySrDelta(999, 1, 3)).toBe(SR_MAX)
  })

  it('clamps at SR_MIN', () => {
    expect(applySrDelta(5, -1, 3)).toBe(SR_MIN)
  })

  it('is a no-op for a zero score', () => {
    expect(applySrDelta(500, 0, 2)).toBe(500)
  })
})
