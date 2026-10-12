// Template-driven insights. SPEC.md section 3.7. No LLM at runtime.
import templates from '@/src/content/insight_templates.json'
import type { RoundResult } from '@/src/state/store'

interface BehaviourMetrics {
  fomoPct: number       // 0–100
  disciplinePct: number // 0–100
  selectivityPct: number
  lastResults: RoundResult[]
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? k))
}

export function generateInsights(metrics: BehaviourMetrics, lastResult: RoundResult): string[] {
  const out: string[] = []

  // FOMO insight
  if (metrics.fomoPct > 50) {
    const fomoTags = new Set(['pump_dump', 'fakeout', 'breakout'])
    const fomoBuys = metrics.lastResults.filter(
      (r) => r.action === 'buy' && r.tags.some((t) => fomoTags.has(t))
    )
    const fomoAvgReturn = fomoBuys.length > 0
      ? Math.round((fomoBuys.reduce((s, r) => s + r.userReturn, 0) / fomoBuys.length) * 100)
      : 0
    out.push(fill(pick(templates.high_fomo), {
      fomoPct: Math.round(metrics.fomoPct),
      fomoAvgReturn: fomoAvgReturn >= 0 ? `+${fomoAvgReturn}` : String(fomoAvgReturn),
    }))
  } else if (metrics.fomoPct < 20 && metrics.lastResults.length >= 5) {
    out.push(pick(templates.low_fomo))
  }

  // Discipline insight
  if (metrics.disciplinePct < 60) {
    const noStopPct = Math.round(100 - metrics.disciplinePct)
    out.push(fill(pick(templates.low_discipline), { noStopPct, disciplinePct: Math.round(metrics.disciplinePct) }))
  } else if (metrics.disciplinePct >= 90) {
    out.push(fill(pick(templates.high_discipline), { disciplinePct: Math.round(metrics.disciplinePct) }))
  }

  // Selectivity insight
  if (metrics.selectivityPct > 65 && metrics.lastResults.length >= 4) {
    out.push(fill(pick(templates.high_selectivity), { selectivityPct: Math.round(metrics.selectivityPct) }))
  } else if (metrics.selectivityPct < 35 && metrics.lastResults.length >= 4) {
    out.push(pick(templates.low_selectivity))
  }

  // Last result quality
  if (lastResult.score > 0.5) {
    out.push(pick(templates.good_score))
  } else if (lastResult.action === 'skip' && lastResult.botReturn > 0) {
    out.push(pick(templates.skip_winner))
  } else if (lastResult.action === 'skip' && lastResult.botReturn <= 0) {
    out.push(pick(templates.skip_loser))
  }

  // Win/loss streak (last 3)
  const last3 = metrics.lastResults.slice(-3)
  if (last3.length === 3) {
    const allPositive = last3.every((r) => r.score > 0)
    const allNegative = last3.every((r) => r.score < 0)
    if (allPositive) out.push(pick(templates.win_streak))
    if (allNegative) out.push(pick(templates.loss_streak))
  }

  return out.slice(0, 2)
}

export function computeBehaviourMetrics(results: RoundResult[]): BehaviourMetrics {
  if (results.length === 0) {
    return { fomoPct: 0, disciplinePct: 100, selectivityPct: 50, lastResults: [] }
  }

  const buys = results.filter((r) => r.action === 'buy')
  const skips = results.filter((r) => r.action === 'skip')

  // FOMO: buys tagged with pump_dump or fakeout (simplified proxy for "after a run")
  const fomoTags = new Set(['pump_dump', 'fakeout', 'breakout'])
  const fomoBuys = buys.filter((r) => r.tags.some((t) => fomoTags.has(t))).length
  const fomoPct = buys.length > 0 ? (fomoBuys / buys.length) * 100 : 0

  // Discipline: buys with score > -0.8 as proxy (actual stop data not stored in history yet)
  // Simplified: use score distribution
  const disciplinePct = buys.length > 0
    ? (buys.filter((r) => r.score > -0.5).length / buys.length) * 100
    : 100

  // Selectivity: skips where botReturn <= 0 (avoided a loser)
  const goodSkips = skips.filter((r) => r.botReturn <= 0).length
  const selectivityPct = skips.length > 0 ? (goodSkips / skips.length) * 100 : 50

  return { fomoPct, disciplinePct, selectivityPct, lastResults: results }
}
