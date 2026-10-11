// Pipeline-internal types. Node-only, not bundled into the app.
// Canonical content shape (Candle, Timeframe, PatternTag, Episode, Baselines) lives in
// src/content/types.ts — the single source of truth the app's typed loader also uses.

export type { Candle, Timeframe, PatternTag, Baselines, Episode } from '../src/content/types'
import type { Candle, Timeframe, PatternTag } from '../src/content/types'

export interface RawSeries {
  source: 'binance' | 'geckoterminal'
  assetSymbol: string
  assetName: string
  timeframe: Timeframe
  candles: Candle[]
  fetchedAt: string
}

export interface SlicedWindow {
  id: string
  assetSymbol: string
  assetName: string
  timeframe: Timeframe
  before: Candle[]
  after: Candle[]
  source: 'binance' | 'geckoterminal'
}

export interface LabeledWindow extends SlicedWindow {
  tags: PatternTag[]
  difficulty: 1 | 2 | 3
}
