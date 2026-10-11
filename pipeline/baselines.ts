// Step 4: compute hold_return and bot_return per window (SPEC.md section 3.3-3.4),
// using the same pure sim engine the app will use at runtime.
// Run: npx tsx pipeline/baselines.ts
// Reads data/raw/labeled.json, writes data/raw/with_baselines.json

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { simulateTrade } from '../src/engine/sim'
import type { Baselines, LabeledWindow } from './types'

const RAW_DIR = join(__dirname, '..', 'data', 'raw')

const BOT_SIZE = 0.5
const BOT_STOP_PCT = 0.2
const BOT_TARGET_PCT = 0.5

function computeBaselines(window: LabeledWindow): Baselines {
  const entry = window.before[window.before.length - 1][4] // close of last visible candle
  const hold = simulateTrade({ entry, size: 1, afterCandles: window.after })
  const bot = simulateTrade({
    entry,
    size: BOT_SIZE,
    stopPct: BOT_STOP_PCT,
    targetPct: BOT_TARGET_PCT,
    afterCandles: window.after,
  })
  return { hold_return: hold.returnOnEquity, bot_return: bot.returnOnEquity }
}

function main() {
  const labeled = JSON.parse(readFileSync(join(RAW_DIR, 'labeled.json'), 'utf-8')) as LabeledWindow[]
  const withBaselines = labeled.map((w) => ({ ...w, baselines: computeBaselines(w) }))

  const botProfitable = withBaselines.filter((w) => w.baselines.bot_return > 0).length
  console.log(
    `${withBaselines.length} windows. bot_return > 0: ${botProfitable} (${((100 * botProfitable) / withBaselines.length).toFixed(1)}%)`,
  )

  writeFileSync(join(RAW_DIR, 'with_baselines.json'), JSON.stringify(withBaselines))
  console.log('-> data/raw/with_baselines.json')
}

main()
