// The one typed loader for episode content (SPEC.md section 9).
import raw from './episodes.json'
import type { Episode } from './types'

export const episodes: Episode[] = raw as Episode[]

export type { Episode, Candle, Timeframe, PatternTag, Baselines } from './types'
