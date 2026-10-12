// App state with AsyncStorage persistence. SPEC.md section 9.
// Decision: AsyncStorage (already installed, Expo-compatible). Recorded in docs/DECISIONS.md.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { applySrDelta, SR_START } from '@/src/engine/rating'
import { applyDailyCompletion, dateToISODate } from '@/src/engine/streak'
import { attemptedTags, weakestTags, type EpisodeResultRecord } from '@/src/engine/metrics'
import type { PatternTag } from '@/src/content/types'

const KEY = '@dojo/state/v1'

export interface RoundResult {
  episodeId: string
  tags: PatternTag[]
  action: 'buy' | 'skip'
  userReturn: number
  botReturn: number
  score: number
  srDelta: number
  difficulty: 1 | 2 | 3
}

export interface DailySession {
  dateISO: string
  episodeIds: string[]
  completedResults: RoundResult[]
}

export interface AppState {
  sr: number
  streakDays: number
  lastCompletedDateISO: string | null
  history: EpisodeResultRecord[]
  currentDaily: DailySession | null
}

export const DEFAULT_STATE: AppState = {
  sr: SR_START,
  streakDays: 0,
  lastCompletedDateISO: null,
  history: [],
  currentDaily: null,
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_STATE }
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // best-effort; don't crash the app over persistence failure
  }
}

export async function recordRoundResult(result: RoundResult): Promise<AppState> {
  const state = await loadState()

  const srAfter = applySrDelta(state.sr, result.score, result.difficulty)

  const historyEntry: EpisodeResultRecord = {
    episodeId: result.episodeId,
    tags: result.tags,
    action: result.action,
    score: result.score,
    dateISO: dateToISODate(new Date()),
  }

  const newState: AppState = {
    ...state,
    sr: srAfter,
    history: [...state.history.slice(-200), historyEntry], // keep last 200
    currentDaily: state.currentDaily
      ? {
          ...state.currentDaily,
          // Use result.srDelta (pre-computed in round screen from the same base SR)
          // to guarantee displayed value matches stored value.
          completedResults: [...state.currentDaily.completedResults, result],
        }
      : null,
  }

  await saveState(newState)
  return newState
}

export async function startDailySession(episodeIds: string[], todayISO: string): Promise<AppState> {
  const state = await loadState()
  // If already started today, return as-is.
  if (state.currentDaily?.dateISO === todayISO) return state
  const newState: AppState = {
    ...state,
    currentDaily: { dateISO: todayISO, episodeIds, completedResults: [] },
  }
  await saveState(newState)
  return newState
}

export async function completeDailySession(): Promise<AppState> {
  const state = await loadState()
  const todayISO = dateToISODate(new Date())
  const { streakDays, lastCompletedDateISO } = applyDailyCompletion(
    { streakDays: state.streakDays, lastCompletedDateISO: state.lastCompletedDateISO },
    todayISO,
  )
  const newState: AppState = { ...state, streakDays, lastCompletedDateISO, currentDaily: null }
  await saveState(newState)
  return newState
}

export function getWeakTags(history: EpisodeResultRecord[]): PatternTag[] {
  return weakestTags(history, 3)
}

export function getAttemptedTags(history: EpisodeResultRecord[]): PatternTag[] {
  return attemptedTags(history)
}
