# DOJO — Product & Build Spec (working name)

> Status legend: **[FACT]** verified from an official source · **[ASSUMPTION]** my working assumption · **[VERIFY]** Claude Code must check against official docs or by a quick test BEFORE relying on it. Never invent an API, package name, endpoint or number. If a [VERIFY] item fails, stop, report in plain Russian, propose a fallback.

Owner: Jake (non-developer, solo, vibe-coding with Claude Code). Hackathon: **CLOCK IN — Solana Mobile × Radiants**.

---

## 0. One-liner

**Dojo is a "Duolingo × flight simulator" for trading decisions.** You make real buy/skip/exit decisions on hidden, real historical charts, with zero money at risk, and get a verified skill rating you can write to Solana.

Hook for judges: **Time Machine** — "It's 8 Nov 2022. A major exchange just froze withdrawals. Here's the chart. What do you do?" — then the real outcome is revealed. Plus a daily set of 10 situations (Daily #N) for habit.

What it is NOT: a trading signal service, financial advice, a casino, a custody product.

---

## 1. Hackathon constraints

**[FACT]** (portal / rules, as read by Jake)
- Deadline: **Tue 13 Oct 2026, 04:59 GMT+5**. Jake's internal target: submit **Mon 12 Oct by 23:00 local**. Feature freeze: **Mon 12 Oct ~15:00 local**.
- Submission = functional **Android APK** + **public GitHub repo** + **demo video ≤ 3 min** + **pitch deck**.
- Android only. Must integrate **Solana Mobile Stack: Mobile Wallet Adapter (MWA)**. PWA/WebView wrappers score poorly → build native React Native.
- Solo allowed. Winners publish to dApp Store within 30 days and may face code review.
- Only confirmed judging weight: **Stickiness & PMF 25%**. Other criteria seen: completion (demo video), technical depth (GitHub commits), mobile UX/mobile-specific features, Solana network usage, clarity/vision of the pitch. Other weights NOT confirmed — do not assume.
- Past winners (MONOLITH) were consumer apps built around Seeker features; none was a trading trainer. [FACT, from Solana Mobile blog]

**Implications:** commit often (commit history is judged), polish the core loop, demo must work offline-safe, show MWA + Solana usage clearly.

---

## 2. Product principles

1. **Depth over breadth.** One loop (decide → reveal → learn) must feel Tier-1 (Robinhood-grade motion, Duolingo-grade feedback). Everything else is secondary.
2. **Offline-first, zero backend.** All content is bundled in the APK. No servers, no API keys, no downtime during the demo.
3. **No fake data.** No fake users, fake leaderboards, fake PnL. "Ghost" opponents are clearly labelled rule-based bots.
4. **Honest framing.** Education/simulation only. On-screen note: *"Educational simulation. Not financial advice. Past performance doesn't predict future results."*
5. **Expandable.** Jake will add features later → modular architecture (section 9), content engine separate from UI.
6. **English only** (UI and content).
7. **Single-player value from the first minute.** Nothing requires other players.

---

## 3. Core loop & simulation rules

### 3.1 Episode (one situation)
```
Episode {
  id: string
  kind: "daily_pool" | "time_machine"
  asset: { symbol, name }          // hidden until reveal
  timeframe: "5m" | "15m" | "1h" | "4h" | "1d"
  before: Candle[]                 // visible, ~60–120 candles
  after: Candle[]                  // hidden until decision, ~30–60 candles
  tags: PatternTag[]               // from labelers, e.g. "breakout","pump_dump"
  difficulty: 1 | 2 | 3
  context?: { date, headline, body }   // for time_machine only (no hindsight!)
  baselines: { bot_return, hold_return }  // precomputed
}
Candle = [t, open, high, low, close, volume]
```

### 3.2 Decision
- Action: **BUY** or **SKIP**.
- If BUY: **size** ∈ {25%, 50%, 100%} of virtual equity; **stop** ∈ {−10%, −20%, −30%, none}; **target** ∈ {+25%, +50%, +100%, none}.
- UI must make this feel like 2–3 fast gestures, ≤ 10 seconds. Default values preselected (size 50, stop −20, target +50) so a decision can be one tap.

### 3.3 Simulation (pure function, unit-tested)
- Entry price = **close of last visible candle** [ASSUMPTION; keep configurable].
- Walk `after` candles in order. For each candle: if low ≤ stop → exit at stop; if high ≥ target → exit at target. **If both hit in the same candle, assume stop hit first** (conservative).
- If neither is hit, exit at **close of last `after` candle**.
- Costs: apply **round-trip cost of 1.0%** [ASSUMPTION, constant `COST_ROUND_TRIP`, configurable] to model fees/slippage.
- Return on equity = `size × (exit/entry − 1 − cost)`.
- Virtual equity per round starts at 1000 "training USDC". Show as such — never as real money.
- SKIP → return 0.

### 3.4 Baselines (precomputed per episode in the pipeline)
- `hold_return`: buy 100%, hold to end.
- `bot_return`: "disciplined bot" — BUY 50%, stop −20%, target +50%, same rules.

### 3.5 Episode score
```
edge   = user_return − bot_return
score  = tanh(edge / 0.15)      // in (−1, 1); 0.15 is tunable
```
Skipping a loser → positive edge; skipping a winner → negative edge. This rewards selectivity, not just boldness.

### 3.6 Skill Rating (SR) 0–1000
- Start 500. After each episode: `SR += K × score × difficultyWeight` with K=12, difficultyWeight ∈ {0.8, 1.0, 1.2}. Clamp [0, 1000].
- Levels [ASSUMPTION, tunable]: Rookie <300 · Analyst 300–499 · Trader 500–699 · Sniper 700–849 · Legend ≥850.
- **Calibration test (required):** Monte-Carlo with (a) random policy, (b) always-bot policy, (c) always-skip policy over the real episode set. Random policy must hover around 400–500; bot policy must trend upward; always-skip must not climb. Report the numbers to Jake in plain Russian before moving on.

### 3.7 Behaviour metrics (shown on Result and Profile)
- **FOMO index**: % of BUYs made when the previous 12 candles rose ≥ 25% [param].
- **Discipline**: % of BUYs that had a stop set.
- **Selectivity**: % of SKIPs that avoided a loss vs the bot.
- **Risk**: average size and worst in-round drawdown.
Insight text = **templates driven by these numbers** (no LLM). Write ≥ 30 template sentences, varied, human tone, e.g. *"3 of your last 4 entries came right after a +30% run. Those averaged −18%."*

### 3.8 Daily set
- **Daily #N**: 10 episodes chosen with a seeded RNG from the date (same set for everyone that day) so results are shareable.
- Composition: ~60% from the user's weakest tags, ~30% random, ~10% new tags; difficulty ramps 1→3 [ASSUMPTION].
- Streak: consecutive days with a completed Daily. Stored locally.

---

## 4. Content engine (pipeline/)

Runs on Jake's Mac with Node. Output files are committed to the repo and bundled in the app. The app never calls these APIs.

### 4.1 Sources (no API keys)
- Majors: **Pyth Benchmarks** TradingView-style history endpoint [VERIFY exact URL, symbols, resolutions, rate limits, history depth].
- Meme/long-tail tokens: **GeckoTerminal public API** (pools list + OHLCV) [VERIFY endpoints, rate limits (very low?), terms of use].
- If a source is unusable: STOP and report; fallback options to propose: fewer tokens, majors only, cache more slowly.

### 4.2 Steps
1. `fetch`: choose universe — majors + ~150–300 Solana tokens, **including dead/rugged ones** (avoid survivorship bias). Cache raw responses in `data/raw/` (gitignored).
2. `slice`: cut windows (`before` + `after`) at candidate decision points; vary timeframe.
3. `label`: rule-based pattern tags with configurable thresholds:
   - `breakout` (new N-candle high + volume spike), `fakeout` (breakout then reversal), `range` (low ATR, mean-reverting), `pump_dump` (> +X% then −Y% within window), `slow_bleed` (lower highs/lows), `trend_pullback`, `capitulation` (large red candle + volume spike).
4. `baselines`: compute `hold_return`, `bot_return` per episode.
5. `filter`: drop episodes with gaps, zero-volume, absurd outliers; ensure tag balance and a healthy mix of winners and losers (target roughly 40–60% bot-profitable).
6. `export`: `src/content/episodes.json` (+ split files if large). Target **≥ 600 episodes**, stretch 1000+. Report APK size impact.
7. **Manual QA:** render 20 random episodes into a debug screen; Jake and Claude look at them. Fix labelers if they look wrong.

### 4.3 Anti-memorization
Hide ticker/dates until reveal; randomly mirror (invert) some charts for `daily_pool` episodes [ASSUMPTION: only for synthetic-looking meme patterns; don't mirror Time Machine].

---

## 5. Time Machine (the shock hook)

Curated campaigns (aim 8–10; quality over quantity). Each campaign = 3–4 checkpoint episodes across one real event (before / during / after), with a factual headline and 2–3 sentence context **written without hindsight**. At the end: a summary card "You survived X: +8.2% vs holding −31%".

Candidate events (**[VERIFY] every date, number and data availability; drop any we can't back with downloaded data; never state facts we haven't checked**):
- Collapse of a major exchange, Nov 2022 (SOL drawdown).
- Stablecoin depeg crash, May 2022.
- Aug 2024 global risk-off flush.
- Jan 2025 high-profile memecoin launches.
- Early-2025 memecoin collapse episode.
- Apr 2025 tariff shock.
- 10 Oct 2025 liquidation cascade (one year ago).

Share card: image with campaign name, result, rating, "Dojo" branding; use native share sheet [VERIFY library].

---

## 6. Screens & UX

Bottom tabs: **Train · Time Machine · Profile**.

1. **Onboarding (≤ 3 screens, skippable).** Third screen drops the user into a *real* first episode — play before any wallet prompt.
2. **Train (home).** Greeting, streak, SR + level, "Daily #N" hero card (10 charts, ~3 min), "Practice by topic" tags, last result.
3. **Round.** Full-screen chart (60 fps, smooth crosshair/pan optional), progress dots, top bar with timeframe and "Equity". Bottom sheet: Buy/Skip, size chips, stop/target chips, big primary button.
4. **Reveal.** Chart continues to draw in with motion; entry/stop/target lines; PnL counter animates; haptic + sound. Asset name revealed with a flourish.
5. **Round result / Daily summary.** Score, SR delta, behaviour metrics, 1–2 template insights, share button.
6. **Time Machine.** Campaign cards (locked/unlocked/completed), campaign intro with date + headline, checkpoints, final summary card.
7. **Profile.** SR, level, radar/bars of the 4 metrics, history, streak calendar, **Certify** button, SGT badge if verified, settings (notifications, sound, haptics).
8. **Certify sheet.** Explains what will be written, requests MWA connect → sign → success with Explorer link.

Empty/error/loading states are required (no blank screens). Offline must work everywhere except wallet actions.

---

## 7. Design system (Tier-1 bar)

[ASSUMPTION — proposal; refine using the `frontend-design` skill if available. Define tokens FIRST in `src/ui/theme.ts`, then build components.]

- **Mood:** dark, premium, fintech-meets-game. Calm surfaces, one electric accent, rich motion.
- **Colors (tokens):** bg0 `#0A0B0F`, bg1 `#12141A`, bg2 `#1A1D26`, line `#262A36`, text `#F4F6FA`, muted `#8A91A3`, brand `#8B5CFF`, gain `#9CFF57`, loss `#FF5C7A`, warn `#FFB84D`. Never rely on color alone for gain/loss: also use ▲/▼ and +/−.
- **Type:** Inter (UI) + a display face for numbers/headlines (e.g. Space Grotesk) [VERIFY availability via Expo Google Fonts]; tabular figures for all numbers.
- **Grid/shape:** 4-pt spacing grid; radius 16 (cards), 24 (sheets), 999 (chips).
- **Motion:** spring-based (Reanimated); shared timings in one file; every state change animated; no abrupt jumps. Respect reduce-motion.
- **Haptics:** select = light; confirm = medium; win = success pattern; loss = soft double-tap; streak milestone = heavy.
- **Sound:** short, subtle UI sounds (tap, reveal, win, loss, level-up); global mute toggle. Use only royalty-free or self-generated sounds; record the source/licence in `docs/ASSETS.md`.
- **Performance budget:** cold start < 2 s on Seeker; chart interactions at 60 fps; no network on the hot path.
- **Copy:** short, confident, human. No jargon walls.

---

## 8. Solana Mobile integration

1. **MWA** (wallet connect + sign) via the official template/SDK [VERIFY current package names & versions from the official docs / llms.txt; use whatever `npm create solana-dapp@latest` scaffolds].
2. **Certify = write rating to Solana.**
   - Payload (compact JSON, ≤ ~500 bytes): `{ v:1, app:"dojo", sr, level, rounds, metricsHash, ts }`.
   - Build a transaction with a **Memo instruction** using the official memo package [VERIFY], sign through MWA, send, store the signature, show an Explorer link.
   - Cluster is config-driven: **devnet while developing, mainnet for the final build** (tiny fee; decide at freeze with Jake) [OPEN QUESTION].
3. **Seeker Genesis Token (SGT) check** — "Verified Seeker" badge:
   - Read the wallet's token accounts via a public RPC and look for the SGT mint [VERIFY the official SGT mint address and the recommended verification method in Solana Mobile docs — do NOT hardcode from memory; verify holder semantics (zero balances ignored)].
   - If no SGT (e.g. emulator, other device): app works normally, just no badge.
4. **Seed Vault / biometrics** are used implicitly through the wallet's signing flow; do not claim more than what is actually happening.
5. **Roadmap (not in MVP, can be shown as slides):** sponsor-funded weekly pot gated by SGT, cNFT "diploma", SKR-staked boosts, wallet-trade replay (needs an indexer), on-chain red-flag module.
6. **Gasless fee option (stretch):** Kora-style fee abstraction so users without SOL can certify [VERIFY].

---

## 9. Architecture

```
dojo/
  app/ or src/screens/    screens (follow the scaffold's router)
  src/engine/             pure TypeScript: sim.ts, rating.ts, metrics.ts, picker.ts, insights.ts  (+ unit tests)
  src/content/            episodes*.json, campaigns.json, insight_templates.json
  src/ui/                 theme.ts, motion.ts, haptics.ts, sound.ts, components/
  src/chart/              Skia chart components [VERIFY Skia works in the scaffold's dev build]
  src/state/              store (small, typed), persistence (AsyncStorage/MMKV) [pick one]
  src/chain/              mwa.ts, sgt.ts, memo.ts, config.ts (cluster, RPC)
  src/features/flags.ts   feature flags so new screens can be switched on/off
  pipeline/               fetch.ts, slice.ts, label.ts, baselines.ts, export.ts (Node scripts, not bundled)
  docs/                   DECISIONS.md, ASSETS.md, DEMO.md
  data/raw/               gitignored cache
```
Rules: engine has **zero** UI/chain imports; chain layer has zero engine imports; content loaded through one typed loader. Adapt to the scaffold; don't fight it.

---

## 10. Scope

| Tier | Scope | Cut order |
|---|---|---|
| **P0 (must)** | Pipeline → ≥600 episodes · design system · Train/Round/Reveal/Result · sim + rating + metrics + insight templates · Daily #N + streak · onboarding · polish (haptics, sound, motion) · release APK | never cut |
| **P1 (must for hackathon rules)** | Time Machine (≥5 campaigns) · MWA connect · Certify memo · SGT badge · Profile · share card · local daily notification [VERIFY expo-notifications] | cut last |
| **P2 (nice)** | More campaigns (8–10) · "Ghost" bots comparison view · topic practice filters · sound pack polish | cut 2nd |
| **P3 (stretch)** | Gasless certify · wallet-trade replay · cNFT diploma | cut first |

**Non-goals:** accounts/backend, real-money prizes or payouts, social/leaderboards with other users, financial advice, any LLM at runtime.

---

## 11. Build order (timeboxes are targets, not promises)

Now = Sun 11 Oct ~16:40 local. Freeze = Mon 12 Oct ~15:00.

| # | Phase | Target | Done when |
|---|---|---|---|
| 0 | Env + scaffold: verify Node 24 LTS, adb, create project from `npm create solana-dapp@latest` (Solana Mobile template), run "hello" on emulator or Seeker | 45 min | App launches; commit |
| 1 | **Data spike** (pipeline/): fetch ~20 tokens + 2 majors, slice, label, render ~10 episodes in a debug screen | 90 min | Jake sees real charts; sources confirmed or fallback chosen |
| 2 | Design system + navigation + Train screen skeleton | 2 h | Looks premium with fake data |
| 3 | Round loop: chart, decision sheet, sim engine + tests, reveal, result | 4 h | One full round feels great |
| 4 | Scale pipeline to ≥600 episodes + labelers + picker + Daily #N + streak | 2 h | Daily set works offline |
| 5 | Time Machine campaigns (≥5) | 2 h | Full campaign playable end-to-end |
| 6 | MWA + SGT + Certify (devnet first) | 2.5 h | Memo tx visible on Explorer |
| 7 | Polish: onboarding, haptics, sound, share card, empty/error states, perf | 3 h | Demo path flawless on Seeker |
| 8 | **FREEZE** → release APK, test on real Seeker, mainnet switch decision, bug fixes only | 2 h | Signed APK installed on device |
| 9 | README, repo cleanup, demo video (≤3 min), pitch deck, submit | 3 h | Submitted on portal |

Commit after every working step with a meaningful message (commit history is judged). Push to a **public** GitHub repo as soon as phase 0 is done.

---

## 12. Acceptance criteria (P0+P1)

- Fresh install → first episode playable in < 30 s, no wallet required.
- Full Daily (10 episodes) completes with correct results, rating update, insights, streak.
- Sim engine unit tests pass (stop/target ordering, same-candle rule, costs, skip) and calibration report delivered.
- Time Machine: ≥ 5 campaigns playable; every fact/number on screen traceable to downloaded data or a verified source recorded in `docs/DECISIONS.md`.
- Certify produces a confirmed tx and an Explorer link; SGT badge appears on a device with SGT.
- Airplane mode: everything except wallet actions works.
- 60 fps on Seeker for chart pan/reveal (check, don't assume).
- Release APK installs and runs on the real Seeker.

---

## 13. Risks & open questions

| Risk / question | Plan |
|---|---|
| Data sources limited or terms unclear | Phase 1 spike decides; fallback = fewer tokens / majors only |
| Auto-labelled episodes look silly | Manual QA of 20 random samples; tune thresholds; drop bad tags |
| Looks like "just a quiz" | Invest in motion, haptics, reveal, share card; Time Machine drama |
| Skia/Reanimated friction in the Solana scaffold | Verify in phase 0/1 with a tiny chart test |
| Memo tx needs SOL for fee | Keep devnet for dev; for mainnet final, tell users clearly; stretch: gasless |
| Dev experience of a non-developer | Claude Code runs commands itself, explains in plain Russian, one step at a time |
| Name "Dojo" may clash | Treat as working name; check dApp Store/GitHub before submission |
| Rule uncertainty (prizes, categories) | No real-money prizes in MVP; revisit with Jake if rules change |

Open questions for Jake (ask when relevant, not now): final app name · devnet vs mainnet for the submitted build · whether to include Ghost bots in the demo.

---

## 14. Demo script (≤ 3:00) & submission checklist

**Demo:** 0:00 hook line ("Most traders lose money. Nobody trains before they risk it.") → 0:15 Time Machine intro (date + headline) → 0:35 decision → reveal with haptics → 1:05 result + insights + rating → 1:30 Daily #N montage → 1:50 Certify with wallet → Explorer link, SGT badge → 2:20 roadmap slide (sponsor pot, red-flag module, wallet replay) → 2:45 close.

**Checklist:** public repo with clean README (what/why/how to run/screens/architecture/roadmap/disclaimer) · release APK attached · demo video ≤ 3 min · pitch deck (problem, solution, demo, why Solana Mobile, traction/plan, roadmap) · portal form filled · submission confirmed before Mon 23:00 local.
