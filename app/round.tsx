import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { CandleChart } from '@/src/chart/CandleChart'
import { episodes } from '@/src/content/episodes'
import type { Episode } from '@/src/content/types'
import { computeBehaviourMetrics, generateInsights } from '@/src/engine/insights'
import { applySrDelta, getLevel } from '@/src/engine/rating'
import { computeScore } from '@/src/engine/score'
import { simulateTrade, type SimResult } from '@/src/engine/sim'
import { loadState, recordRoundResult, type RoundResult } from '@/src/state/store'
import { Card } from '@/src/ui/components/Card'
import { type Decision, DecisionSheet } from '@/src/ui/components/DecisionSheet'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, space } from '@/src/ui/theme'

type Phase = 'deciding' | 'revealing' | 'result'

const CHART_WIDTH = Dimensions.get('window').width - space.lg * 2
const CHART_HEIGHT = 280
const REVEAL_INTERVAL_MS = 50

function resolveEpisode(episodeId?: string): Episode {
  if (episodeId) {
    const found = episodes.find((e) => e.id === episodeId)
    if (found) return found
  }
  return episodes[Math.floor(Math.random() * episodes.length)]
}

export default function RoundScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{
    episodeId?: string
    sessionIndex?: string
    sessionTotal?: string
    returnTo?: string
  }>()

  const [episode] = useState<Episode>(() => resolveEpisode(params.episodeId))
  const [phase, setPhase] = useState<Phase>('deciding')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [revealCount, setRevealCount] = useState(episode.before.length)
  const [savedResult, setSavedResult] = useState<RoundResult | null>(null)
  const [insights, setInsights] = useState<string[]>([])
  const [srBefore, setSrBefore] = useState(500)
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const sessionIndex = params.sessionIndex ? parseInt(params.sessionIndex, 10) : undefined
  const sessionTotal = params.sessionTotal ? parseInt(params.sessionTotal, 10) : undefined
  const isInSession = sessionIndex !== undefined && sessionTotal !== undefined

  useEffect(() => {
    loadState().then((s) => setSrBefore(s.sr))
  }, [])

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current)
    }
  }, [])

  const entry = episode.before[episode.before.length - 1][4]

  const onDecide = useCallback(
    async (d: Decision) => {
      setDecision(d)
      const sim =
        d.action === 'buy'
          ? simulateTrade({
              entry,
              size: d.size,
              stopPct: d.stopPct,
              targetPct: d.targetPct,
              afterCandles: episode.after,
            })
          : null
      setSimResult(sim)
      setPhase('revealing')

      const total = episode.before.length + episode.after.length
      revealTimer.current = setInterval(() => {
        setRevealCount((prev) => {
          const next = prev + 1
          if (next >= total) {
            if (revealTimer.current) clearInterval(revealTimer.current)
            const finalReturn = d.action === 'skip' ? 0 : (sim?.returnOnEquity ?? 0)
            if (finalReturn > 0.05) haptics.win()
            else if (finalReturn < -0.05) haptics.loss()
          }
          return next
        })
      }, REVEAL_INTERVAL_MS)
    },
    [entry, episode],
  )

  const onSeeResult = useCallback(async () => {
    if (!decision) return
    const userReturn = decision.action === 'skip' ? 0 : (simResult?.returnOnEquity ?? 0)
    const score = computeScore(userReturn, episode.baselines.bot_return)

    const state = await loadState()
    const roundResult: RoundResult = {
      episodeId: episode.id,
      tags: episode.tags,
      action: decision.action,
      userReturn,
      botReturn: episode.baselines.bot_return,
      score,
      srDelta: Math.round(applySrDelta(state.sr, score, episode.difficulty) - state.sr),
      difficulty: episode.difficulty,
    }

    const newState = await recordRoundResult(roundResult)
    setSavedResult(roundResult)

    const metrics = computeBehaviourMetrics(
      newState.history.map((h) => ({
        episodeId: h.episodeId,
        tags: h.tags,
        action: h.action,
        score: h.score,
        userReturn: 0,
        botReturn: 0,
        srDelta: 0,
        difficulty: 2 as const,
      })),
    )
    setInsights(generateInsights(metrics, roundResult))
    setPhase('result')
  }, [decision, simResult, episode])

  const onNext = useCallback(() => {
    if (!isInSession || savedResult === null) {
      router.replace(params.returnTo === 'time-machine' ? '/(tabs)/time-machine' : '/(tabs)/train')
      return
    }
    const next = sessionIndex! + 1
    if (next >= sessionTotal!) {
      router.replace('/daily-summary' as any)
    } else {
      // Navigate to next episode in session (router replaces so back-stack stays clean).
      const currentDaily = (global as any).__pendingDailyIds as string[] | undefined
      const nextId = currentDaily?.[next]
      router.replace({
        pathname: '/round',
        params: {
          episodeId: nextId,
          sessionIndex: String(next),
          sessionTotal: String(sessionTotal),
        },
      })
    }
  }, [isInSession, savedResult, sessionIndex, sessionTotal, params.returnTo, router])

  const userReturn = decision?.action === 'skip' ? 0 : (simResult?.returnOnEquity ?? 0)
  const score = computeScore(userReturn, episode.baselines.bot_return)
  const srAfter = applySrDelta(srBefore, score, episode.difficulty)
  const srDelta = Math.round(srAfter - srBefore)

  const allCandles = [...episode.before, ...episode.after]
  const stopPrice = decision?.stopPct !== undefined ? entry * (1 - decision.stopPct) : undefined
  const targetPrice = decision?.targetPct !== undefined ? entry * (1 + decision.targetPct) : undefined
  const revealDone = revealCount >= allCandles.length

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {isInSession && (
            <Text variant="label" style={{ color: colors.brand }}>
              {sessionIndex! + 1}/{sessionTotal}
            </Text>
          )}
          <Text variant="label">{episode.timeframe.toUpperCase()}</Text>
        </View>
        <Text variant="numeric">1000 training USDC</Text>
      </View>

      <View style={styles.chartWrap}>
        <CandleChart
          candles={phase === 'deciding' ? episode.before : allCandles}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          splitIndex={phase === 'deciding' ? undefined : episode.before.length}
          revealCount={phase === 'deciding' ? episode.before.length : revealCount}
          referenceLines={
            phase !== 'deciding' && decision?.action === 'buy'
              ? { entry, stop: stopPrice, target: targetPrice }
              : undefined
          }
        />
      </View>

      {phase === 'deciding' && <DecisionSheet onDecide={onDecide} />}

      {phase === 'revealing' && revealDone && (
        <Card style={{ gap: space.sm, marginHorizontal: space.lg }}>
          <Text variant="title">
            {episode.asset.symbol === episode.asset.name
              ? episode.asset.symbol
              : `${episode.asset.symbol} · ${episode.asset.name}`}
          </Text>
          <Text variant="numeric" style={{ color: userReturn >= 0 ? colors.gain : colors.loss, fontSize: 28 }}>
            {userReturn >= 0 ? '+' : ''}
            {(userReturn * 100).toFixed(1)}%
          </Text>
          <PrimaryButton label="See result" onPress={onSeeResult} />
        </Card>
      )}

      {phase === 'result' && savedResult && (
        <Card style={{ gap: space.md, marginHorizontal: space.lg }}>
          <View style={styles.resultRow}>
            <View>
              <Text variant="label">Score</Text>
              <Text variant="numeric">{(score * 100).toFixed(0)}%</Text>
            </View>
            <View>
              <Text variant="label">SR</Text>
              <Text variant="numeric" style={{ color: srDelta >= 0 ? colors.gain : colors.loss }}>
                {srDelta >= 0 ? '+' : ''}
                {srDelta}
              </Text>
            </View>
            <View>
              <Text variant="label">Level</Text>
              <Text variant="numeric">{getLevel(srAfter)}</Text>
            </View>
          </View>
          <View style={styles.resultRow}>
            <View>
              <Text variant="label">You</Text>
              <Text variant="numeric">{(userReturn * 100).toFixed(1)}%</Text>
            </View>
            <View>
              <Text variant="label">Bot</Text>
              <Text variant="numeric">{(episode.baselines.bot_return * 100).toFixed(1)}%</Text>
            </View>
            <View>
              <Text variant="label">Hold</Text>
              <Text variant="numeric">{(episode.baselines.hold_return * 100).toFixed(1)}%</Text>
            </View>
          </View>
          {insights.length > 0 && (
            <View style={{ gap: space.xs }}>
              {insights.map((ins, i) => (
                <Text key={i} variant="body" style={{ color: colors.muted }}>
                  {ins}
                </Text>
              ))}
            </View>
          )}
          <PrimaryButton
            label={isInSession && sessionIndex! + 1 < sessionTotal! ? 'Next chart' : 'Done'}
            onPress={onNext}
          />
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  chartWrap: { paddingHorizontal: space.lg, marginBottom: space.lg },
  resultRow: { flexDirection: 'row', gap: space.xl },
})
