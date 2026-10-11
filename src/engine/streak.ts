// Streak tracking. SPEC.md section 3.8. Zero UI/chain imports.
// Dates are plain 'YYYY-MM-DD' strings (UTC) so this stays pure and easy to test.

export function dateToISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isoDateMinusDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return dateToISODate(d)
}

export function applyDailyCompletion(
  state: { streakDays: number; lastCompletedDateISO: string | null },
  todayISO: string,
): { streakDays: number; lastCompletedDateISO: string } {
  if (state.lastCompletedDateISO === todayISO) {
    // Already completed today — no double-count.
    return { streakDays: state.streakDays, lastCompletedDateISO: todayISO }
  }
  const yesterdayISO = isoDateMinusDays(todayISO, 1)
  const streakDays = state.lastCompletedDateISO === yesterdayISO ? state.streakDays + 1 : 1
  return { streakDays, lastCompletedDateISO: todayISO }
}
