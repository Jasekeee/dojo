// React hook for app state. Loads once on mount; exposes helpers used by screens.
import { useCallback, useEffect, useState } from 'react'
import { loadState, type AppState, type RoundResult, recordRoundResult, startDailySession, completeDailySession } from './store'
import { episodes } from '@/src/content/episodes'
import { pickDailySet } from '@/src/engine/picker'
import { dateToISODate } from '@/src/engine/streak'
import { getAttemptedTags, getWeakTags } from './store'

const LOADING_STATE: AppState = {
  sr: 500,
  streakDays: 0,
  lastCompletedDateISO: null,
  history: [],
  currentDaily: null,
}

export function useAppState() {
  const [state, setState] = useState<AppState>(LOADING_STATE)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const s = await loadState()
    setState(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const todayISO = dateToISODate(new Date())

  const dailyNumber = (() => {
    // Deterministic daily number from epoch day count.
    const epoch = new Date('2026-10-11T00:00:00.000Z').getTime()
    const now = new Date(`${todayISO}T00:00:00.000Z`).getTime()
    return Math.max(1, Math.round((now - epoch) / 86400000) + 1)
  })()

  const isDailyDone = state.lastCompletedDateISO === todayISO

  const dailyEpisodeIds = (() => {
    if (state.currentDaily?.dateISO === todayISO) return state.currentDaily.episodeIds
    const weakTags = getWeakTags(state.history)
    const attempted = getAttemptedTags(state.history)
    return pickDailySet({ episodes, date: new Date(todayISO + 'T00:00:00.000Z'), weakTags, attemptedTags: attempted })
      .map((ep) => ep.id)
  })()

  const ensureDailyStarted = useCallback(async (): Promise<string[]> => {
    const s = await startDailySession(dailyEpisodeIds, todayISO)
    setState(s)
    return s.currentDaily!.episodeIds
  }, [dailyEpisodeIds, todayISO])

  const saveRound = useCallback(async (result: RoundResult) => {
    const s = await recordRoundResult(result)
    setState(s)
    return s
  }, [])

  const finishDaily = useCallback(async () => {
    const s = await completeDailySession()
    setState(s)
    return s
  }, [])

  return {
    state,
    loading,
    refresh,
    dailyNumber,
    isDailyDone,
    dailyEpisodeIds,
    ensureDailyStarted,
    saveRound,
    finishDaily,
  }
}
