// Canonical content types, bundled into the app. SPEC.md section 3.1.
// The pipeline (Node-only, not bundled) imports these too, so there is one source of truth.

export type Candle = [t: number, open: number, high: number, low: number, close: number, volume: number]

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d'

export type PatternTag =
  | 'breakout'
  | 'fakeout'
  | 'range'
  | 'pump_dump'
  | 'slow_bleed'
  | 'trend_pullback'
  | 'capitulation'

export interface Baselines {
  hold_return: number
  bot_return: number
}

export interface Episode {
  id: string
  kind: 'daily_pool' | 'time_machine'
  asset: { symbol: string; name: string }
  timeframe: Timeframe
  before: Candle[]
  after: Candle[]
  tags: PatternTag[]
  difficulty: 1 | 2 | 3
  context?: { date: string; headline: string; body: string }
  baselines: Baselines
}
