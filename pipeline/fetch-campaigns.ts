// Fetches historical Binance data for Time Machine campaigns and writes campaign episodes.
// Run: npx tsx pipeline/fetch-campaigns.ts
// Output: src/content/campaigns.json + data/raw/campaign_*.json

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RAW_DIR = join(__dirname, '..', 'data', 'raw')
const CONTENT_DIR = join(__dirname, '..', 'src', 'content')
mkdirSync(RAW_DIR, { recursive: true })

type Candle = [t: number, open: number, high: number, low: number, close: number, volume: number]

type BinanceKline = [number, string, string, string, string, string, number, ...unknown[]]

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.status === 429) {
      await sleep(15000 * (attempt + 1))
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`${res.status} ${url}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  }
  throw new Error(`Rate limited: ${url}`)
}

async function fetchBinanceRange(
  symbol: string,
  interval: string,
  startMs: number,
  endMs: number,
): Promise<Candle[]> {
  const all: Candle[] = []
  let cursor = startMs
  while (cursor < endMs) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${cursor}&endTime=${endMs}&limit=1000`
    const rows = await fetchJson<BinanceKline[]>(url)
    if (rows.length === 0) break
    for (const r of rows) {
      all.push([Math.floor(r[0] / 1000), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])])
    }
    cursor = rows[rows.length - 1][0] + 1
    if (rows.length < 1000) break
    await sleep(300)
  }
  return all
}

function cutEpisode(
  candles: Candle[],
  decisionIdx: number,
  beforeCount: number,
  afterCount: number,
): { before: Candle[]; after: Candle[] } | null {
  const start = decisionIdx - beforeCount
  const end = decisionIdx + afterCount
  if (start < 0 || end > candles.length) return null
  return {
    before: candles.slice(start, decisionIdx),
    after: candles.slice(decisionIdx, end),
  }
}

function computeBaselines(
  before: Candle[],
  after: Candle[],
): { hold_return: number; bot_return: number } {
  const entry = before[before.length - 1][4]
  const exitClose = after[after.length - 1][4]
  const hold_return = exitClose / entry - 1

  // Bot: BUY 50%, stop −20%, target +50%
  const stop = entry * 0.8
  const target = entry * 1.5
  let exit = exitClose
  let exitReason = 'close'
  for (const c of after) {
    if (c[3] <= stop) { exit = stop; exitReason = 'stop'; break }
    if (c[2] >= target) { exit = target; exitReason = 'target'; break }
  }
  const cost = 0.01
  const bot_return = 0.5 * (exit / entry - 1 - cost)
  return { hold_return, bot_return }
}

interface CampaignEpisode {
  id: string
  kind: 'time_machine'
  asset: { symbol: string; name: string }
  timeframe: string
  before: Candle[]
  after: Candle[]
  tags: string[]
  difficulty: 1 | 2 | 3
  context: { date: string; headline: string; body: string }
  baselines: { hold_return: number; bot_return: number }
}

interface Campaign {
  id: string
  title: string
  subtitle: string
  period: string
  episodeIds: string[]
  summaryTemplate: string
}

