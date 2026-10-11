// Step 5: filter + shape into the final Episode[] the app bundles.
// Phase 1 spike does basic integrity filtering only; full tag-balance/winner-loser-mix
// tuning happens in Phase 4 once the universe is scaled to 600+ episodes (SPEC 4.2 step 5).
// Run: npx tsx pipeline/export.ts
// Reads data/raw/with_baselines.json, writes src/content/episodes.json

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Episode, LabeledWindow } from './types'

const RAW_DIR = join(__dirname, '..', 'data', 'raw')
const CONTENT_DIR = join(__dirname, '..', 'src', 'content')

type WithBaselines = LabeledWindow & { baselines: Episode['baselines'] }

function hasIntegrityIssue(w: WithBaselines): boolean {
  const all = [...w.before, ...w.after]
  if (all.length === 0) return true
  for (const c of all) {
    const [, open, high, low, close, volume] = c
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return true
    if (volume < 0) return true
    if (high < low) return true
  }
  return false
}

function main() {
  const windows = JSON.parse(readFileSync(join(RAW_DIR, 'with_baselines.json'), 'utf-8')) as WithBaselines[]
  const clean = windows.filter((w) => !hasIntegrityIssue(w))
  console.log(`${windows.length} windows -> ${clean.length} after integrity filter (dropped ${windows.length - clean.length})`)

  const episodes: Episode[] = clean.map((w) => ({
    id: `daily_${w.id}`,
    kind: 'daily_pool',
    asset: { symbol: w.assetSymbol, name: w.assetName },
    timeframe: w.timeframe,
    before: w.before,
    after: w.after,
    tags: w.tags,
    difficulty: w.difficulty,
    baselines: w.baselines,
  }))

  writeFileSync(join(CONTENT_DIR, 'episodes.json'), JSON.stringify(episodes))
  console.log(`${episodes.length} episodes -> src/content/episodes.json`)

  const bySource: Record<string, number> = {}
  for (const w of clean) bySource[w.source] = (bySource[w.source] ?? 0) + 1
  console.log('By source:', bySource)
}

main()
