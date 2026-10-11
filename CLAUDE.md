# CLAUDE.md — Dojo (Solana Mobile hackathon "CLOCK IN")

Read `SPEC.md` first. It is the source of truth for scope, rules, design and build order. If code and SPEC disagree, ask Jake which wins, then update SPEC.

## Who you work with
- Jake: crypto-native, **not a developer**. Talks Russian. Wants results, not lectures.
- **Reply in Russian**, short, plain words. No jargon without a one-line explanation.
- Run terminal commands yourself whenever possible. When Jake must do something by hand (phone settings, a button in Android Studio), give numbered steps, one at a time.
- After each step, say in 1–3 sentences what now works and what you'll do next. Show proof (command output, screenshot request, or "open the app and tap X").
- The app UI and all in-app content are **English only**.

## Hard rules
1. **Never invent** APIs, package names, versions, endpoints, mint addresses or numbers. Check official docs (Solana Mobile docs, llms.txt) or test it. Items marked [VERIFY] in SPEC.md must be verified before use. If verification fails, stop, explain, propose a fallback.
2. **No secrets in the repo.** No API keys are used in this project. Never commit `.env`, keystores, wallet seeds.
3. **No destructive commands** (rm -rf outside build dirs, git reset --hard, force-push, global installs that change Jake's setup) without asking.
4. Keep it **offline-first**: the app must not need a server or any API key at runtime.
5. Facts shown to users (dates, headlines, prices) must come from downloaded data or a verified source recorded in `docs/DECISIONS.md`. No hindsight in Time Machine contexts.
6. No LLM at runtime. Insights come from templates driven by computed metrics.
7. No fake users, leaderboards, PnL or "trending" numbers. Bots are labelled as bots.
8. Educational-simulation disclaimer must be visible in Profile/Settings and on the share card.

## Engineering rules
- TypeScript, strict. Follow the structure in SPEC.md section 9; adapt to the scaffold, don't fight it.
- `src/engine/` is pure TS with unit tests (stop/target ordering, same-candle rule, costs, skip, rating, picker determinism). Run tests before saying a phase is done.
- Design tokens first (`src/ui/theme.ts`), then components. No hard-coded colors/spacing in screens.
- Every async/IO path has loading, empty and error states. No blank screens.
- Haptics and sound go through `haptics.ts` / `sound.ts` so they can be muted.
- Feature flags in `src/features/flags.ts` — Jake will add features later; new work should be flag-able.
- Pick one persistence library (AsyncStorage or MMKV) and record the choice in `docs/DECISIONS.md`.
- Performance: chart pan/reveal at 60 fps on Seeker; cold start < 2 s. Measure, don't assume.

## Git
- Commit after every working step, small and meaningful messages (commit history is judged by the hackathon). Push to the public GitHub repo regularly once it exists.
- Don't commit `data/raw/`, `node_modules/`, build outputs, keystores.
- Keep `docs/DECISIONS.md` updated: date, decision, reason, source link.

## Quality bar
This must look and feel like a funded team's app, not a template. Before calling a screen done: check spacing on the 4-pt grid, motion on every state change, haptic/sound feedback, number formatting (tabular figures, signs and arrows), dark-mode contrast, small-screen layout, and what happens with no data.

## Working loop
1. State the phase from SPEC.md section 11 and its "done when".
2. Do the smallest vertical slice that proves it.
3. Run/test it (emulator or Seeker). Fix.
4. Commit. Report to Jake in Russian.
5. Update `docs/DECISIONS.md` if anything was decided or verified.

## Timeline guardrails
Deadline: Tue 13 Oct 2026 04:59 GMT+5. Internal submission target: Mon 12 Oct 23:00 local. Feature freeze: Mon 12 Oct ~15:00 local. If a phase is slipping, cut in the order given in SPEC.md section 10 (P3 → P2 → P1) and tell Jake plainly. Never cut P0.

## First task when Jake says "start"
Phase 0 of SPEC.md: check Node (24 LTS), git, Java, adb; ask Jake whether the Seeker shows in `adb devices` (if not, walk him through USB debugging); scaffold with `npm create solana-dapp@latest` (choose the Solana Mobile / React Native template; project name `dojo`); run the hello app; make the first commit; create the public GitHub repo. Then Phase 1 (data spike).
