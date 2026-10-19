// Analytics — PostHog. Key is public/write-only, safe to bundle.
// To activate: set POSTHOG_KEY in app.json extra, or replace the constant below.
// All calls are fire-and-forget and gracefully no-op if PostHog fails.
import PostHog from 'posthog-react-native'

const POSTHOG_KEY = (process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '') as string
const POSTHOG_HOST = 'https://eu.i.posthog.com'

let client: PostHog | null = null

export function initAnalytics(): void {
  if (!POSTHOG_KEY) return // no key → silent no-op in dev
  try {
    client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST, flushAt: 10, flushInterval: 30000 })
  } catch {}
}

function track(event: string, props?: Record<string, string | number | boolean | null>): void {
  try { client?.capture(event, props as any) } catch {}
}

// ─── Typed events ─────────────────────────────────────────────────────────────

export const analytics = {
  appOpen: (props: { sr: number; level: string; streakDays: number }) =>
    track('app_open', props),

  dailyStarted: (props: { dailyNumber: number; sr: number }) =>
    track('daily_started', props),

  roundDecided: (props: {
    action: 'long' | 'short' | 'skip'
    episodeId: string
    tags: string[]
    difficulty: number
    sessionIndex: number
  }) => track('round_decided', {
    action: props.action,
    episodeId: props.episodeId,
    tags: props.tags.join(','),
    difficulty: props.difficulty,
    sessionIndex: props.sessionIndex,
  }),

  sessionComplete: (props: {
    rounds: number
    wins: number
    winRate: number
    srBefore: number
    srAfter: number
    srDelta: number
    streakDays: number
    dailyNumber: number
  }) => track('session_complete', props),

  notificationOptedIn: (props: { hour: number; trigger: 'prompt' | 'settings' }) =>
    track('notification_opted_in', props),

  sbtMinted: (props: { level: string; sr: number }) =>
    track('sbt_minted', props),

  timeMachineStarted: (props: { campaignId: string }) =>
    track('time_machine_started', props),

  shareCardShared: (props: { sr: number; level: string; streakDays: number }) =>
    track('share_card_shared', props),

  onboardingComplete: () =>
    track('onboarding_complete'),
}
