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
