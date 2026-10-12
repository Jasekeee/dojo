import AsyncStorage from '@react-native-async-storage/async-storage'
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
import { type Decision, DecisionSheet } from '@/src/ui/components/DecisionSheet'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { isReduceMotionEnabled } from '@/src/ui/motion'
import { colors, fonts, levelColors, radius, space, SCREEN_PAD } from '@/src/ui/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

type Phase = 'deciding' | 'revealing' | 'result'

const SCREEN_WIDTH    = Dimensions.get('window').width
const SCREEN_HEIGHT   = Dimensions.get('window').height
// Chart takes ≥60% of screen — the hero visual
const CHART_HEIGHT    = Math.round(SCREEN_HEIGHT * 0.60)
const REVEAL_INTERVAL = isReduceMotionEnabled() ? 15 : 40
const PENDING_IDS_KEY = '@dojo/pendingSessionIds'

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

  const [episode]     = useState<Episode>(() => resolveEpisode(params.episodeId))
  const [phase,       setPhase]       = useState<Phase>('deciding')
  const [decision,    setDecision]    = useState<Decision | null>(null)
  const [simResult,   setSimResult]   = useState<SimResult | null>(null)
  const [revealCount, setRevealCount] = useState(episode.before.length)
  const [savedResult, setSavedResult] = useState<RoundResult | null>(null)
  const [insights,    setInsights]    = useState<string[]>([])
  const [srBefore,    setSrBefore]    = useState<number | null>(null)
  const [saveError,   setSaveError]   = useState(false)
  const [pendingIds,  setPendingIds]  = useState<string[] | null>(null)

  const decidingFired = useRef(false)
  const savingFired   = useRef(false)
  const revealTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  const sessionIndex = params.sessionIndex ? parseInt(params.sessionIndex, 10) : undefined
  const sessionTotal = params.sessionTotal ? parseInt(params.sessionTotal, 10) : undefined
  const isInSession  = sessionIndex !== undefined && sessionTotal !== undefined

  const lastBefore  = episode.before.length > 0 ? episode.before[episode.before.length - 1] : undefined
  const entry       = lastBefore?.[4] ?? 0
  const isShort     = decision?.action === 'short'
  const stopPrice   = decision?.stopPct !== undefined
    ? isShort ? entry * (1 + decision.stopPct) : entry * (1 - decision.stopPct)
    : undefined
  const targetPrice = decision?.targetPct !== undefined
    ? isShort ? entry * (1 - decision.targetPct) : entry * (1 + decision.targetPct)
    : undefined
  const allCandles = [...episode.before, ...episode.after]
  const revealDone = revealCount >= allCandles.length
  const revealPct  = episode.after.length > 0
    ? Math.min(1, Math.max(0, revealCount - episode.before.length) / episode.after.length)
    : 1
  const context    = (episode as any).context as Episode['context'] | undefined

  useEffect(() => {
    loadState().then((s) => setSrBefore(s.sr))
    const globalIds = (global as any).__pendingDailyIds as string[] | undefined
    if (globalIds) {
      setPendingIds(globalIds)
    } else {
      AsyncStorage.getItem(PENDING_IDS_KEY).then((raw) => {
        if (raw) { try { setPendingIds(JSON.parse(raw)) } catch {} }
      })
    }
  }, [])

  useEffect(() => {
    return () => { if (revealTimer.current) clearInterval(revealTimer.current) }
  }, [])

  const decisionRef  = useRef(decision)
  const simResultRef = useRef(simResult)
  decisionRef.current  = decision
  simResultRef.current = simResult

  const skipReveal = useCallback(() => {
    if (revealTimer.current) { clearInterval(revealTimer.current); revealTimer.current = null }
    const total = episode.before.length + episode.after.length
    setRevealCount(total)
    const d = decisionRef.current
    const sim = simResultRef.current
    const finalReturn = d?.action === 'skip' ? 0 : (sim?.returnOnEquity ?? 0)
    if (finalReturn > 0.05)  haptics.win()
    else if (finalReturn < -0.05) haptics.loss()
  }, [episode])

  useEffect(() => {
    if (phase !== 'revealing' || revealDone) return
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'active') skipReveal()
    })
    return () => sub.remove()
  }, [phase, revealDone, skipReveal])

  const onDecide = useCallback((d: Decision) => {
    if (decidingFired.current) return
    decidingFired.current = true

    const sim = d.action !== 'skip'
      ? simulateTrade({
          entry,
          direction: d.action,
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

  const onSeeResult = useCallback(async () => {
    if (savingFired.current || !decision) return
    savingFired.current = true
    setSaveError(false)

    try {
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

      const metrics = computeBehaviourMetrics(
        newState.history.map((h) => ({
          episodeId: h.episodeId, tags: h.tags, action: h.action, score: h.score,
          userReturn: 0, botReturn: 0, srDelta: 0, difficulty: 2 as const,
        })),
      )
      try { setInsights(generateInsights(metrics, roundResult)) } catch {}
      setPhase('result')
      haptics.confirm()
    } catch {
      savingFired.current = false
      setSaveError(true)
      haptics.error()
    }
  }, [decision, simResult, episode])

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
  }, [isInSession, savedResult, sessionIndex, sessionTotal, pendingIds, params.returnTo, router])

  const userReturn    = decision?.action === 'skip' ? 0 : (simResult?.returnOnEquity ?? 0)
  const displaySrDelta  = savedResult?.srDelta ?? 0
  const displaySrBefore = srBefore ?? 500
  const displaySrAfter  = displaySrBefore + displaySrDelta
  const displayLevel    = getLevel(displaySrAfter)

  const diffLabel = DIFFICULTY_LABEL[episode.difficulty]

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.bg0 }]}>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>×</Text>
        </Pressable>

        <View style={styles.topCenter}>
          {isInSession && (
            <View style={styles.progressDots}>
              {Array.from({ length: sessionTotal! }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i <= sessionIndex! ? styles.progressDotDone : styles.progressDotPending,
                  ]}
                />
              ))}
            </View>
          )}
          <Text style={styles.topPair}>
            {episode.asset.symbol} · {episode.timeframe.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.topDifficulty}>{diffLabel}</Text>
      </View>

      {/* ── Time machine context ── */}
      {phase === 'deciding' && context && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.contextBanner}>
          <Text style={styles.contextLabel}>ARCHIVE</Text>
          <Text style={styles.contextHeadline}>{context.headline}</Text>
        </Animated.View>
      )}

      {/* ── Chart — hero visual ── */}
      <View style={styles.chartWrap}>
        <CandleChart
          candles={allCandles}
          width={SCREEN_WIDTH}
          height={CHART_HEIGHT}
          splitIndex={phase !== 'deciding' ? episode.before.length : undefined}
          revealCount={revealCount}
          referenceLines={
            phase !== 'deciding' && decision?.action !== 'skip'
              ? { entry, stop: stopPrice, target: targetPrice }
              : undefined
          }
          timeframe={episode.timeframe}
        />
      </View>

      {/* ── DECIDING: decision sheet ── */}
      {phase === 'deciding' && (
        <Animated.View
          entering={SlideInDown.duration(380).springify()}
          style={styles.bottomSheet}
        >
          <DecisionSheet
            onDecide={onDecide}
            entryPrice={entry}
            assetSymbol={episode.asset.symbol}
          />
        </Animated.View>
      )}

      {/* ── REVEALING: progress strip ── */}
      {phase === 'revealing' && !revealDone && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.revealStrip}>
          <View style={styles.revealTrack}>
            <View style={[styles.revealFill, { width: `${Math.round(revealPct * 100)}%` as any }]} />
          </View>
          <View style={styles.revealRow}>
            <Text style={styles.revealStatus}>
              {decision?.action === 'skip' ? 'Watching market…' : decision?.action === 'short' ? 'Short in progress…' : 'Long in progress…'}
            </Text>
            <Pressable onPress={skipReveal} hitSlop={12} accessibilityRole="button">
              <Text style={styles.revealSkip}>Skip →</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── REVEALING done: see result ── */}
      {phase === 'revealing' && revealDone && (
        <Animated.View entering={FadeInUp.duration(320).springify()} style={styles.revealCard}>
          <View style={styles.revealCardInner}>
            {/* PnL hero */}
            <View style={styles.revealPnlRow}>
              <View>
                <Text style={styles.revealEyebrow}>
                  {decision?.action === 'skip' ? 'SKIPPED' : decision?.action === 'short' ? 'SHORT' : 'LONG'} · {episode.asset.symbol}
                </Text>
                <Text style={[styles.revealPnl, { color: userReturn >= 0 ? colors.gain : colors.loss }]}>
                  {formatReturn(userReturn)}
                </Text>
              </View>
              <View style={[
                styles.revealDirectionBox,
                { backgroundColor: userReturn >= 0.05 ? colors.gainSoft : userReturn <= -0.05 ? colors.lossSoft : `${colors.muted}12` },
              ]}>
                <Text style={[styles.revealDirectionArrow, {
                  color: userReturn >= 0.05 ? colors.gain : userReturn <= -0.05 ? colors.loss : colors.muted,
                }]}>
                  {userReturn >= 0.05 ? '▲' : userReturn <= -0.05 ? '▼' : '—'}
                </Text>
              </View>
            </View>

            {/* Bot / Hold comparison — thin bars */}
            <View style={styles.compareRow}>
              {([
                { label: 'You',  value: userReturn,               you: true },
                { label: 'Bot',  value: episode.baselines.bot_return,  you: false },
                { label: 'Hold', value: episode.baselines.hold_return, you: false },
              ] as const).map(({ label, value, you }) => (
                <View key={label} style={styles.compareCol}>
                  <Text style={[styles.compareLabel, you && { color: colors.textSub }]}>{label}</Text>
                  <Text style={[
                    styles.compareValue,
                    { color: value >= 0 ? colors.gain : colors.loss },
                    you && { color: value >= 0 ? colors.gain : colors.loss },
                  ]}>
                    {formatReturn(value)}
                  </Text>
                </View>
              ))}
            </View>

            {saveError && (
              <Text style={styles.saveErrorText}>Save failed — tap to retry</Text>
            )}

            <PrimaryButton label="See Result" onPress={onSeeResult} />
          </View>
        </Animated.View>
      )}

      {/* ── RESULT: full result panel ── */}
      {phase === 'result' && savedResult && (
        <Animated.View entering={FadeInUp.duration(360).springify()} style={styles.resultWrap}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultScroll}
          >
            {/* Hero PnL */}
            <View style={styles.resultHero}>
              <View>
                <Text style={styles.resultEyebrow}>
                  {savedResult.action === 'skip' ? 'SKIPPED' : savedResult.action.toUpperCase()} · {episode.asset.symbol}
                </Text>
                <Text style={[styles.resultPnl, {
                  color: userReturn >= 0 ? colors.gain : userReturn < 0 ? colors.loss : colors.muted,
                }]}>
                  {formatReturn(userReturn)}
                </Text>
              </View>

              {/* SR delta badge */}
              <View style={[styles.srBadge, { borderColor: displaySrDelta >= 0 ? `${colors.gain}30` : `${colors.loss}30` }]}>
                <Text style={[styles.srDeltaNum, { color: displaySrDelta >= 0 ? colors.gain : colors.loss }]}>
                  {displaySrDelta >= 0 ? '+' : ''}{displaySrDelta}
                </Text>
                <Text style={styles.srDeltaLabel}>SR</Text>
              </View>
            </View>

            {/* SR line */}
            <View style={styles.srLine}>
              <Text style={styles.srLineLabel}>Skill Rating</Text>
              <View style={styles.srLineRight}>
                <Text style={styles.srLineBefore}>{Math.round(displaySrBefore)}</Text>
                <Text style={styles.srLineArrow}>→</Text>
                <Text style={styles.srLineAfter}>{Math.round(displaySrAfter)}</Text>
                <Text style={[styles.srLineLevel, { color: levelColors[displayLevel] }]}>
                  {displayLevel}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* You vs Bot vs Hold */}
            <View style={styles.comparisonSection}>
              {([
                { label: 'You',  value: userReturn,                    you: true },
                { label: 'Bot',  value: episode.baselines.bot_return,  you: false },
                { label: 'Hold', value: episode.baselines.hold_return, you: false },
              ] as const).map(({ label, value, you }) => (
                <View key={label} style={[styles.compItem, you && styles.compItemYou]}>
                  <Text style={[styles.compLabel, you && { color: colors.textSub }]}>
                    {label.toUpperCase()}
                  </Text>
                  <Text style={[styles.compValue, {
                    color: value >= 0 ? colors.gain : colors.loss,
                  }]}>
                    {formatReturn(value)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Insight */}
            {insights.length > 0 && (
              <View style={styles.insightCard}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{insights[0]}</Text>
              </View>
            )}

            {/* Tags */}
            <View style={styles.tagRow}>
              {episode.tags.map((t) => (
                <Text key={t} style={styles.tagText}>{t.replace(/_/g, ' ')}</Text>
              ))}
              <Text style={[styles.tagText, { color: colors.muted, opacity: 0.6 }]}>
                {DIFFICULTY_LABEL[episode.difficulty]}
              </Text>
            </View>

            <PrimaryButton
              label={
                isInSession && sessionIndex! + 1 < sessionTotal!
                  ? `Next  ${sessionIndex! + 2} / ${sessionTotal}`
                  : 'Done'
              }
              onPress={onNext}
              style={styles.nextBtn}
            />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<1 | 2 | 3, string> = { 1: 'Easy', 2: 'Standard', 3: 'Hard' }

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PAD,
    paddingBottom: space.sm,
    gap: space.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.ui,
    fontSize: 24,
    color: colors.muted,
    lineHeight: 28,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressDotDone:    { backgroundColor: colors.gold },
  progressDotPending: { backgroundColor: colors.bg3 },
  topPair: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textSub,
    letterSpacing: 0.5,
  },
  topDifficulty: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    width: 60,
    textAlign: 'right',
  },

  // Context banner (Time Machine)
  contextBanner: {
    marginHorizontal: SCREEN_PAD,
    marginBottom: space.sm,
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
    gap: 3,
  },
  contextLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.gold,
  },
  contextHeadline: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },

  // Chart
  chartWrap: { flex: 1 },

  // Bottom sheet anchor
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Reveal strip
  revealStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg1,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: SCREEN_PAD,
    paddingTop: space.md,
    paddingBottom: 36,
    gap: space.sm,
  },
  revealTrack: {
    height: 1,
    backgroundColor: colors.bg3,
    borderRadius: 1,
    overflow: 'hidden',
  },
  revealFill: {
    height: 1,
    backgroundColor: colors.gold,
  },
  revealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revealStatus: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
  },
  revealSkip: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.gold,
  },

  // Reveal done card
  revealCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  revealCardInner: {
    margin: SCREEN_PAD,
    backgroundColor: colors.bg1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.xxl,
    gap: space.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  revealPnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revealEyebrow: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.muted,
  },
  revealPnl: {
    fontFamily: fonts.serifBold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  revealDirectionBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealDirectionArrow: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  compareRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  compareCol: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: radius.sm,
    padding: space.sm,
    gap: 2,
  },
  compareLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  compareValue: {
    fontFamily: fonts.display,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  saveErrorText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.loss,
    textAlign: 'center',
  },

  // Result panel
  resultWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '68%',
    backgroundColor: colors.bg1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  resultScroll: {
    padding: space.xxl,
    gap: space.lg,
    paddingBottom: 48,
  },

  resultHero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultEyebrow: {
    fontFamily: fonts.uiMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.muted,
    marginBottom: 4,
  },
  resultPnl: {
    fontFamily: fonts.serifBold,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  srBadge: {
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 56,
  },
  srDeltaNum: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  srDeltaLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1,
  },

  srLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  srLineLabel: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
  },
  srLineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  srLineBefore: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  srLineArrow: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    paddingHorizontal: 2,
  },
  srLineAfter: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  srLineLevel: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: colors.line,
  },

  comparisonSection: {
    flexDirection: 'row',
    gap: space.sm,
  },
  compItem: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: radius.sm,
    padding: space.md,
    alignItems: 'center',
    gap: 3,
  },
  compItemYou: {
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
  },
  compLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.muted,
  },
  compValue: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },

  insightCard: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.bg2,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  insightDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: 8,
    flexShrink: 0,
  },
  insightText: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.textSub,
    lineHeight: 20,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tagText: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  nextBtn: { marginTop: space.xs },
})
