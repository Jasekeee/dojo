// Pure simulation engine. SPEC.md section 3.3. Zero UI/chain imports — must stay importable
// from both the app and the Node pipeline (pipeline/baselines.ts).

export const COST_ROUND_TRIP = 0.01

export type Candle = [t: number, open: number, high: number, low: number, close: number, volume: number]

export interface SimParams {
  entry: number
  direction: 'long' | 'short'
  size: number        // fraction of virtual equity, e.g. 0.5
  stopPct?: number    // e.g. 0.2 means stop at ±20%; undefined = no stop
  targetPct?: number  // e.g. 0.5 means target at ±50%; undefined = no target
  afterCandles: Candle[]
}

export interface SimResult {
  exitPrice: number
  exitIndex: number
  exitReason: 'stop' | 'target' | 'end'
  returnOnEquity: number
}

export function simulateTrade(params: SimParams): SimResult {
  const { entry, direction, size, stopPct, targetPct, afterCandles } = params

  // Long:  stop below entry (low <= stopPrice), target above (high >= targetPrice)
  // Short: stop above entry (high >= stopPrice), target below (low <= targetPrice)
  const stopPrice = stopPct !== undefined
    ? direction === 'long' ? entry * (1 - stopPct) : entry * (1 + stopPct)
    : undefined
  const targetPrice = targetPct !== undefined
    ? direction === 'long' ? entry * (1 + targetPct) : entry * (1 - targetPct)
    : undefined

  for (let i = 0; i < afterCandles.length; i++) {
    const [, , high, low] = afterCandles[i]

    if (direction === 'long') {
      const hitStop   = stopPrice   !== undefined && low  <= stopPrice
      const hitTarget = targetPrice !== undefined && high >= targetPrice
      // Same-candle: stop wins (conservative)
      if (hitStop)   return finalize(stopPrice!,   i, 'stop',   entry, size, direction)
      if (hitTarget) return finalize(targetPrice!, i, 'target', entry, size, direction)
    } else {
      const hitStop   = stopPrice   !== undefined && high >= stopPrice
      const hitTarget = targetPrice !== undefined && low  <= targetPrice
      if (hitStop)   return finalize(stopPrice!,   i, 'stop',   entry, size, direction)
      if (hitTarget) return finalize(targetPrice!, i, 'target', entry, size, direction)
    }
  }

  const lastClose = afterCandles.length > 0 ? afterCandles[afterCandles.length - 1][4] : entry
  return finalize(lastClose, afterCandles.length - 1, 'end', entry, size, direction)
}

function finalize(
  exitPrice: number,
  exitIndex: number,
  exitReason: SimResult['exitReason'],
  entry: number,
  size: number,
  direction: 'long' | 'short',
): SimResult {
  const returnOnEquity = direction === 'long'
    ? size * (exitPrice / entry - 1 - COST_ROUND_TRIP)
    : size * (1 - exitPrice / entry - COST_ROUND_TRIP)
  return { exitPrice, exitIndex, exitReason, returnOnEquity }
}

export function skipReturn(): number {
  return 0
}
