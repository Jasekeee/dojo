// Step 3: rule-based pattern tagging + difficulty, applied to the visible `before` window.
// Thresholds are named consts so Jake/Claude can retune after manual QA (SPEC 4.2 step 7).
// Run: npx tsx pipeline/label.ts
// Reads data/raw/sliced.json, writes data/raw/labeled.json

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, LabeledWindow, PatternTag, SlicedWindow } from './types'

const RAW_DIR = join(__dirname, '..', 'data', 'raw')

const BREAKOUT_LOOKBACK = 20
const BREAKOUT_VOL_MULT = 1.5
const RANGE_MAX_SPAN_PCT = 0.12
const PUMP_DUMP_PUMP_PCT = 0.2
const PUMP_DUMP_DUMP_PCT = 0.12
const SLOW_BLEED_MIN_RET = -0.05
const TREND_PULLBACK_MIN_UP = 0.1
const TREND_PULLBACK_MIN_PULLBACK = -0.03
const TREND_PULLBACK_MAX_PULLBACK = -0.2
const CAPITULATION_RED_BODY_PCT = 0.05
const CAPITULATION_VOL_MULT = 1.8

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function detectBreakout(c: Candle[]): boolean {
  const window = c.slice(-BREAKOUT_LOOKBACK)
  if (window.length < BREAKOUT_LOOKBACK) return false
  const last = window[window.length - 1]
  const prior = window.slice(0, -1)
  const priorHigh = Math.max(...prior.map((x) => x[2]))
  const avgVol = mean(prior.map((x) => x[5]))
  return last[4] >= priorHigh && last[5] > avgVol * BREAKOUT_VOL_MULT
}

const FAKEOUT_BREAKOUT_MARGIN = 0.015 // close must clear the prior range high by 1.5% to count as a real breakout

function detectFakeout(c: Candle[]): boolean {
  if (c.length < 30) return false
  for (let i = 15; i < c.length - 5; i++) {
    const lookback = c.slice(Math.max(0, i - 15), i)
    const priorHigh = Math.max(...lookback.map((x) => x[2]))
    if (c[i][4] > priorHigh * (1 + FAKEOUT_BREAKOUT_MARGIN)) {
      const last = c[c.length - 1]
      if (last[4] < priorHigh) return true // failed back below the broken level by window's end
    }
  }
  return false
}

function detectRange(c: Candle[]): boolean {
  const highs = c.map((x) => x[2])
  const lows = c.map((x) => x[3])
  const avgClose = mean(c.map((x) => x[4]))
  const spanPct = (Math.max(...highs) - Math.min(...lows)) / avgClose
  return spanPct < RANGE_MAX_SPAN_PCT
}

function detectPumpDump(c: Candle[]): boolean {
  let peakIdx = 0
  let peak = c[0][4]
  for (let i = 1; i < c.length; i++) {
    if (c[i][4] > peak) {
      peak = c[i][4]
      peakIdx = i
    }
  }
  const pumpPct = (peak - c[0][4]) / c[0][4]
  const trough = Math.min(...c.slice(peakIdx).map((x) => x[4]))
  const dumpPct = (peak - trough) / peak
  return pumpPct >= PUMP_DUMP_PUMP_PCT && dumpPct >= PUMP_DUMP_DUMP_PCT
}

function detectSlowBleed(c: Candle[]): boolean {
  const segLen = Math.floor(c.length / 4)
  if (segLen < 5) return false
  const segs = [c.slice(0, segLen), c.slice(segLen, 2 * segLen), c.slice(2 * segLen, 3 * segLen), c.slice(3 * segLen)]
  const highs = segs.map((s) => Math.max(...s.map((x) => x[2])))
  const lows = segs.map((s) => Math.min(...s.map((x) => x[3])))
  const highsDown = highs.every((h, i) => i === 0 || h <= highs[i - 1])
  const lowsDown = lows.every((l, i) => i === 0 || l <= lows[i - 1])
  const totalRet = (c[c.length - 1][4] - c[0][4]) / c[0][4]
  return highsDown && lowsDown && totalRet < SLOW_BLEED_MIN_RET
}

function detectTrendPullback(c: Candle[]): boolean {
  const totalRet = (c[c.length - 1][4] - c[0][4]) / c[0][4]
  const last10 = c.slice(-10)
  if (last10.length < 10) return false
  const pullbackRet = (last10[last10.length - 1][4] - last10[0][4]) / last10[0][4]
  return (
    totalRet > TREND_PULLBACK_MIN_UP &&
    pullbackRet < TREND_PULLBACK_MIN_PULLBACK &&
    pullbackRet > TREND_PULLBACK_MAX_PULLBACK
  )
}

function detectCapitulation(c: Candle[]): boolean {
  const last = c[c.length - 1]
  const bodyPct = (last[1] - last[4]) / last[1]
  const avgVol = mean(c.slice(0, -1).map((x) => x[5]))
  return bodyPct > CAPITULATION_RED_BODY_PCT && last[5] > avgVol * CAPITULATION_VOL_MULT
}

function labelWindow(c: Candle[]): PatternTag[] {
  const tags: PatternTag[] = []
  if (detectBreakout(c)) tags.push('breakout')
  if (detectFakeout(c)) tags.push('fakeout')
  if (detectRange(c)) tags.push('range')
  if (detectPumpDump(c)) tags.push('pump_dump')
  if (detectSlowBleed(c)) tags.push('slow_bleed')
  if (detectTrendPullback(c)) tags.push('trend_pullback')
  if (detectCapitulation(c)) tags.push('capitulation')
  return tags
}

function assignDifficulty(tags: PatternTag[]): 1 | 2 | 3 {
  if (tags.includes('fakeout') || tags.length === 0) return 3
  if (tags.includes('range') || tags.includes('slow_bleed')) return 2
  return 1
}

function main() {
  const sliced = JSON.parse(readFileSync(join(RAW_DIR, 'sliced.json'), 'utf-8')) as SlicedWindow[]
  const labeled: LabeledWindow[] = sliced.map((w) => {
    const tags = labelWindow(w.before)
    return { ...w, tags, difficulty: assignDifficulty(tags) }
  })

  const counts: Record<string, number> = {}
  for (const w of labeled) {
    for (const t of w.tags) counts[t] = (counts[t] ?? 0) + 1
    if (w.tags.length === 0) counts['(untagged)'] = (counts['(untagged)'] ?? 0) + 1
  }
  console.log('Tag counts:', counts)

  writeFileSync(join(RAW_DIR, 'labeled.json'), JSON.stringify(labeled))
  console.log(`${labeled.length} windows -> data/raw/labeled.json`)
}

main()
