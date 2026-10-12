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
  /** Chip tap, tab change, selection change */
  select: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Primary button press, action confirmation */
  confirm: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /** Profitable trade, certification success */
  win: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Unprofitable trade — soft double-tap */
  loss: async () => {
    if (muted) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise((resolve) => setTimeout(resolve, 90))
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  },
  /** Streak milestone, level-up */
  streakMilestone: () => !muted && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  /** Network/system error — distinct from trade loss */
  error: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Non-critical warning (e.g. no stop set) */
  warning: () => !muted && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
}
