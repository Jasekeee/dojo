import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState as RNAppState,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { isReduceMotionEnabled } from '@/src/ui/motion'
import { colors, levelColors, radius, space } from '@/src/ui/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

type Phase = 'deciding' | 'revealing' | 'result'

const SCREEN_WIDTH    = Dimensions.get('window').width
const CHART_HEIGHT    = 268
const REVEAL_INTERVAL = isReduceMotionEnabled() ? 15 : 45 // ms per candle tick

// ─── Helpers ──────────────────────────────────────────────────────────────────

const allEpisodes = [...episodes, ...timeMachineEpisodes]

function resolveEpisode(id?: string): Episode {
  if (id) {
    const found = allEpisodes.find((e) => e.id === id)
    if (found) return found
  }
  return episodes[Math.floor(Math.random() * episodes.length)]!
}

function formatReturn(r: number): string {
  return (r >= 0 ? '+' : '') + (r * 100).toFixed(1) + '%'
}

// ─── RoundScreen ──────────────────────────────────────────────────────────────

export default function RoundScreen() {
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const params    = useLocalSearchParams<{
    episodeId?:    string
    sessionIndex?: string
    sessionTotal?: string
    returnTo?:     string
  }>()

  // Episode is stable for the lifetime of this screen
  const [episode] = useState<Episode>(() => resolveEpisode(params.episodeId))

  const [phase,       setPhase]       = useState<Phase>('deciding')
  const [decision,    setDecision]    = useState<Decision | null>(null)
  const [simResult,   setSimResult]   = useState<SimResult | null>(null)
  const [revealCount, setRevealCount] = useState(episode.before.length)
  const [savedResult, setSavedResult] = useState<RoundResult | null>(null)
  const [insights,    setInsights]    = useState<string[]>([])
  const [srBefore,    setSrBefore]    = useState<number | null>(null)

  // ── Mutation guards — prevent duplicate submissions ──
  const decidingFired = useRef(false)
  const savingFired   = useRef(false)

  // ── Interval ref ──
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Session params ──
  const sessionIndex = params.sessionIndex ? parseInt(params.sessionIndex, 10) : undefined
  const sessionTotal = params.sessionTotal ? parseInt(params.sessionTotal, 10) : undefined
  const isInSession  = sessionIndex !== undefined && sessionTotal !== undefined

  // ── Derived values ──
  const entry      = episode.before[episode.before.length - 1]![4]
  const stopPrice  = decision?.stopPct   !== undefined ? entry * (1 - decision.stopPct)   : undefined
  const targetPrice= decision?.targetPct !== undefined ? entry * (1 + decision.targetPct) : undefined
  const allCandles = [...episode.before, ...episode.after]
  const revealDone = revealCount >= allCandles.length
  const revealPct  = episode.after.length > 0
    ? Math.min(1, Math.max(0, revealCount - episode.before.length) / episode.after.length)
    : 1
  const context    = (episode as any).context as Episode['context'] | undefined

  // ── Load SR before round ──
  useEffect(() => {
    loadState().then((s) => setSrBefore(s.sr))
  }, [])

  // ── Cleanup timer on unmount ──
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current)
    }
  }, [])

  // ── skipReveal: fast-forward animation to completion ──
  const decisionRef  = useRef(decision)
  const simResultRef = useRef(simResult)
  decisionRef.current  = decision
  simResultRef.current = simResult

  const skipReveal = useCallback(() => {
    if (revealTimer.current) {
      clearInterval(revealTimer.current)
      revealTimer.current = null
    }
    const total = episode.before.length + episode.after.length
    setRevealCount(total)
    const d = decisionRef.current
    const sim = simResultRef.current
    const finalReturn = d?.action === 'skip' ? 0 : (sim?.returnOnEquity ?? 0)
    if (finalReturn > 0.05)  haptics.win()
    else if (finalReturn < -0.05) haptics.loss()
  }, [episode])

  // ── AppState listener: foreground during reveal → fast-forward ──
  useEffect(() => {
    if (phase !== 'revealing' || revealDone) return
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'active') skipReveal()
    })
    return () => sub.remove()
  }, [phase, revealDone, skipReveal])

  // ─── onDecide: user taps Buy or Skip ───────────────────────────────────────

  const onDecide = useCallback((d: Decision) => {
    if (decidingFired.current) return
    decidingFired.current = true

    const sim = d.action === 'buy'
      ? simulateTrade({
          entry,
          size:      d.size,
          stopPct:   d.stopPct,
          targetPct: d.targetPct,
          afterCandles: episode.after,
        })
      : null

    setDecision(d)
    setSimResult(sim)
    setPhase('revealing')

    const total = episode.before.length + episode.after.length
    revealTimer.current = setInterval(() => {
      setRevealCount((prev) => {
        const next = prev + 1
        if (next >= total) {
          if (revealTimer.current) clearInterval(revealTimer.current)
          const finalReturn = d.action === 'skip' ? 0 : (sim?.returnOnEquity ?? 0)
          if (finalReturn > 0.05)  haptics.win()
          else if (finalReturn < -0.05) haptics.loss()
        }
        return next
      })
    }, REVEAL_INTERVAL)
  }, [entry, episode])

  // ─── onSeeResult: save result and show result card ─────────────────────────

  const onSeeResult = useCallback(async () => {
    if (savingFired.current || !decision) return
    savingFired.current = true

    const userReturn = decision.action === 'skip' ? 0 : (simResult?.returnOnEquity ?? 0)
    const score      = computeScore(userReturn, episode.baselines.bot_return)
    const state      = await loadState()

    const roundResult: RoundResult = {
      episodeId:  episode.id,
      tags:       episode.tags,
      action:     decision.action,
      userReturn,
      botReturn:  episode.baselines.bot_return,
      score,
      srDelta:    Math.round(applySrDelta(state.sr, score, episode.difficulty) - state.sr),
      difficulty: episode.difficulty,
    }

    const newState = await recordRoundResult(roundResult)
    setSavedResult(roundResult)

    // Insights use the updated history
    const metrics = computeBehaviourMetrics(
      newState.history.map((h) => ({
        episodeId: h.episodeId, tags: h.tags, action: h.action, score: h.score,
        userReturn: 0, botReturn: 0, srDelta: 0, difficulty: 2 as const,
      })),
    )
    setInsights(generateInsights(metrics, roundResult))
    setPhase('result')
  }, [decision, simResult, episode])

  // ─── onNext: navigation after result ───────────────────────────────────────

  const onNext = useCallback(() => {
    if (!isInSession || savedResult === null) {
      router.replace(
        params.returnTo === 'time-machine' ? '/(tabs)/time-machine' : '/(tabs)/train',
      )
      return
    }
    const next = sessionIndex! + 1
    if (next >= sessionTotal!) {
      router.replace('/daily-summary' as any)
    } else {
      const pendingIds = (global as any).__pendingDailyIds as string[] | undefined
      const nextId = pendingIds?.[next]
      router.replace({
        pathname: '/round',
        params: {
          episodeId:    nextId,
          sessionIndex: String(next),
          sessionTotal: String(sessionTotal),
        },
      })
    }
  }, [isInSession, savedResult, sessionIndex, sessionTotal, params.returnTo, router])

  // ─── Derived display values (result phase) ─────────────────────────────────

  const userReturn = decision?.action === 'skip' ? 0 : (simResult?.returnOnEquity ?? 0)
  // Use savedResult.srDelta (actual saved delta) not a recomputed value
  const displaySrDelta  = savedResult?.srDelta ?? 0
  const displaySrBefore = srBefore ?? 500
  const displaySrAfter  = displaySrBefore + displaySrDelta
  const displayLevel    = getLevel(displaySrAfter)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg0 }}>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topLeft}>
          {isInSession && (
            <View style={styles.sessionPill}>
              <Text variant="caption" style={{ color: colors.brand, fontWeight: '700' }}>
                {sessionIndex! + 1} / {sessionTotal}
              </Text>
            </View>
          )}
          <Text variant="caption" style={{ letterSpacing: 1, fontWeight: '600' }}>
            {episode.asset.symbol} · {episode.timeframe.toUpperCase()}
          </Text>
          {episode.kind === 'time_machine' && context && (
            <View style={styles.tmBadge}>
              <Text variant="caption" style={{ color: colors.warn, fontSize: 10, fontWeight: '700' }}>
                {context.date}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.topRight}>
          {phase === 'deciding' && (
            <Text variant="caption">
              {DIFFICULTY_LABEL[episode.difficulty]}
            </Text>
          )}
        </View>
      </View>

      {/* Time Machine context banner */}
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
          candles={allCandles}
          width={SCREEN_WIDTH}
          height={CHART_HEIGHT}
          splitIndex={phase !== 'deciding' ? episode.before.length : undefined}
          revealCount={revealCount}
          referenceLines={
            phase !== 'deciding' && decision?.action === 'buy'
              ? { entry, stop: stopPrice, target: targetPrice }
              : undefined
          }
          timeframe={episode.timeframe}
        />
      </View>

      {/* ── DECIDING: decision sheet ── */}
      {phase === 'deciding' && (
        <Animated.View
          entering={SlideInDown.duration(350).springify()}
          style={styles.bottomSheet}
        >
          <DecisionSheet
            onDecide={onDecide}
            entryPrice={entry}
            assetSymbol={episode.asset.symbol}
          />
        </Animated.View>
      )}

      {/* ── REVEALING: progress control ── */}
      {phase === 'revealing' && !revealDone && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.revealControl}>
          <View style={styles.revealProgressTrack}>
            <View style={[styles.revealProgressFill, { width: `${Math.round(revealPct * 100)}%` as any }]} />
          </View>
          <View style={styles.revealRow}>
            <Text variant="caption" style={{ color: colors.muted }}>
              {decision?.action === 'skip' ? 'Watching market…' : 'Trade in progress…'}
            </Text>
            <Pressable
              onPress={skipReveal}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip animation"
            >
              <Text variant="caption" style={{ color: colors.brand }}>
                Skip ›
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── REVEALING: reveal done → see result ── */}
      {phase === 'revealing' && revealDone && (
        <Animated.View entering={FadeInUp.duration(280).springify()} style={styles.revealCard}>
          <Card variant="elevated" style={styles.revealCardInner}>
            <View style={styles.revealHeader}>
              <View>
                <Text variant="caption" style={{ letterSpacing: 0.5 }}>
                  {episode.asset.symbol} · {decision?.action === 'skip' ? 'SKIPPED' : 'TRADED'}
                </Text>
                <Text
                  variant="numericLarge"
                  style={{
                    color: userReturn >= 0 ? colors.gain : colors.loss,
                    fontSize: 40,
                    marginTop: 4,
                  }}
                >
                  {formatReturn(userReturn)}
                </Text>
              </View>
              <View style={[
                styles.revealOutcomeBox,
                { backgroundColor: userReturn >= 0 ? `${colors.gain}18` : `${colors.loss}18` },
              ]}>
                <Text style={{ fontSize: 28 }}>
                  {userReturn >= 0.05 ? '📈' : userReturn <= -0.05 ? '📉' : '➡️'}
                </Text>
              </View>
            </View>

            {/* Bot comparison during reveal */}
            <View style={styles.revealCompare}>
              <View style={styles.revealCompareItem}>
                <Text variant="caption">Bot</Text>
                <Text
                  variant="numeric"
                  style={{ fontSize: 14, color: episode.baselines.bot_return >= 0 ? colors.gain : colors.loss }}
                >
                  {formatReturn(episode.baselines.bot_return)}
                </Text>
              </View>
              <View style={styles.revealCompareItem}>
                <Text variant="caption">Hold</Text>
                <Text
                  variant="numeric"
                  style={{ fontSize: 14, color: episode.baselines.hold_return >= 0 ? colors.gain : colors.loss }}
                >
                  {formatReturn(episode.baselines.hold_return)}
                </Text>
              </View>
            </View>

            <PrimaryButton label="See result →" onPress={onSeeResult} />
          </Card>
        </Animated.View>
      )}

      {/* ── RESULT: full result card ── */}
      {phase === 'result' && savedResult && (
        <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.resultWrap}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <Card variant="elevated" style={styles.resultCard}>

              {/* Outcome header */}
              <View style={styles.resultOutcomeRow}>
                <View>
                  <Text variant="caption" style={{ letterSpacing: 0.8 }}>
                    {savedResult.action === 'skip' ? 'SKIPPED' : 'TRADED'}
                    {' · '}{episode.asset.symbol}
                  </Text>
                  <Text
                    variant="numericLarge"
                    style={{
                      color: userReturn >= 0 ? colors.gain : colors.loss,
                      fontSize: 44,
                      marginTop: 4,
                    }}
                  >
                    {formatReturn(userReturn)}
                  </Text>
                </View>
                <View style={styles.srBadge}>
                  <Text style={[
                    styles.srDeltaText,
                    { color: displaySrDelta >= 0 ? colors.gain : colors.loss },
                  ]}>
                    {displaySrDelta >= 0 ? '+' : ''}{displaySrDelta}
                  </Text>
                  <Text variant="caption" style={{ textAlign: 'center' }}>SR</Text>
                </View>
              </View>

              {/* SR line */}
              <View style={styles.srLine}>
                <Text variant="caption">Skill Rating</Text>
                <View style={styles.srLineRight}>
                  <Text variant="numeric" style={{ fontSize: 13, color: colors.muted }}>
                    {Math.round(displaySrBefore)}
                  </Text>
                  <Text variant="caption" style={{ marginHorizontal: 4 }}>→</Text>
                  <Text variant="numeric" style={{ fontSize: 15, color: colors.text }}>
                    {Math.round(displaySrAfter)}
                  </Text>
                  <Text
                    variant="caption"
                    style={{ color: levelColors[displayLevel], marginLeft: 6, fontWeight: '700' }}
                  >
                    {displayLevel}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Comparison table */}
              <View style={styles.comparison}>
                {(
                  [
                    { label: 'You',  value: userReturn,                    highlight: true },
                    { label: 'Bot',  value: episode.baselines.bot_return,  highlight: false },
                    { label: 'Hold', value: episode.baselines.hold_return, highlight: false },
                  ] as const
                ).map(({ label, value, highlight }) => (
                  <View
                    key={label}
                    style={[
                      styles.compareItem,
                      highlight && styles.compareItemYou,
                    ]}
                  >
                    <Text variant="caption" style={{ letterSpacing: 0.5 }}>
                      {label.toUpperCase()}
                    </Text>
                    <Text
                      variant="numeric"
                      style={{
                        color: value >= 0 ? colors.gain : colors.loss,
                        fontSize: 16,
                        marginTop: 3,
                      }}
                    >
                      {formatReturn(value)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Edge explanation */}
              {savedResult.action === 'buy' && (
                <View style={styles.edgeRow}>
                  <Text variant="caption">
                    Edge score
                  </Text>
                  <Text
                    variant="numeric"
                    style={{
                      fontSize: 14,
                      color: savedResult.score >= 0 ? colors.gain : colors.loss,
                    }}
                  >
                    {savedResult.score >= 0 ? '+' : ''}
                    {savedResult.score.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Tags */}
              <View style={styles.tagRow}>
                {episode.tags.map((t) => (
                  <View key={t} style={styles.tagChip}>
                    <Text style={styles.tagText}>
                      {t.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                ))}
                <View style={[styles.tagChip, styles.tagDifficulty]}>
                  <Text style={[styles.tagText, { color: DIFFICULTY_COLOR[episode.difficulty] }]}>
                    {DIFFICULTY_LABEL[episode.difficulty]}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Insights */}
              {insights.length > 0 && (
                <View style={{ gap: space.sm, marginBottom: space.sm }}>
                  {insights.map((ins, i) => (
                    <View key={`ins-${i}`} style={styles.insightRow}>
                      <View style={styles.insightDot} />
                      <Text variant="body" style={styles.insightText}>{ins}</Text>
                    </View>
                  ))}
                </View>
              )}

              <PrimaryButton
                label={
                  isInSession && sessionIndex! + 1 < sessionTotal!
                    ? `Next chart  ${sessionIndex! + 2} / ${sessionTotal}`
                    : 'Done'
                }
                onPress={onNext}
              />
            </Card>
          </ScrollView>
        </Animated.View>
      )}

    </View>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'EASY',
  2: 'MEDIUM',
  3: 'HARD',
}

const DIFFICULTY_COLOR: Record<1 | 2 | 3, string> = {
  1: colors.gain,
  2: colors.warn,
  3: colors.loss,
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sessionPill: {
    backgroundColor: `${colors.brand}18`,
    borderRadius: 99,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${colors.brand}40`,
  },
  tmBadge: {
    backgroundColor: `${colors.warn}18`,
    borderRadius: 99,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${colors.warn}35`,
  },

  contextBanner: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    backgroundColor: `${colors.warn}10`,
    borderRadius: radius.card,
    padding: space.md,
    borderWidth: 1,
    borderColor: `${colors.warn}28`,
  },

  chartWrap: { flex: 1 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  // Reveal progress control
  revealControl: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg1,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: 32,
    gap: space.sm,
  },
  revealProgressTrack: {
    height: 3,
    backgroundColor: colors.bg2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  revealProgressFill: {
    height: 3,
    backgroundColor: colors.brand,
    borderRadius: 2,
  },
  revealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Reveal done card
  revealCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  revealCardInner: {
    margin: space.lg,
    gap: space.md,
  },
  revealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revealOutcomeBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealCompare: {
    flexDirection: 'row',
    gap: space.sm,
  },
  revealCompareItem: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 8,
    padding: space.sm,
    gap: 2,
  },

  // Result card
  resultWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
  },
  resultCard: {
    margin: space.lg,
    gap: space.md,
  },
  resultOutcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  srBadge: {
    backgroundColor: colors.bg2,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    minWidth: 60,
  },
  srDeltaText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  srLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  srLineRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  comparison: {
    flexDirection: 'row',
    gap: space.sm,
  },
  compareItem: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: radius.card,
    padding: space.md,
    alignItems: 'center',
  },
  compareItemYou: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg1,
  },
  edgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bg2,
    borderRadius: 8,
    padding: space.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  tagChip: {
    backgroundColor: `${colors.brand}14`,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: `${colors.brand}28`,
  },
  tagDifficulty: {
    backgroundColor: 'transparent',
    borderColor: colors.line,
  },
  tagText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 9,
    color: colors.brand,
    letterSpacing: 0.8,
  },
  insightRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  insightDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 9,
    flexShrink: 0,
  },
  insightText: {
    flex: 1,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
})
