import { useRouter } from 'expo-router'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { completeDailySession, loadState, type AppState, type RoundResult } from '@/src/state/store'
import { computeBehaviourMetrics, generateInsights } from '@/src/engine/insights'
import { getLevel } from '@/src/engine/rating'
import { dateToISODate } from '@/src/engine/streak'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { fadeDown, fadeUp } from '@/src/ui/motion'
import { colors, levelColors, radius, space } from '@/src/ui/theme'
import { LEVEL_BANDS, getLevelBand, getLevelColor } from '@/src/ui/levelConfig'
import { SRBar } from '@/src/ui/components/SRBar'
import type { PatternTag } from '@/src/content/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayRound {
  roundNumber: number
  episodeId: string
  tags: PatternTag[]
  action: 'long' | 'short' | 'skip'
  score: number
  userReturn: number | null   // null when reopened (EpisodeResultRecord has no userReturn)
  botReturn: number | null
  srDelta: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signedPct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'
}

function signedInt(n: number): string {
  return (n >= 0 ? '+' : '') + String(n)
}

// ─── DailySummaryScreen ───────────────────────────────────────────────────────

export default function DailySummaryScreen() {
  const router = useRouter()

  const [rounds,      setRounds]      = useState<DisplayRound[]>([])
  const [finalState,  setFinalState]  = useState<AppState | null>(null)
  const [srDeltaSession, setSrDeltaSession] = useState(0)
  const [insight,     setInsight]     = useState<string | null>(null)
  const [dailyNumber, setDailyNumber] = useState(1)
  const [isReopen,    setIsReopen]    = useState(false)

  // Guard: fire haptic only once
  const hapticFired = useRef(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      // ── 1. Load state BEFORE completing (captures completedResults) ──
      const rawState = await loadState()
      if (!mounted) return
      const todayISO = dateToISODate(new Date())

      // Detect re-open (session already completed for today)
      const alreadyCompleted = rawState.lastCompletedDateISO === todayISO
      setIsReopen(alreadyCompleted)

      // ── 2. Capture session rounds from completedResults (rich data) ──
      let displayRounds: DisplayRound[] = []

      const sessionResults = rawState.currentDaily?.completedResults ?? []

      if (sessionResults.length > 0) {
        // Primary path: first open, completedResults are still present
        displayRounds = sessionResults.map((r, i) => ({
          roundNumber: i + 1,
          episodeId:   r.episodeId,
          tags:        r.tags,
          action:      r.action,
          score:       r.score,
          userReturn:  r.userReturn,
          botReturn:   r.botReturn,
          srDelta:     r.srDelta,
        }))
      } else {
        // Fallback: re-opened after session cleared — use today's EpisodeResultRecords
        displayRounds = rawState.history
          .filter((h) => h.dateISO === todayISO)
          .slice(0, 5)
          .map((h, i) => ({
            roundNumber: i + 1,
            episodeId:   h.episodeId,
            tags:        h.tags,
            action:      h.action,
            score:       h.score,
            userReturn:  null,
            botReturn:   null,
            srDelta:     null,
          }))
      }

      // ── 3. Session SR delta ──
      const totalSrDelta = displayRounds.reduce(
        (sum, r) => sum + (r.srDelta ?? 0), 0,
      )
      setSrDeltaSession(totalSrDelta)
      setRounds(displayRounds)

      // ── 4. Daily number ──
      const epoch = new Date('2026-10-11T00:00:00.000Z').getTime()
      const now   = new Date(`${todayISO}T00:00:00.000Z`).getTime()
      setDailyNumber(Math.max(1, Math.round((now - epoch) / 86400000) + 1))

      // ── 5. Complete session (idempotent: won't double-count streak) ──
      const completed = await completeDailySession()
      if (!mounted) return
      setFinalState(completed)

      // ── 6. Haptic — only on first completion, only once ──
      if (!alreadyCompleted && !hapticFired.current) {
        hapticFired.current = true
        haptics.streakMilestone()
      }

      // ── 7. Session insight (requires ≥ 3 rounds with rich data) ──
      if (displayRounds.length >= 3 && sessionResults.length > 0) {
        const asRoundResults: RoundResult[] = displayRounds.map((r) => ({
          episodeId:  r.episodeId,
          tags:       r.tags,
          action:     r.action,
          userReturn: r.userReturn ?? 0,
          botReturn:  r.botReturn ?? 0,
          score:      r.score,
          srDelta:    r.srDelta ?? 0,
          difficulty: 2 as const,
        }))
        const metrics = computeBehaviourMetrics(asRoundResults)
        const last = asRoundResults[asRoundResults.length - 1]!
        const ins = generateInsights(metrics, last)
        setInsight(ins[0] ?? null)
      }
    }

    init()
    return () => { mounted = false }
  }, [])

  // ── Derived metrics ──
  const wins     = rounds.filter((r) => r.score > 0).length
  const losses   = rounds.filter((r) => r.score < 0).length
  const neutral  = rounds.filter((r) => r.score === 0).length
  const played   = rounds.length
  const winRate  = played > 0 ? Math.round((wins / played) * 100) : 0
  const winColor = winRate >= 60 ? colors.gain : winRate >= 40 ? colors.warn : colors.loss

  const level      = finalState ? getLevel(finalState.sr) : 'Trader'
  const levelColor = getLevelColor(level)
  const srNow      = finalState?.sr ?? 500
  const srBefore   = srNow - srDeltaSession
  const streakDays = finalState?.streakDays ?? 0

  if (!finalState && rounds.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="label">Loading…</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ── */}
        <Animated.View entering={fadeDown(380)} style={styles.hero}>
          <View style={styles.heroCompletion}>
            <View style={styles.completionMark}>
              <Text style={styles.completionCheck}>✓</Text>
            </View>
            <View style={styles.heroTextGroup}>
              <Text variant="caption" style={{ letterSpacing: 1.5, color: colors.muted }}>
                DAILY #{dailyNumber}
              </Text>
              <Text variant="title" style={{ fontSize: 22, marginTop: 2 }}>
                Session complete
              </Text>
            </View>
          </View>

          <View style={styles.heroScoreRow}>
            <View style={styles.heroScoreItem}>
              <Text variant="numericLarge" style={{ fontSize: 48, color: winColor }}>
                {wins}
              </Text>
              <Text variant="caption" style={{ marginTop: 2 }}>
                outperformed bot
              </Text>
            </View>
            <View style={styles.heroScoreDivider} />
            <View style={styles.heroScoreItem}>
              <Text variant="numericLarge" style={{ fontSize: 48, color: colors.muted }}>
                {played}
              </Text>
              <Text variant="caption" style={{ marginTop: 2 }}>
                rounds played
              </Text>
            </View>
          </View>

          {/* Win rate bar */}
          <View style={styles.winRateSection}>
            <View style={styles.winRateLabels}>
              <Text variant="caption">Win rate</Text>
              <Text variant="numeric" style={{ fontSize: 14, color: winColor }}>
                {winRate}%
              </Text>
            </View>
            <View style={styles.winRateTrack}>
              <View
                style={[styles.winRateFill, { width: `${winRate}%` as any, backgroundColor: winColor }]}
              />
            </View>
          </View>

          {/* Streak */}
          {streakDays > 0 && (
            <View style={styles.streakBadge}>
              <Text variant="label" style={{ color: colors.warn, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 }}>
                {streakDays}
              </Text>
              <Text variant="label" style={{ color: colors.warn }}>
                day streak
              </Text>
            </View>
          )}

          {/* Re-open notice */}
          {isReopen && (
            <Text variant="caption" style={styles.reopenNote}>
              Session results loaded from today's history.
            </Text>
          )}
        </Animated.View>

        {/* ── SR Card ── */}
        <Animated.View entering={fadeDown(360, 70)}>
          <Card variant="elevated" style={styles.srCard}>
            <View style={styles.srCardTop}>
              <View style={styles.srCardLeft}>
                <Text variant="caption" style={{ letterSpacing: 1 }}>SKILL RATING</Text>
                <Text variant="numericLarge" style={{ fontSize: 52, marginTop: 4 }}>
                  {Math.round(srNow)}
                </Text>
              </View>
              <View style={styles.srCardRight}>
                <View
                  style={[styles.levelBadge, {
                    backgroundColor: `${levelColor}18`,
                    borderColor: `${levelColor}40`,
                  }]}
                >
                  <Text style={[styles.levelText, { color: levelColor }]}>
                    {level.toUpperCase()}
                  </Text>
                </View>
                {srDeltaSession !== 0 && (
                  <Text
                    variant="numeric"
                    style={[
                      styles.srDeltaLabel,
                      { color: srDeltaSession >= 0 ? colors.gain : colors.loss },
                    ]}
                  >
                    {signedInt(srDeltaSession)} today
                  </Text>
                )}
              </View>
            </View>

            {/* Level progress */}
            <View style={styles.srProgress}>
                <SRBar sr={srNow} />
              <View style={styles.srProgressLabels}>
                <Text variant="caption" style={{ color: `${levelColor}99` }}>
                  {level}
                </Text>
                {srDeltaSession !== 0 && (
                  <Text variant="caption">
                    {Math.round(srBefore)} → {Math.round(srNow)}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ── Round breakdown ── */}
        {played > 0 && (
          <Animated.View entering={fadeDown(360, 140)}>
            <Card style={styles.roundsCard}>
              <View style={styles.roundsHeader}>
                <Text variant="label" style={{ letterSpacing: 1 }}>ROUND RESULTS</Text>
                <Text variant="caption">
                  {wins}W · {losses}L{neutral > 0 ? ` · ${neutral}=` : ''}
                </Text>
              </View>

              {rounds.map((r, idx) => (
                <View key={`${r.episodeId}-${idx}`}>
                  {idx > 0 && <View style={styles.rowDivider} />}
                  <RoundRow round={r} />
                </View>
              ))}

              {/* Empty slots if session was incomplete */}
              {Array.from({ length: Math.max(0, 5 - played) }, (_, i) => (
                <View key={`empty-${i}`}>
                  <View style={styles.rowDivider} />
                  <View style={styles.emptyRoundRow}>
                    <View style={[styles.roundNumBadge, { backgroundColor: colors.bg2 }]}>
                      <Text variant="caption" style={{ color: colors.muted }}>
                        {played + i + 1}
                      </Text>
                    </View>
                    <Text variant="caption" style={{ color: `${colors.muted}60` }}>
                      Not played
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {/* ── Empty state ── */}
        {played === 0 && (
          <Animated.View entering={fadeDown(360, 140)}>
            <Card variant="ghost" style={styles.emptyState}>
              <Text variant="label" style={{ textAlign: 'center' }}>No rounds recorded</Text>
              <Text variant="caption" style={{ textAlign: 'center', marginTop: space.xs }}>
                Session data may not have been saved. Return to training and try again.
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* ── Session insight ── */}
        {insight && (
          <Animated.View entering={fadeDown(360, 210)}>
            <Card style={styles.insightCard}>
              <Text variant="caption" style={{ letterSpacing: 1, marginBottom: space.sm }}>
                SESSION INSIGHT
              </Text>
              <View style={styles.insightRow}>
                <View style={styles.insightDot} />
                <Text variant="body" style={styles.insightText}>{insight}</Text>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* ── CTA ── */}
        <Animated.View entering={fadeUp(360, 260)}>
          <PrimaryButton
            label="Back to training"
            onPress={() => router.replace('/(tabs)/train')}
          />
        </Animated.View>

        <Text variant="caption" style={styles.disclaimer}>
          Educational simulation · Not financial advice
        </Text>
      </ScrollView>
    </Screen>
  )
}

// ─── RoundRow ────────────────────────────────────────────────────────────────

function RoundRow({ round }: { round: DisplayRound }) {
  const isWin  = round.score > 0
  const isLoss = round.score < 0

  const outcomeLabel = isWin ? 'W' : isLoss ? 'L' : '='
  const outcomeColor = isWin ? colors.gain : isLoss ? colors.loss : colors.muted
  const outcomeBg    = isWin
    ? `${colors.gain}18`
    : isLoss
      ? `${colors.loss}18`
      : `${colors.muted}12`

  const tagText = round.tags
    .slice(0, 2)
    .join(' · ')
    .replace(/_/g, ' ')

  const hasSrDelta = round.srDelta !== null && round.srDelta !== 0

  return (
    <View style={rr.row}>
      {/* Round number */}
      <View style={[rr.numBadge, { backgroundColor: outcomeBg, borderColor: `${outcomeColor}40` }]}>
        <Text style={[rr.numText, { color: outcomeColor }]}>{round.roundNumber}</Text>
      </View>

      {/* Action + tags */}
      <View style={rr.middle}>
        <View style={[rr.actionChip, {
          backgroundColor: round.action === 'long'
            ? `${colors.gain}18`
            : round.action === 'short'
            ? `${colors.loss}18`
            : `${colors.muted}12`,
        }]}>
          <Text style={[rr.actionText, {
            color: round.action === 'long'
              ? colors.gain
              : round.action === 'short'
              ? colors.loss
              : colors.muted,
          }]}>
            {round.action === 'long' ? '↑ LONG' : round.action === 'short' ? '↓ SHORT' : 'SKIP'}
          </Text>
        </View>
        {tagText ? (
          <Text variant="caption" style={rr.tags} numberOfLines={1}>{tagText}</Text>
        ) : null}
      </View>

      {/* Outcome badge (letter, not color alone) */}
      <View style={[rr.outcomeBadge, { backgroundColor: outcomeBg, borderColor: `${outcomeColor}50` }]}>
        <Text style={[rr.outcomeText, { color: outcomeColor }]}>{outcomeLabel}</Text>
      </View>

      {/* SR delta (when available) */}
      <Text
        variant="numeric"
        style={[
          rr.srDelta,
          { color: hasSrDelta
              ? ((round.srDelta ?? 0) >= 0 ? colors.gain : colors.loss)
              : colors.muted,
          },
        ]}
      >
        {hasSrDelta ? signedInt(round.srDelta!) : '—'}
      </Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },

  // Hero
  hero: {
    backgroundColor: colors.bg1,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  heroCompletion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  completionMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.gain}18`,
    borderWidth: 1.5,
    borderColor: `${colors.gain}50`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCheck: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.gain,
    lineHeight: 24,
  },
  heroTextGroup: { gap: 2 },

  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
  },
  heroScoreItem: { alignItems: 'center', gap: 0 },
  heroScoreDivider: {
    width: 1,
    height: 52,
    backgroundColor: colors.line,
  },

  winRateSection: { gap: space.xs },
  winRateLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winRateTrack: {
    height: 6,
    backgroundColor: colors.bg2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  winRateFill: { height: 6, borderRadius: 3 },

  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    backgroundColor: `${colors.warn}12`,
    borderRadius: 8,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${colors.warn}28`,
  },
  reopenNote: {
    color: colors.muted,
    opacity: 0.6,
    textAlign: 'center',
  },

  // SR card
  srCard: {},
  srCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  srCardLeft: { gap: 0 },
  srCardRight: {
    alignItems: 'flex-end',
    gap: space.sm,
  },
  levelBadge: {
    borderRadius: radius.chip,
    paddingVertical: 4,
    paddingHorizontal: space.md,
    borderWidth: 1,
  },
  levelText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
  },
  srDeltaLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  srProgress: {
    marginTop: space.md,
    gap: space.xs,
  },
  srProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // Rounds
  roundsCard: { gap: 0, paddingVertical: space.sm },
  roundsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 2,
  },
  rowDivider: { height: 1, backgroundColor: `${colors.line}60` },
  emptyRoundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  roundNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    paddingVertical: space.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },

  // Insight
  insightCard: { gap: 0 },
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
  insightText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 22 },

  disclaimer: { textAlign: 'center', color: colors.muted },
})

const rr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  numBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    lineHeight: 14,
  },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    overflow: 'hidden',
  },
  actionChip: {
    borderRadius: 4,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  actionText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tags: { flex: 1, fontSize: 11 },
  outcomeBadge: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    lineHeight: 13,
  },
  srDelta: {
    fontSize: 13,
    minWidth: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
})
