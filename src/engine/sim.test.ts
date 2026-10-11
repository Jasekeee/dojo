import { describe, expect, it } from 'vitest'
import { COST_ROUND_TRIP, simulateTrade, skipReturn } from './sim'

const candle = (high: number, low: number, close: number): [number, number, number, number, number, number] => [
  0,
  close,
  high,
  low,
  close,
  1000,
]

describe('simulateTrade', () => {
  it('exits at target when target is hit before stop, on a later candle', () => {
    const result = simulateTrade({
      entry: 100,
      size: 1,
      stopPct: 0.2,
      targetPct: 0.5,
      afterCandles: [candle(110, 95, 108), candle(155, 148, 150)],
    })
    expect(result.exitReason).toBe('target')
    expect(result.exitIndex).toBe(1)
    expect(result.exitPrice).toBe(150)
  })

  it('exits at stop when stop is hit before target, on a later candle', () => {
    const result = simulateTrade({
      entry: 100,
      size: 1,
      stopPct: 0.2,
      targetPct: 0.5,
      afterCandles: [candle(110, 105, 108), candle(90, 78, 80)],
    })
    expect(result.exitReason).toBe('stop')
    expect(result.exitIndex).toBe(1)
    expect(result.exitPrice).toBe(80)
  })

  it('same-candle rule: stop wins when both stop and target are hit in the same candle', () => {
    const result = simulateTrade({
      entry: 100,
      size: 1,
      stopPct: 0.2,
      targetPct: 0.5,
      afterCandles: [candle(160, 75, 100)], // high clears target(150), low clears stop(80)
    })
    expect(result.exitReason).toBe('stop')
    expect(result.exitPrice).toBe(80)
  })

  it('exits at the close of the last candle when neither stop nor target is hit', () => {
    const result = simulateTrade({
      entry: 100,
      size: 1,
      stopPct: 0.2,
      targetPct: 0.5,
      afterCandles: [candle(110, 95, 105), candle(115, 100, 112)],
    })
    expect(result.exitReason).toBe('end')
    expect(result.exitPrice).toBe(112)
  })

  it('applies the round-trip cost to the return', () => {
    const result = simulateTrade({
      entry: 100,
      size: 1,
      afterCandles: [candle(110, 95, 110)],
    })
    // no stop/target -> exits at close of last candle (110), size 1
    const expected = 1 * (110 / 100 - 1 - COST_ROUND_TRIP)
    expect(result.returnOnEquity).toBeCloseTo(expected, 10)
  })

  it('scales return by size', () => {
    const full = simulateTrade({ entry: 100, size: 1, afterCandles: [candle(120, 95, 120)] })
    const half = simulateTrade({ entry: 100, size: 0.5, afterCandles: [candle(120, 95, 120)] })
    expect(half.returnOnEquity).toBeCloseTo(full.returnOnEquity / 2, 10)
  })

  it('exits at entry with no after candles (edge case)', () => {
    const result = simulateTrade({ entry: 100, size: 1, afterCandles: [] })
    expect(result.exitPrice).toBe(100)
    expect(result.exitIndex).toBe(-1)
    expect(result.exitReason).toBe('end')
  })

  it('skip always returns 0', () => {
    expect(skipReturn()).toBe(0)
  })
})
