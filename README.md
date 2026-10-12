# Dojo — Trade Trainer for Solana Mobile

> "Most traders lose money. Nobody trains before they risk it."

**Dojo** is a "Duolingo × flight simulator" for trading decisions. You make real buy/skip/exit decisions on hidden, real historical charts — zero money at risk — and earn a verified Skill Rating you can write to Solana.

Built for the **CLOCK IN — Solana Mobile × Radiants** hackathon.

---

## What it is

- **Daily Training** — 10 real historical charts per day, ~3 minutes. Make BUY or SKIP decisions, see what happened next, get scored against a disciplined bot baseline.
- **Time Machine** — "It's Nov 2022. A major exchange just froze withdrawals. Here's the SOL chart. What do you do?" Play through 5 real market crashes with factual headlines. No hindsight in the prompts.
- **Skill Rating (SR)** — 0–1000, starts at 500. Beats the bot → SR goes up. Skipping losers also scores positively. Certify your SR on Solana via a Memo transaction.
- **Behaviour metrics** — FOMO index, discipline (stops set %), selectivity. Template-driven insights after each session.

**What it is NOT:** financial advice, a trading signal service, real-money gambling, or a custody product.

*Educational simulation. Not financial advice. Past performance doesn't predict future results.*

---

## Screens

| Screen | Description |
|---|---|
| Train | Daily #N hero card, SR + level, Practice by topic |
| Round | Full-screen Skia chart, BUY/SKIP sheet, size/stop/target chips |
| Reveal | Chart draws forward, entry/stop/target lines, PnL counter |
| Result | Score, SR delta, vs bot vs hold, 1–2 insight sentences |
| Time Machine | 5 campaign cards; context headline; checkpoint sequence |
| Profile | SR, level, discipline/selectivity/anti-FOMO bars, history |
| Certify | Connect Phantom/Solflare via MWA, sign Memo tx, Explorer link |

---

## Architecture

```
src/engine/     pure TypeScript — sim, rating, score, picker, metrics, streak, insights
src/content/    episodes.json (835 daily episodes), campaigns.json (5 Time Machine campaigns)
src/ui/         theme tokens, components (Chart, DecisionSheet, Card…), haptics, sound
src/state/      AsyncStorage persistence — SR, streak, history, daily session
src/chain/      MWA certify (memo tx), SGT badge check
pipeline/       Node scripts — fetch Binance/GeckoTerminal, slice, label, baselines, export
```

Zero backend. Offline-first. No API keys at runtime. No LLM.

---

## Solana Mobile integration

- **MWA** — wallet connect + sign via `@wallet-ui/react-native-web3js` (official Solana Foundation template)
- **Certify** — builds a `TransactionMessage` with a Memo instruction (SPL Memo program), signs via MWA, confirms, shows Explorer link
- **SGT badge** — reads token accounts via public RPC; shows "Verified Seeker" badge if holder (zero-balance burned tokens ignored)

---

## Running locally

```bash
npm install
npm test            # 38 engine unit tests
expo run:android    # requires Seeker or Android emulator + adb
```

### Regenerate episode data

```bash
npx tsx pipeline/fetch.ts          # 835 daily episodes
npx tsx pipeline/fetch-campaigns.ts  # 5 Time Machine campaigns (fetches Binance historical data)
```

---

## Technical depth highlights

- **835 labelled episodes** from Binance + GeckoTerminal; includes dead/rugged Solana tokens (anti-survivorship bias)
- **7 pattern tags** with configurable thresholds: breakout, fakeout, range, pump_dump, slow_bleed, trend_pullback, capitulation
- **Deterministic daily set** via seeded mulberry32 PRNG — same date = same 10 charts globally
- **Simulation engine** — stop/target ordering, same-candle conservative rule, 1% round-trip cost
- **SR scoring** — `tanh(edge / 0.15)` where `edge = user_return − bot_return`; rewards selectivity, not boldness
- **60 fps Skia chart** — CandleChart renders to native canvas, reveal animation candle-by-candle
- **Offline-first** — everything works on airplane mode; wallet actions are the only network dependency

---

## Time Machine campaigns (all data from Binance public API, no keys required)

| Campaign | Asset | Period | Candles fetched |
|---|---|---|---|
| FTX Collapse | SOL 4h | Oct–Dec 2022 | 283 |
| LUNA Crash | BTC 4h | Apr–Jun 2022 | 283 |
| August 2024 Flush | SOL 4h | Jul–Sep 2024 | 289 |
| Tariff Shock | BTC 4h | Mar–May 2025 | 283 |
| October 2025 Cascade | SOL 1h | Sep–Nov 2025 | 1009 |

All facts/prices verified from downloaded candle data. See `docs/DECISIONS.md` for full source log.

---

## Roadmap (post-hackathon)

- Sponsor-funded weekly pot gated by SGT holders
- cNFT "diploma" minted on completion of a Time Machine campaign
- Wallet-trade replay (requires an on-chain indexer)
- On-chain red-flag module (flags wallets active before a crash)
- SKR-staked boosts to SR multiplier

---

## Disclaimer

Educational simulation only. Not financial advice. Past performance does not predict future results. All charts show real historical data; all trading is simulated with "training USDC" — no real money involved.
