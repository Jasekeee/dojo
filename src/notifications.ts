import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

const DAILY_NOTIF_ID = 'dojo-daily-training'
const PREF_KEY_HOUR = '@dojo/notif_hour'
const PREF_KEY_ENABLED = '@dojo/notif_enabled'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily Training',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 100, 150],
      lightColor: '#8B5CFF',
    })
  }
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

function buildMessage(streakDays: number): { title: string; body: string } {
  if (streakDays >= 10) {
    return {
      title: `${streakDays}-day streak. Don't break the chain.`,
      body: '10 charts. 3 minutes. Your edge is compounding.',
    }
  }
  if (streakDays >= 5) {
    return {
      title: `${streakDays}-day streak at risk`,
      body: 'Train today to keep it alive.',
    }
  }
  if (streakDays >= 2) {
    return {
      title: `Day ${streakDays + 1} is ready`,
      body: 'Keep the streak going. 3 minutes.',
    }
  }
  const variants = [
    { title: 'Daily training ready', body: '10 charts. 3 minutes. Train your edge.' },
    { title: 'Time to train', body: "Today's set is waiting. Make the call." },
    { title: 'New daily set', body: 'Sharpen your read. Beat the bot.' },
  ]
  return variants[new Date().getDay() % variants.length]!
}

export async function scheduleDailyNotification(
  hour: number,
  streakDays = 0,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {})

  const msg = buildMessage(streakDays)

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NOTIF_ID,
    content: {
      title: msg.title,
      body: msg.body,
      sound: false,
      data: { screen: 'train' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  })
}

export async function cancelDailyNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {})
}

export async function isDailyNotificationScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  return scheduled.some((n) => n.identifier === DAILY_NOTIF_ID)
}

// Refresh the notification content (call after each session to update streak text)
export async function refreshDailyNotification(streakDays: number): Promise<void> {
  const isOn = await isDailyNotificationScheduled()
  if (!isOn) return
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const existing = scheduled.find((n) => n.identifier === DAILY_NOTIF_ID)
  const trigger = existing?.trigger as any
  const hour: number = trigger?.hour ?? 20
  await scheduleDailyNotification(hour, streakDays)
}

export const NOTIF_TIME_PRESETS = [
  { label: '7 AM', hour: 7 },
  { label: '8 AM', hour: 8 },
  { label: '9 AM', hour: 9 },
  { label: '7 PM', hour: 19 },
  { label: '8 PM', hour: 20 },
  { label: '9 PM', hour: 21 },
] as const

export const DEFAULT_NOTIF_HOUR = 20 // 8 PM
