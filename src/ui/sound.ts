// Single entry point for UI sound so it can be globally muted. SPEC.md section 7.
// Sound files land in Phase 7 polish (docs/ASSETS.md will record source/licence);
// call sites use this API now so wiring up playback later touches one file.

export type SoundName = 'tap' | 'reveal' | 'win' | 'loss' | 'levelUp'

let muted = false

export function setSoundMuted(value: boolean) {
  muted = value
}

export function isSoundMuted(): boolean {
  return muted
}

export function playSound(_name: SoundName) {
  if (muted) return
  // No audio assets yet (Phase 7). No-op until docs/ASSETS.md has licensed sources.
}
