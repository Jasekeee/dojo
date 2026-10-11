// Single entry point for haptic feedback so it can be globally muted. SPEC.md section 7:
// select = light, confirm = medium, win = success, loss = soft double-tap, streak = heavy.

import * as Haptics from 'expo-haptics'

let muted = false

export function setHapticsMuted(value: boolean) {
  muted = value
}

export function isHapticsMuted(): boolean {
  return muted
}

export const haptics = {
  select: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  confirm: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  win: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  loss: async () => {
    if (muted) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise((resolve) => setTimeout(resolve, 90))
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  },
  streakMilestone: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
}