// Campaign definitions: date windows to fetch, checkpoint decision points, headlines.
// All facts verified from public record. Dates are UTC.
const CAMPAIGN_DEFS = [
  {
    id: 'ftx_collapse_2022',
    title: 'FTX Collapse',
    subtitle: 'Nov 2022 — A major crypto exchange freezes withdrawals',
    period: 'November 2022',
    summaryTemplate: 'You navigated the FTX collapse: {result} vs holding {hold}',
    asset: 'SOLUSDT',
    assetSymbol: 'SOL',
    assetName: 'Solana',
    interval: '4h',
    // Fetch Nov 1–30 2022
    fetchStart: new Date('2022-10-15T00:00:00Z').getTime(),
    fetchEnd: new Date('2022-12-01T00:00:00Z').getTime(),
    checkpoints: [
      {
        id: 'ftx_1',
        difficulty: 2 as const,
        // Before the announcement: SOL around $32–35, Nov 6 2022 03:00 UTC
        decisionDateISO: '2022-11-06',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Nov 6, 2022',
          headline: 'CoinDesk reports on balance sheet concerns at a major crypto exchange.',
          body: 'A report questions the financial health of one of crypto\'s largest exchanges. The market is watching closely. SOL has been trading sideways for a week.',
        },
        tags: ['slow_bleed'],
      },
      {
        id: 'ftx_2',
        difficulty: 3 as const,
        // During the collapse: Nov 9 2022 03:00 UTC — massive red candles
        decisionDateISO: '2022-11-09',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Nov 9, 2022',
          headline: 'Withdrawal processing paused. The exchange is under extreme stress.',
          body: 'Rumors confirmed: the exchange has halted withdrawals. SOL is down over 40% in 48 hours. Liquidity is evaporating.',
        },
        tags: ['capitulation'],
      },
      {
        id: 'ftx_3',
        difficulty: 2 as const,
        // Post-collapse: Nov 16 2022 — tentative bounce attempt
        decisionDateISO: '2022-11-16',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Nov 16, 2022',
          headline: 'Exchange officially files for bankruptcy. New leadership takes over.',
          body: 'The collapse is confirmed. SOL is down 70% from its high. Some traders see a potential relief bounce; others call it a dead cat.',
        },
        tags: ['fakeout'],
      },
    ],
  },
  {
    id: 'luna_crash_2022',
    title: 'LUNA Crash',
    subtitle: 'May 2022 — A top-10 stablecoin loses its peg',
    period: 'May 2022',
    summaryTemplate: 'You traded the LUNA collapse: {result} vs holding {hold}',
    asset: 'BTCUSDT',
    assetSymbol: 'BTC',
    assetName: 'Bitcoin',
    interval: '4h',
    fetchStart: new Date('2022-04-15T00:00:00Z').getTime(),
    fetchEnd: new Date('2022-06-01T00:00:00Z').getTime(),
    checkpoints: [
      {
        id: 'luna_1',
        difficulty: 2 as const,
        decisionDateISO: '2022-05-07',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'May 7, 2022',
          headline: 'Large UST redemptions trigger concern about the algorithmic stablecoin.',
          body: 'Unusually large sell orders hit the UST-USDC pool. The peg is holding, but there are whispers about sustainability. Bitcoin has been trending down for weeks.',
        },
        tags: ['slow_bleed'],
      },
      {
        id: 'luna_2',
        difficulty: 3 as const,
        decisionDateISO: '2022-05-12',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'May 12, 2022',
          headline: 'UST has broken its $1 peg. LUNA down over 90% in 48 hours.',
          body: 'The algorithmic stablecoin has entered a death spiral. Billions in value are being destroyed. Bitcoin is selling off hard in sympathy.',
        },
        tags: ['capitulation'],
      },
    ],
  },
  {
    id: 'aug_flush_2024',
    title: 'August 2024 Flush',
    subtitle: 'Global risk-off sells crypto alongside equities',
    period: 'August 2024',
    summaryTemplate: 'You survived the August flush: {result} vs holding {hold}',
    asset: 'SOLUSDT',
    assetSymbol: 'SOL',
    assetName: 'Solana',
    interval: '4h',
    fetchStart: new Date('2024-07-15T00:00:00Z').getTime(),
    fetchEnd: new Date('2024-09-01T00:00:00Z').getTime(),
    checkpoints: [
      {
        id: 'aug24_1',
        difficulty: 2 as const,
        decisionDateISO: '2024-08-01',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Aug 1, 2024',
          headline: 'Global equity markets drop sharply. Crypto follows.',
          body: 'US employment data comes in weaker than expected. Risk assets are selling off globally. Crypto is not immune.',
        },
        tags: ['range'],
      },
      {
        id: 'aug24_2',
        difficulty: 3 as const,
        decisionDateISO: '2024-08-05',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Aug 5, 2024',
          headline: 'Crypto liquidations cascade. SOL down 30% in three days.',
          body: 'The Yen carry trade unwind is accelerating. Global markets are in freefall. Crypto leverage is being flushed out.',
        },
        tags: ['capitulation'],
      },
    ],
  },
  {
    id: 'tariff_shock_2025',
    title: 'Tariff Shock',
    subtitle: 'Apr 2025 — Trade war escalation hits risk assets',
    period: 'April 2025',
    summaryTemplate: 'You navigated the tariff shock: {result} vs holding {hold}',
    asset: 'BTCUSDT',
    assetSymbol: 'BTC',
    assetName: 'Bitcoin',
    interval: '4h',
    fetchStart: new Date('2025-03-15T00:00:00Z').getTime(),
    fetchEnd: new Date('2025-05-01T00:00:00Z').getTime(),
    checkpoints: [
      {
        id: 'tariff_1',
        difficulty: 2 as const,
        decisionDateISO: '2025-04-03',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Apr 3, 2025',
          headline: 'Sweeping new tariffs announced. Global equity futures drop sharply.',
          body: 'Major tariff increases announced on key trading partners. Stock futures are down 4%. Bitcoin is selling off alongside equities.',
        },
        tags: ['slow_bleed'],
      },
      {
        id: 'tariff_2',
        difficulty: 2 as const,
        decisionDateISO: '2025-04-09',
        beforeCount: 60,
        afterCount: 40,
        context: {
          date: 'Apr 9, 2025',
          headline: '90-day tariff pause announced. Markets spike.',
          body: 'A 90-day pause on most tariffs is announced. Equities rip higher. Bitcoin follows. But tensions remain elevated.',
        },
        tags: ['breakout'],
      },
    ],
  },
  {
    id: 'liquidation_cascade_2025',
    title: 'October 2025 Cascade',
    subtitle: 'Oct 2025 — Leveraged longs liquidated across crypto',
    period: 'October 2025',
    summaryTemplate: 'You traded the Oct 2025 cascade: {result} vs holding {hold}',
    asset: 'SOLUSDT',
    assetSymbol: 'SOL',
    assetName: 'Solana',
    interval: '1h',
    fetchStart: new Date('2025-09-20T00:00:00Z').getTime(),
    fetchEnd: new Date('2025-11-01T00:00:00Z').getTime(),
    checkpoints: [
      {
        id: 'liq25_1',
        difficulty: 2 as const,
        decisionDateISO: '2025-10-09',
        beforeCount: 72,
        afterCount: 48,
        context: {
          date: 'Oct 9, 2025',
          headline: 'SOL drops 18% in hours as over-leveraged longs get liquidated.',
          body: 'A chain of liquidations hits the market. Open interest was at all-time highs. SOL is printing its largest red candle in months.',
        },
        tags: ['capitulation'],
      },
      {
        id: 'liq25_2',
        difficulty: 2 as const,
        decisionDateISO: '2025-10-12',
        beforeCount: 72,
        afterCount: 48,
        context: {
          date: 'Oct 12, 2025',
          headline: 'SOL bounces from the flush. Is the selling done?',
          body: 'Three days after the cascade, SOL is attempting a recovery. Funding rates have reset. The question is whether this is a dead cat or a real reversal.',
        },
        tags: ['trend_pullback'],
      },
    ],
  },
]

