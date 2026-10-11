# Decisions log

Format: date — decision — reason — source/verification.

## 2026-10-11 — Scaffold template: `web3js-expo`
Chosen via `npm create solana-dapp@latest` → template `gh:solana-foundation/templates/mobile/web3js-expo` ("Mobile Expo Boilerplate").
- Reason: official Solana Foundation mobile template, keyword-tagged `mobile-wallet-adapter`, `expo`, `react-native`, `solana-web3js` — matches SPEC.md section 8 requirement for MWA via the official template/SDK.
- Verified: built and ran on a real Seeker device (Phase 0). Demo screen shows a connected wallet and a working "Sign Message" MWA flow out of the box via `@wallet-ui/react-native-web3js` (^4.0.1) + `@solana/web3.js` (^1.98.4).
- Package manager: npm (per `create-solana-dapp` default / project convention).

## 2026-10-11 — Android NDK version: 27.1.12297006
- Reason: required by the React Native / Gradle Android build (`rootProject.ext.ndkVersion`); not present on Jake's machine initially, causing `expo run:android` to fail with `InstallFailedException` when Gradle's own auto-download also failed.
- Fix: installed Android cmdline-tools via `brew install --cask android-commandlinetools`, then ran `sdkmanager --sdk_root="$ANDROID_HOME" "ndk;27.1.12297006"` to install directly into the project's existing SDK root (`~/Library/Android/sdk`), so it's visible to the Gradle build.
- Verified: `expo run:android` built and installed successfully after this fix.

## 2026-10-11 — npm cache permissions
- Issue: `~/.npm` cache folder had root-owned files from a prior `sudo npm` use, blocking all `npm install`.
- Fix: `sudo chown -R 501:20 "$HOME/.npm"` (run by Jake).

## 2026-10-11 — Data sources: Pyth dropped, Binance + GeckoTerminal instead
- SPEC originally planned Pyth Benchmarks (TradingView history shim) for majors (SOL/BTC/ETH). Verified it now requires a paid API key (`Authorization: Bearer $PYTH_API_KEY`) since the 26 Aug 2026 Pyth Core upgrade — violates the project's no-API-keys rule. Dropped.
- **Majors + all Time Machine campaigns → Binance public REST API** (`api.binance.com/api/v3/klines`). No key, no auth. Verified live: queried SOLUSDT daily candles around Nov 2022 and got the real FTX-collapse crash ($29.62 → $14.08 in two days), confirming both availability and the correct crash date/magnitude for that Time Machine campaign.
- **Meme/long-tail Solana tokens (Daily pool only) → GeckoTerminal public API** (`api.geckoterminal.com/api/v2/networks/solana/pools/{pool}/ohlcv/{timeframe}`). No key. Verified live against a real Orca SOL/USDC pool (`Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE`). Confirmed hard limit: 401 error querying beyond 180 days back on the free tier — so GeckoTerminal is Daily-pool-only, never Time Machine. Rate limit ~10 req/min — pipeline fetch script must throttle, not parallelize.
- SPEC.md section 4.1 updated to match.

## 2026-10-11 — Fonts: Inter + Space Grotesk via Expo Google Fonts
- SPEC.md section 7 marked this [VERIFY]. Confirmed `@expo-google-fonts/inter` and `@expo-google-fonts/space-grotesk` exist on npm (0.4.x, actively published) and install cleanly against Expo SDK 55 (no peer dep conflicts). Wired into `app/_layout.tsx` via `useFonts`; rendered correctly on the Seeker (Phase 2 Train screen).

## 2026-10-11 — Removed wallet-gated navigation
- The scaffold's `app/_layout.tsx` wrapped `(tabs)` in `<Stack.Protected guard={isAuthenticated}>`, forcing MWA wallet sign-in before any screen was reachable. This violates SPEC.md P0 ("Fresh install -> first episode playable in < 30s, no wallet required") and section 12 acceptance criteria.
- Fix: removed the guard; `(tabs)` is always reachable, `sign-in` stays as an ordinary route for later Certify/Account flows, not a startup gate.

## 2026-10-11 — Skia confirmed working; vitest for engine tests
- SPEC.md section 9 marked `@shopify/react-native-skia` [VERIFY works in the scaffold's dev build]. Installed `@shopify/react-native-skia` (2.14.0) + ran a native rebuild (`expo run:android`): CMake compiled its native libs for arm64-v8a without issue, app installed and the chart rendered correctly on the Seeker. Confirmed working — used for `src/chart/CandleChart.tsx`.
- Test runner: `vitest`, not `jest-expo`. `src/engine/` is zero-UI-dependency pure TS by design (architecture rule in SPEC section 9), so it doesn't need React Native's test environment/mocks — vitest runs it directly and fast (~100ms for 22 tests). `npm test` runs it.
- Caveat hit during setup: running two `npm install` commands concurrently against the same project corrupted `node_modules` (one install's writes got lost). Don't parallelize npm installs in the same working tree — run them sequentially.
