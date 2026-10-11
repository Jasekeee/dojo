import { describe, expect, it } from 'vitest'
import { computeEdge, computeScore } from './score'

describe('computeEdge', () => {
  it('is positive when the user beats the bot', () => {
    expect(computeEdge(0.3, 0.1)).toBeCloseTo(0.2, 10)
  })
  it('is negative when the user lags the bot', () => {
    expect(computeEdge(0.05, 0.2)).toBeCloseTo(-0.15, 10)
  })
})

describe('computeScore', () => {
  it('is 0 when the user matches the bot exactly', () => {
    expect(computeScore(0.1, 0.1)).toBe(0)
  })
  it('is positive when the user beats the bot, bounded by 1', () => {
    const score = computeScore(0.5, 0.1)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })
  it('is negative when the user lags the bot, bounded by -1', () => {
    const score = computeScore(-0.3, 0.1)
    expect(score).toBeLessThan(0)
    expect(score).toBeGreaterThan(-1)
  })
  it('rewards skipping a loser: skip (0) beats a bot that lost money', () => {
    const skipScore = computeScore(0, -0.2)
    expect(skipScore).toBeGreaterThan(0)
  })
  it('penalizes skipping a winner: skip (0) loses to a bot that made money', () => {
    const skipScore = computeScore(0, 0.3)
    expect(skipScore).toBeLessThan(0)
  })
})
