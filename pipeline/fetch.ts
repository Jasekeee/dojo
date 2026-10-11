// Step 1 of the content pipeline: fetch raw OHLCV data.
// Sources verified 2026-10-11 (see docs/DECISIONS.md):
//   - Majors: Binance public REST API (no key, deep history).
//   - Meme/long-tail Solana tokens: GeckoTerminal public API (no key, last 180 days only).
// Run: npx tsx pipeline/fetch.ts
// Writes raw JSON to data/raw/ (gitignored) so later pipeline steps never hit the network.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Candle, RawSeries } from './types'

const RAW_DIR = join(__dirname, '..', 'data', 'raw')
mkdirSync(RAW_DIR, { recursive: true })

const MAJOR_ASSETS: { symbol: string; name: string; binanceSymbol: string }[] = [
  { symbol: 'SOL', name: 'Solana', binanceSymbol: 'SOLUSDT' },
  { symbol: 'BTC', name: 'Bitcoin', binanceSymbol: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', binanceSymbol: 'ETHUSDT' },
]
const MAJOR_TIMEFRAMES: { interval: string; label: '1h' | '4h' }[] = [
  { interval: '1h', label: '1h' },
  { interval: '4h', label: '4h' },
]

const MEME_TOKEN_COUNT = 50

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = 15000 * (attempt + 1)
      console.log(`    429, backing off ${wait}ms`)
      await sleep(wait)
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Fetch failed ${res.status} ${url}: ${body.slice(0, 300)}`)
    }
    return res.json() as Promise<T>
  }
  throw new Error(`Fetch failed: rate limited after retries ${url}`)
}

// --- Binance (majors) ---

type BinanceKline = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  closeTime: number,
  ...rest: unknown[],
]

async function fetchBinanceKlines(binanceSymbol: string, interval: string, limit: number): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
  const rows = await fetchJson<BinanceKline[]>(url)
  return rows.map((r) => [Math.floor(r[0] / 1000), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])])
}

// --- GeckoTerminal (meme/long-tail) ---

interface GtPool {
  id: string
  attributes: {
    address: string
    name: string
    volume_usd: { h24?: string }
    reserve_in_usd?: string
    pool_created_at?: string
  }
}

const MIN_POOL_AGE_DAYS = 25 // need enough history for ~500 hourly candles

const POOL_PAGES = [1, 2, 3, 4, 5, 6, 7, 8]
const TRENDING_PAGES = [1, 2, 3]

async function fetchTopSolanaPools(): Promise<GtPool[]> {
  const pages: { data: GtPool[] }[] = []
  // Sequential, not parallel: stay well under the keyless rate limit while discovering candidates.
  for (const p of POOL_PAGES) {
    pages.push(await fetchJson<{ data: GtPool[] }>(`https://api.geckoterminal.com/api/v2/networks/solana/pools?page=${p}`))
    await sleep(7000)
  }
  for (const p of TRENDING_PAGES) {
    pages.push(await fetchJson<{ data: GtPool[] }>(`https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=${p}`))
    await sleep(7000)
  }
  const seen = new Map<string, GtPool>()
  for (const p of pages.flatMap((pg) => pg.data)) {
    if (!seen.has(p.attributes.address)) seen.set(p.attributes.address, p)
  }
  const minAgeMs = MIN_POOL_AGE_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()
  return [...seen.values()]
    .filter((p) => Number(p.attributes.volume_usd?.h24 ?? 0) > 5000) // drop dead/illiquid junk pools
    .filter((p) => {
      const createdAt = p.attributes.pool_created_at ? new Date(p.attributes.pool_created_at).getTime() : 0
      return createdAt > 0 && now - createdAt >= minAgeMs
    })
    .sort((a, b) => Number(b.attributes.volume_usd?.h24 ?? 0) - Number(a.attributes.volume_usd?.h24 ?? 0))
}

async function fetchGeckoTerminalOhlcv(poolAddress: string, timeframe: 'hour' | 'day', limit: number): Promise<Candle[]> {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=1&limit=${limit}&currency=usd`
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      const wait = 15000 * (attempt + 1)
      console.log(`    429, backing off ${wait}ms`)
      await sleep(wait)
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Fetch failed ${res.status} ${url}: ${body.slice(0, 300)}`)
    }
    const json = (await res.json()) as { data: { attributes: { ohlcv_list: Candle[] } } }
    // API returns newest-first; normalize to oldest-first like Binance.
    return [...json.data.attributes.ohlcv_list].sort((a, b) => a[0] - b[0])
  }
  throw new Error(`Fetch failed: rate limited after retries ${url}`)
}

async function main() {
  const skipMajors = process.argv.includes('--skip-majors')
  if (!skipMajors) {
    console.log('Fetching majors from Binance...')
    for (const m of MAJOR_ASSETS) {
      for (const tf of MAJOR_TIMEFRAMES) {
        const candles = await fetchBinanceKlines(m.binanceSymbol, tf.interval, 1000)
        const series: RawSeries = {
          source: 'binance',
          assetSymbol: m.symbol,
          assetName: m.name,
          timeframe: tf.label,
          candles,
          fetchedAt: new Date().toISOString(),
        }
        writeFileSync(join(RAW_DIR, `major_${m.symbol}_${tf.label}.json`), JSON.stringify(series))
        console.log(`  ${m.symbol} ${tf.label}: ${candles.length} candles`)
      }
    }
  } else {
    console.log('Skipping majors (--skip-majors).')
  }

  console.log('Fetching top Solana pools from GeckoTerminal...')
  const pools = (await fetchTopSolanaPools()).slice(0, MEME_TOKEN_COUNT)
  console.log(`  found ${pools.length} candidate pools (after age/liquidity filter)`)

  for (const pool of pools) {
    const name = pool.attributes.name
    const address = pool.attributes.address
    try {
      const candles = await fetchGeckoTerminalOhlcv(address, 'hour', 500)
      if (candles.length < 60) {
        console.log(`  skip ${name} (${address.slice(0, 6)}...): only ${candles.length} candles`)
      } else {
        const series: RawSeries = {
          source: 'geckoterminal',
          assetSymbol: name,
          assetName: name,
          timeframe: '1h',
          candles,
          fetchedAt: new Date().toISOString(),
        }
        writeFileSync(join(RAW_DIR, `meme_${address}.json`), JSON.stringify(series))
        console.log(`  ${name}: ${candles.length} candles`)
      }
    } catch (err) {
      console.log(`  error ${name} (${address.slice(0, 6)}...): ${(err as Error).message}`)
    }
    await sleep(10000) // keyless GeckoTerminal tier is stricter than advertised in practice; be conservative
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