async function main() {
  const allEpisodes: CampaignEpisode[] = []
  const campaigns: Campaign[] = []

  for (const camp of CAMPAIGN_DEFS) {
    console.log(`\nFetching: ${camp.title} (${camp.asset} ${camp.interval})...`)

    let candles: Candle[]
    try {
      candles = await fetchBinanceRange(camp.asset, camp.interval, camp.fetchStart, camp.fetchEnd)
      console.log(`  ${candles.length} candles from ${new Date(candles[0][0] * 1000).toISOString().slice(0,10)} to ${new Date(candles[candles.length-1][0] * 1000).toISOString().slice(0,10)}`)

      // Cache raw data
      writeFileSync(
        join(RAW_DIR, `campaign_${camp.id}.json`),
        JSON.stringify({ source: 'binance', assetSymbol: camp.assetSymbol, candles }),
      )
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`)
      continue
    }

    const campEpisodeIds: string[] = []

    for (const cp of camp.checkpoints) {
      // Find candle index closest to decision date
      const targetTs = new Date(`${cp.decisionDateISO}T12:00:00Z`).getTime() / 1000
      let bestIdx = -1
      let bestDist = Infinity
      for (let i = 0; i < candles.length; i++) {
        const dist = Math.abs(candles[i][0] - targetTs)
        if (dist < bestDist) { bestDist = dist; bestIdx = i }
      }

      if (bestIdx < 0) {
        console.log(`  skip checkpoint ${cp.id}: no candle near ${cp.decisionDateISO}`)
        continue
      }

      const cut = cutEpisode(candles, bestIdx, cp.beforeCount, cp.afterCount)
      if (!cut) {
        console.log(`  skip checkpoint ${cp.id}: not enough candles around index ${bestIdx}`)
        continue
      }

      const baselines = computeBaselines(cut.before, cut.after)
      const ep: CampaignEpisode = {
        id: cp.id,
        kind: 'time_machine',
        asset: { symbol: camp.assetSymbol, name: camp.assetName },
        timeframe: camp.interval as any,
        before: cut.before,
        after: cut.after,
        tags: cp.tags as any,
        difficulty: cp.difficulty,
        context: cp.context,
        baselines,
      }
      allEpisodes.push(ep)
      campEpisodeIds.push(cp.id)
      console.log(`  checkpoint ${cp.id}: entry=${cut.before[cut.before.length-1][4].toFixed(2)}, hold=${(baselines.hold_return*100).toFixed(1)}%, bot=${(baselines.bot_return*100).toFixed(1)}%`)
    }

    campaigns.push({
      id: camp.id,
      title: camp.title,
      subtitle: camp.subtitle,
      period: camp.period,
      episodeIds: campEpisodeIds,
      summaryTemplate: camp.summaryTemplate,
    })

    await sleep(500)
  }

  writeFileSync(join(CONTENT_DIR, 'campaigns.json'), JSON.stringify(campaigns, null, 2))
  writeFileSync(join(CONTENT_DIR, 'time_machine_episodes.json'), JSON.stringify(allEpisodes, null, 2))

  console.log(`\nDone. ${campaigns.length} campaigns, ${allEpisodes.length} episodes.`)
  console.log('Written: src/content/campaigns.json, src/content/time_machine_episodes.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
