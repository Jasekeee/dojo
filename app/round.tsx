import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, SlideInDown } from 'react-native-reanimated'
import { CandleChart } from '@/src/chart/CandleChart'
import { episodes } from '@/src/content/episodes'
import { timeMachineEpisodes } from '@/src/content/campaigns'
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
import { colors, radius, space } from '@/src/ui/theme'

type Phase = 'deciding' | 'revealing' | 'result'

const CHART_WIDTH = Dimensions.get('window').width
const CHART_HEIGHT = 260
const REVEAL_INTERVAL_MS = 45

const allEpisodes = [...episodes, ...timeMachineEpisodes]

function resolveEpisode(episodeId?: string): Episode {
  if (episodeId) {
    const found = allEpisodes.find((e) => e.id === episodeId)
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
    return () => { if (revealTimer.current) clearInterval(revealTimer.current) }
  }, [])

  const entry = episode.before[episode.before.length - 1][4]

  const onDecide = useCallback(async (d: Decision) => {
    setDecision(d)
    const sim = d.action === 'buy'
      ? simulateTrade({ entry, size: d.size, stopPct: d.stopPct, targetPct: d.targetPct, afterCandles: episode.after })
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
  }, [entry, episode])

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
        episodeId: h.episodeId, tags: h.tags, action: h.action, score: h.score,
        userReturn: 0, botReturn: 0, srDelta: 0, difficulty: 2 as const,
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
      const currentDaily = (global as any).__pendingDailyIds as string[] | undefined
      const nextId = currentDaily?.[next]
      router.replace({
        pathname: '/round',
        params: { episodeId: nextId, sessionIndex: String(next), sessionTotal: String(sessionTotal) },
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

  // Context (Time Machine episodes)
  const context = (episode as any).context

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg0 }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {isInSession && (
            <View style={styles.progressPill}>
              <Text variant="caption" style={{ color: colors.brand, fontWeight: '700' }}>
                {sessionIndex! + 1}/{sessionTotal}
              </Text>
            </View>
          )}
          <Text variant="caption" style={{ letterSpacing: 1, fontWeight: '600' }}>
            {episode.timeframe.toUpperCase()}
          </Text>
          {episode.kind === 'time_machine' && context && (
            <View style={styles.tmBadge}>
              <Text variant="caption" style={{ color: '#FFB84D', fontSize: 10, fontWeight: '700' }}>
                {context.date}
              </Text>
            </View>
          )}
        </View>
        <Text variant="numeric" style={{ color: colors.muted, fontSize: 13 }}>1000 USDC</Text>
      </View>

      {/* Time Machine context */}
      {phase === 'deciding' && context && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.contextBanner}>
          <Text variant="caption" style={{ color: colors.warn, fontWeight: '700', letterSpacing: 0.5 }}>
            TIME MACHINE
          </Text>
          <Text variant="label" style={{ color: colors.text, fontWeight: '600', marginTop: 2 }}>
            {context.headline}
          </Text>
        </Animated.View>
      )}

      {/* Chart */}
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

      {/* Decision sheet */}
      {phase === 'deciding' && (
        <Animated.View entering={SlideInDown.duration(350).springify()} style={styles.sheetWrap}>
          <DecisionSheet onDecide={onDecide} />
        </Animated.View>
      )}

      {/* Reveal card */}
      {phase === 'revealing' && revealDone && (
        <Animated.View entering={FadeInUp.duration(300).springify()} style={styles.cardWrap}>
          <Card variant="elevated" style={styles.revealCard}>
            <View style={styles.revealRow}>
              <View>
                <Text variant="caption">
                  {episode.asset.symbol} · {episode.asset.name}
                </Text>
                <Text
                  variant="numericLarge"
                  style={{ color: userReturn >= 0 ? colors.gain : colors.loss, marginTop: 4 }}
                >
                  {userReturn >= 0 ? '+' : ''}{(userReturn * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.revealIcon}>
                <Text style={{ fontSize: 32 }}>{userReturn >= 0 ? '📈' : '📉'}</Text>
              </View>
            </View>
            <PrimaryButton label="See result" onPress={onSeeResult} />
          </Card>
        </Animated.View>
      )}

      {/* Result card */}
      {phase === 'result' && savedResult && (
        <Animated.View entering={FadeInUp.duration(350).springify()} style={styles.cardWrap}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Card variant="elevated" style={styles.resultCard}>
              {/* Return hero */}
              <View style={styles.returnHero}>
                <Text
                  variant="numericLarge"
                  style={{
                    color: userReturn >= 0 ? colors.gain : colors.loss,
                    fontSize: 44,
                  }}
                >
                  {userReturn >= 0 ? '+' : ''}{(userReturn * 100).toFixed(1)}%
                </Text>
                <View style={[styles.scorePill, { backgroundColor: score >= 0 ? `${colors.gain}20` : `${colors.loss}20` }]}>
                  <Text variant="caption" style={{ color: score >= 0 ? colors.gain : colors.loss, fontWeight: '700' }}>
                    {score >= 0 ? '▲' : '▼'} {Math.abs(score * 100).toFixed(0)} pts
                  </Text>
                </View>
              </View>

              {/* SR delta */}
              <View style={styles.srDeltaRow}>
                <Text variant="label">SR change</Text>
                <Text
                  variant="numeric"
                  style={{ color: srDelta >= 0 ? colors.gain : colors.loss, fontSize: 20 }}
                >
                  {srDelta >= 0 ? '+' : ''}{srDelta} → {Math.round(srAfter)}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Comparison */}
              <View style={styles.comparison}>
                {[
                  { label: 'You', value: userReturn, highlight: true },
                  { label: 'Bot', value: episode.baselines.bot_return },
                  { label: 'Hold', value: episode.baselines.hold_return },
                ].map(({ label, value, highlight }) => (
                  <View key={label} style={[styles.compItem, highlight && styles.compItemHighlight]}>
                    <Text variant="caption" style={{ letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
                    <Text
                      variant="numeric"
                      style={{
                        color: value >= 0 ? colors.gain : colors.loss,
                        fontSize: 17,
                        marginTop: 2,
                      }}
                    >
                      {value >= 0 ? '+' : ''}{(value * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>

              {/* Insights */}
              {insights.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <View style={{ gap: space.sm }}>
                    {insights.map((ins, i) => (
                      <View key={i} style={styles.insightRow}>
                        <View style={styles.insightDot} />
                        <Text variant="body" style={styles.insightText}>{ins}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <PrimaryButton
                label={isInSession && sessionIndex! + 1 < sessionTotal! ? 'Next chart →' : 'Done'}
                onPress={onNext}
              />
            </Card>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: 56,
    paddingBottom: space.md,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  progressPill: {
    backgroundColor: `${colors.brand}20`,
    borderRadius: 99,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${colors.brand}40`,
  },
  tmBadge: {
    backgroundColor: `${colors.warn}20`,
    borderRadius: 99,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${colors.warn}40`,
  },
  contextBanner: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    backgroundColor: `${colors.warn}10`,
    borderRadius: radius.card,
    padding: space.md,
    borderWidth: 1,
    borderColor: `${colors.warn}30`,
  },
  chartWrap: { flex: 1 },
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  cardWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '60%' },

  revealCard: { margin: space.lg, gap: space.lg },
  revealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revealIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultCard: { margin: space.lg, gap: space.lg },
  returnHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scorePill: {
    borderRadius: 99,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  srDeltaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.line },
  comparison: { flexDirection: 'row', gap: space.sm },
  compItem: {
    flex: 1,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.bg2,
  },
  compItemHighlight: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg1,
  },
  insightRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 8,
    flexShrink: 0,
  },
  insightText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 22 },
})
