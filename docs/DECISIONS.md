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

## 2026-10-12 — State persistence: AsyncStorage
- Chose `@react-native-async-storage/async-storage` (already installed, v2.2.0) over MMKV.
- Reason: already a project dependency, no additional native build needed, sufficient for our small state (single JSON blob, ~few KB). MMKV would be faster but requires an extra native module and a rebuild.
- Implementation: `src/state/store.ts` — single key `@dojo/state/v1`.

## 2026-10-12 — Time Machine data: Binance historical fetch
- Fetched historical OHLCV from Binance public API (no key) for 5 campaigns:
  - FTX Collapse Nov 2022: SOLUSDT 4h, Oct 15 – Dec 1 2022 (283 candles). FTX episode 1 entry $35.75, hold −59.3%. Episode 2 entry $20.05 (during collapse), episode 3 entry $14.17 (post-bankruptcy).
  - LUNA Crash May 2022: BTCUSDT 4h, Apr 15 – Jun 1 2022 (283 candles). Entry $36,055 before depeg, $28,472 during.
  - August 2024 Flush: SOLUSDT 4h, Jul 15 – Sep 1 2024 (289 candles). Entry $169.69 before flush, $115.96 at the low.
  - Tariff Shock Apr 2025: BTCUSDT 4h, Mar 15 – May 1 2025 (283 candles). Entry $83,096 before announcement, $76,230 on the pause bounce.
  - Oct 2025 Cascade: SOLUSDT 1h, Sep 20 – Nov 1 2025 (1009 candles). Entry $223.14 and $180.96.
- All data cached in `data/raw/campaign_*.json`. All facts verified from downloaded Binance candles; no numbers invented.

## 2026-10-12 — Removed Memo Certify; Level Badges (SBT) are the only on-chain feature
- Memo certify (SPL Memo, write SR as a signed memo tx) was removed. It was self-signed with no on-chain verifiability — provided no additional value over the Level Badge which contains the same data permanently in token metadata.
- Level Badges (Token-2022 NonTransferable + MetadataPointer + TokenMetadata) are now the sole on-chain feature. They embed `level`, `sr_at_mint`, `minted_at` as additional metadata fields. One badge per level per wallet.
- Deleted: `app/certify.tsx`, all certify-related UI in Profile, `Stack.Screen name="certify"` in `_layout.tsx`.

## 2026-10-12 — Level Badges: mainnet-beta
- Switched from devnet to mainnet-beta (`https://api.mainnet-beta.solana.com`).
- Token-2022 program is live on mainnet. NonTransferable + MetadataPointer + TokenMetadata extensions confirmed available.
- Estimated cost per badge: ~0.004–0.006 SOL in rent (two accounts: Token-2022 mint ~270–350 bytes + ATA 165 bytes). Rent is recoverable in principle if badge closed later.
- Explorer links use mainnet (no `?cluster=` suffix needed; mainnet is default).
- Retry logic added: up to 3 attempts with exponential backoff for 429 / timeout / socket errors.
- Network mismatch (wallet on devnet/testnet): error message "Switch your wallet to Mainnet".
- Metadata + image URLs: `raw.githubusercontent.com/Jasekeee/dojo/main/sbt/metadata/<Level>.{json,png}` — 5 JSON + 5 PNG files committed to repo alongside this decision.

## 2026-10-11 — Skia confirmed working; vitest for engine tests
- SPEC.md section 9 marked `@shopify/react-native-skia` [VERIFY works in the scaffold's dev build]. Installed `@shopify/react-native-skia` (2.14.0) + ran a native rebuild (`expo run:android`): CMake compiled its native libs for arm64-v8a without issue, app installed and the chart rendered correctly on the Seeker. Confirmed working — used for `src/chart/CandleChart.tsx`.
- Test runner: `vitest`, not `jest-expo`. `src/engine/` is zero-UI-dependency pure TS by design (architecture rule in SPEC section 9), so it doesn't need React Native's test environment/mocks — vitest runs it directly and fast (~100ms for 22 tests). `npm test` runs it.
- Caveat hit during setup: running two `npm install` commands concurrently against the same project corrupted `node_modules` (one install's writes got lost). Don't parallelize npm installs in the same working tree — run them sequentially.
