// Step 2: cut (before, after) decision-point windows out of each raw series.
// Run: npx tsx pipeline/slice.ts
// Reads data/raw/{major,meme}_*.json, writes data/raw/sliced.json

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RawSeries, SlicedWindow } from './types'

const RAW_DIR = join(__dirname, '..', 'data', 'raw')

const BEFORE_LEN = 80
const AFTER_LEN = 40
const STRIDE = 25 // candles between consecutive decision points from the same series

function sliceSeries(series: RawSeries): SlicedWindow[] {
  const windows: SlicedWindow[] = []
  const n = series.candles.length
  let cursor = BEFORE_LEN
  let idx = 0
  while (cursor + AFTER_LEN <= n) {
    const before = series.candles.slice(cursor - BEFORE_LEN, cursor)
    const after = series.candles.slice(cursor, cursor + AFTER_LEN)
    windows.push({
      id: `${series.assetSymbol}_${series.timeframe}_${idx}`,
      assetSymbol: series.assetSymbol,
      assetName: series.assetName,
      timeframe: series.timeframe,
      before,
      after,
      source: series.source,
    })
    cursor += STRIDE
    idx += 1
  }
  return windows
}

function main() {
  const files = readdirSync(RAW_DIR).filter((f) => f.startsWith('major_') || f.startsWith('meme_'))
  const allWindows: SlicedWindow[] = []

  for (const file of files) {
    const series = JSON.parse(readFileSync(join(RAW_DIR, file), 'utf-8')) as RawSeries
    const windows = sliceSeries(series)
    allWindows.push(...windows)
    console.log(`${series.assetSymbol}: ${windows.length} windows from ${series.candles.length} candles`)
  }

  writeFileSync(join(RAW_DIR, 'sliced.json'), JSON.stringify(allWindows))
  console.log(`Total: ${allWindows.length} windows -> data/raw/sliced.json`)
}

main()
