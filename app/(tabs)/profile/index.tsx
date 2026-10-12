import { useRouter } from 'expo-router'
import React, { useCallback, useMemo } from 'react'
import { flags } from '@/src/features/flags'
import { highestEligibleLevel } from '@/src/chain/sbt'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { getLevel, type Level } from '@/src/engine/rating'
import { weakestTags } from '@/src/engine/metrics'
import { useAppState } from '@/src/state/useAppState'
import { colors, fonts, levelColors, radius, space, SCREEN_PAD } from '@/src/ui/theme'
import { fadeDown } from '@/src/ui/motion'
import { LEVEL_BANDS, LevelBand, getLevelBand } from '@/src/ui/levelConfig'
import { MetricBar, getMetricColor } from '@/src/ui/components/MetricBar'
import { SRBar } from '@/src/ui/components/SRBar'
import { useShareCard } from '@/src/ui/components/ShareCard'
import type { EpisodeResultRecord } from '@/src/engine/metrics'

// ─── Metrics ──────────────────────────────────────────────────────────────────
// Computed directly from EpisodeResultRecord[] to avoid casting botReturn=0.

interface ProfileMetrics {
  winRate: number
  fomoPct: number
  disciplinePct: number | null  // null when < 2 buys
  skipQualityPct: number | null // null when < 2 skips
}

const FOMO_TAGS = new Set(['pump_dump', 'fakeout', 'breakout'])

function computeProfileMetrics(history: EpisodeResultRecord[]): ProfileMetrics {
  if (history.length === 0) {
    return { winRate: 0, fomoPct: 0, disciplinePct: null, skipQualityPct: null }
  }

  const buys = history.filter((r) => r.action !== 'skip')
  const skips = history.filter((r) => r.action === 'skip')

  const winRate = Math.round(
    (history.filter((r) => r.score > 0).length / history.length) * 100,
  )

  const fomoPct =
    buys.length > 0
      ? (buys.filter((r) => r.tags.some((t) => FOMO_TAGS.has(t as string))).length /
          buys.length) *
        100
      : 0

  // Proxy: buys where score stayed above −0.5. Direct stop-loss data is not stored
  // in EpisodeResultRecord — tracked in currentDaily only during active sessions.
  const disciplinePct =
    buys.length >= 2
      ? (buys.filter((r) => r.score > -0.5).length / buys.length) * 100
      : null

  // Skip score = tanh((0 − botReturn) / 0.15), so score ≥ 0 iff botReturn ≤ 0.
  // Directly recoverable from EpisodeResultRecord.score without needing botReturn.
  const skipQualityPct =
    skips.length >= 2
      ? (skips.filter((r) => r.score >= 0).length / skips.length) * 100
      : null

  return { winRate, fomoPct, disciplinePct, skipQualityPct }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatDate(dateISO: string): string {
  const parts = dateISO.split('-')
  const m = parseInt(parts[1] ?? '1', 10)
  const d = parseInt(parts[2] ?? '1', 10)
  return `${MONTH_ABBR[m - 1] ?? '—'} ${d}`
}

function formatScore(score: number): string {
  return (score >= 0 ? '+' : '') + score.toFixed(2)
}

// ─── StatItem ─────────────────────────────────────────────────────────────────

function StatItem({
  value,
  label,
  valueColor,
}: {
  value: string
  label: string
  valueColor?: string
}) {
  return (
    <View style={styles.statItem}>
      <Text variant="numeric" style={{ fontSize: 20, color: valueColor ?? colors.text }}>
        {value}
      </Text>
      <Text variant="caption">{label}</Text>
    </View>
  )
}

// ─── MetricRow ────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  desc,
  isLowerBetter = false,
  proxyNote,
}: {
  label: string
  value: number | null
  desc: string
  isLowerBetter?: boolean
  proxyNote?: string
}) {
  if (value === null) {
    return (
      <View style={mr.container}>
        <View style={mr.header}>
          <Text variant="body" style={mr.name}>{label}</Text>
          <Text variant="caption">— not enough data</Text>
        </View>
        <Text variant="caption" style={mr.desc}>{desc}</Text>
      </View>
    )
  }

  const pct      = Math.max(0, Math.min(100, value))
  const barColor = getMetricColor(pct, isLowerBetter)

  return (
    <View style={mr.container}>
      <View style={mr.header}>
        <Text variant="body" style={mr.name}>{label}</Text>
        <Text variant="numeric" style={[mr.value, { color: barColor }]}>
          {Math.round(pct)}%
        </Text>
      </View>
      <MetricBar value={pct} isLowerBetter={isLowerBetter} />
      <Text variant="caption" style={mr.desc}>{desc}</Text>
      {proxyNote ? (
        <View style={mr.proxyBox}>
          <Text style={mr.proxyText}>Proxy  ·  {proxyNote}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ─── HistoryRow ───────────────────────────────────────────────────────────────
// Win/loss indicated by letter badge AND color — compliant with accessibility rule.

function HistoryRow({ record }: { record: EpisodeResultRecord }) {
  const isWin = record.score > 0
  const isLoss = record.score < 0

  const outcomeLabel = isWin ? 'W' : isLoss ? 'L' : '='
  const outcomeColor = isWin ? colors.gain : isLoss ? colors.loss : colors.muted
  const outcomeBg = isWin
    ? `${colors.gain}18`
    : isLoss
      ? `${colors.loss}18`
      : `${colors.muted}12`

  const actionColor = record.action === 'long'
    ? colors.gain
    : record.action === 'short'
    ? colors.loss
    : colors.muted
  const actionBg = record.action === 'long'
    ? `${colors.gain}18`
    : record.action === 'short'
    ? `${colors.loss}18`
    : `${colors.muted}12`

  const tagText = record.tags
    .slice(0, 2)
    .join(' · ')
    .replace(/_/g, ' ')

  return (
    <View style={hr.row}>
      <View
        style={[
          hr.outcomeBadge,
          { backgroundColor: outcomeBg, borderColor: `${outcomeColor}50` },
        ]}
        accessible
        accessibilityLabel={isWin ? 'Win' : isLoss ? 'Loss' : 'Neutral'}
      >
        <Text style={[hr.outcomeText, { color: outcomeColor }]}>
          {outcomeLabel}
        </Text>
      </View>

      <View style={hr.middle}>
        <View style={[hr.actionChip, { backgroundColor: actionBg }]}>
          <Text style={[hr.actionText, { color: actionColor }]}>
            {record.action === 'long' ? '↑ L' : record.action === 'short' ? '↓ S' : 'SKIP'}
          </Text>
        </View>
        {tagText ? (
          <Text variant="caption" style={hr.tags} numberOfLines={1}>
            {tagText}
          </Text>
        ) : null}
      </View>

      <Text
        variant="numeric"
        style={[
          hr.score,
          { color: isWin ? colors.gain : isLoss ? colors.loss : colors.muted },
        ]}
      >
        {formatScore(record.score)}
      </Text>

      <Text variant="caption" style={hr.date}>
        {record.dateISO ? formatDate(record.dateISO) : '—'}
      </Text>
    </View>
  )
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter()
  const { state, loading, refresh } = useAppState()

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level = getLevel(state.sr)
  const { band, nextBand, progress } = getLevelBand(state.sr)

  const metrics = useMemo(
    () => computeProfileMetrics(state.history),
    [state.history],
  )

  const weakest = useMemo(() => weakestTags(state.history, 3), [state.history])

  const { share, sharing, cardView } = useShareCard(
    state.sr,
    state.streakDays,
    state.history.length,
  )

  const totalRounds = state.history.length
  const recentHistory = [...state.history].slice(-8).reverse()
  const srToNext = nextBand ? Math.ceil(nextBand.min - state.sr) : 0
  const behaviourReady = totalRounds >= 3

  if (loading) {
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
        {/* ── SR Hero ── */}
        <Animated.View entering={fadeDown(350)}>
          <Card variant="elevated" style={styles.hero}>
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: `${band.color}18`, borderColor: `${band.color}40` },
                ]}
              >
                <Text style={[styles.levelText, { color: band.color }]}>
                  {level.toUpperCase()}
                </Text>
              </View>
              {totalRounds > 0 && (
                <Text variant="caption">
                  {metrics.winRate}% win rate
                </Text>
              )}
            </View>

            <Text
              variant="numericLarge"
              style={{ fontSize: 68, lineHeight: 72, marginTop: space.md }}
            >
              {Math.round(state.sr)}
            </Text>
            <Text variant="caption" style={{ letterSpacing: 1.5, marginTop: 2 }}>
              SKILL RATING
            </Text>

            {/* Progress within current level band */}
            <View style={styles.progressSection}>
              <SRBar sr={state.sr} />
              <View style={styles.progressLabels}>
                <Text variant="caption" style={{ color: `${band.color}AA` }}>
                  {band.level} · {band.min}
                </Text>
                {nextBand ? (
                  <Text variant="caption">
                    {srToNext} SR to {nextBand.level}
                  </Text>
                ) : (
                  <Text variant="caption" style={{ color: band.color }}>
                    Maximum tier
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatItem value={String(totalRounds)} label="rounds" />
              {totalRounds > 0 && (
                <StatItem
                  value={`${metrics.winRate}%`}
                  label="vs bot"
                  valueColor={
                    metrics.winRate >= 55
                      ? colors.gain
                      : metrics.winRate >= 45
                        ? colors.text
                        : colors.loss
                  }
                />
              )}
              {state.streakDays > 0 && (
                <StatItem
                  value={`${state.streakDays}d`}
                  label="streak"
                  valueColor={colors.warn}
                />
              )}
            </View>

            {/* Share card button */}
            <Pressable
              onPress={share}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel="Share your Dojo rating card"
              style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.shareBtnText}>
                {sharing ? 'Preparing…' : '↑ Share rating'}
              </Text>
            </Pressable>
          </Card>
        </Animated.View>

        {/* Off-screen card captured by ViewShot */}
        {cardView}

        {/* ── Level Ladder ── */}
        <Animated.View entering={fadeDown(350, 60)}>
          <Card style={styles.ladderCard}>
            <Text variant="label" style={styles.sectionLabel}>LEVEL LADDER</Text>
            {LEVEL_BANDS.slice().reverse().map((b) => {
              const isCurrent = b.level === level
              const isAchieved = state.sr >= b.min
              return (
                <View key={b.level} style={styles.ladderRow}>
                  <View
                    style={[
                      styles.ladderDot,
                      {
                        backgroundColor: isAchieved ? b.color : 'transparent',
                        borderColor: isAchieved ? b.color : colors.line,
                      },
                    ]}
                  />
                  <Text
                    variant="caption"
                    style={{
                      flex: 1,
                      color: isCurrent ? b.color : isAchieved ? colors.text : colors.muted,
                      fontWeight: isCurrent ? '700' : '400',
                      fontSize: isCurrent ? 13 : 12,
                    }}
                  >
                    {b.level}
                  </Text>
                  <Text variant="caption" style={{ color: colors.muted }}>
                    {b.min === 850 ? '850 – 1000' : `${b.min} – ${b.max - 1}`}
                  </Text>
                  {isCurrent ? (
                    <View style={[styles.youChip, { backgroundColor: `${b.color}20` }]}>
                      <Text style={{ color: b.color, fontSize: 10, fontWeight: '700' }}>
                        YOU
                      </Text>
                    </View>
                  ) : null}
                </View>
              )
            })}
          </Card>
        </Animated.View>

        {/* ── Behaviour Analysis ── */}
        {behaviourReady ? (
          <Animated.View entering={fadeDown(350, 120)}>
            <Card style={styles.metricsCard}>
              <Text variant="label" style={styles.sectionLabel}>BEHAVIOUR ANALYSIS</Text>
              <Text variant="caption" style={{ marginBottom: space.lg }}>
                Based on {totalRounds} round{totalRounds !== 1 ? 's' : ''}.
                Each metric is a percentage score (0–100).
              </Text>

              <MetricRow
                label="Stop Discipline"
                value={metrics.disciplinePct}
                desc="Rounds without a deep loss. Higher is better."
              />

              <View style={styles.metricDivider} />

              <MetricRow
                label="Skip Quality"
                value={metrics.skipQualityPct}
                desc="Skips on charts the bot would have lost. Higher is better."
              />

              <View style={styles.metricDivider} />

              <MetricRow
                label="FOMO Rate"
                value={metrics.fomoPct}
                desc="Trades on high-risk setups. Lower is better."
                isLowerBetter
              />
            </Card>
          </Animated.View>
        ) : totalRounds > 0 ? (
          <Animated.View entering={fadeDown(350, 120)}>
            <Card variant="ghost" style={styles.behaviourPending}>
              <Text variant="label" style={{ marginBottom: space.xs }}>
                BEHAVIOUR ANALYSIS
              </Text>
              <Text variant="caption">
                {3 - totalRounds} more round{3 - totalRounds !== 1 ? 's' : ''} needed to unlock.
              </Text>
            </Card>
          </Animated.View>
        ) : null}

        {/* ── Weakest Patterns ── */}
        {weakest.length > 0 && totalRounds >= 5 ? (
          <Animated.View entering={fadeDown(350, 160)}>
            <Card style={{ gap: space.sm }}>
              <Text variant="label" style={styles.sectionLabel}>PATTERNS TO STUDY</Text>
              <Text variant="caption">
                Lowest average score across your history (min. 2 appearances each):
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 4 }}>
                {weakest.map((tag) => (
                  <View key={tag} style={styles.weakTag}>
                    <Text style={{ color: colors.loss, fontSize: 11, fontWeight: '600' }}>
                      {tag.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {/* ── Empty state ── */}
        {totalRounds === 0 ? (
          <Animated.View entering={fadeDown(350, 80)}>
            <Card variant="ghost" style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>◆</Text>
              </View>
              <Text variant="title" style={{ textAlign: 'center', marginTop: space.sm }}>
                No rounds yet
              </Text>
              <Text
                variant="body"
                style={{ color: colors.muted, textAlign: 'center', fontSize: 14, marginTop: 4 }}
              >
                Complete a Daily or Time Machine session to see behaviour metrics and history.
              </Text>
            </Card>
          </Animated.View>
        ) : null}

        {/* ── Recent History ── */}
        {recentHistory.length > 0 ? (
          <Animated.View entering={fadeDown(350, 200)}>
            <View style={styles.historyHeader}>
              <Text variant="label" style={styles.sectionLabel}>RECENT ROUNDS</Text>
              <Text variant="caption">
                {recentHistory.length} of {totalRounds}
              </Text>
            </View>

            <Card style={{ paddingVertical: space.sm, gap: 0 }}>
              {/* Column labels */}
              <View style={hr.colHeader}>
                <View style={{ width: 28 }} />
                <Text variant="caption" style={{ flex: 1, marginLeft: space.sm }}>
                  Action · Pattern
                </Text>
                <Text variant="caption" style={{ minWidth: 52, textAlign: 'right' }}>
                  Edge
                </Text>
                <Text variant="caption" style={{ minWidth: 48, textAlign: 'right' }}>
                  Date
                </Text>
              </View>

              {recentHistory.map((r, i) => (
                <View key={`${r.episodeId}-${i}`}>
                  {i > 0 ? <View style={styles.rowDivider} /> : null}
                  <HistoryRow record={r} />
                </View>
              ))}
            </Card>

            <Text variant="caption" style={styles.historyNote}>
              Showing {recentHistory.length} of {totalRounds} rounds
            </Text>
          </Animated.View>
        ) : null}

        {/* ── Level Badges ── */}
        {flags.levelSbt && (
          <Animated.View entering={fadeDown(350, 260)}>
            <Card style={styles.badgeCard}>
              <View style={styles.badgeHeader}>
                <View style={styles.badgeIconBox}>
                  <Text style={styles.badgeIconGlyph}>◆</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title">Level Badges</Text>
                  <Text variant="caption" style={{ marginTop: 2 }}>
                    Soulbound tokens on Solana
                  </Text>
                </View>
              </View>

              <Text variant="body" style={{ color: colors.muted, fontSize: 14, marginTop: space.md }}>
                Mint a non-transferable badge for your current level. Lives in your wallet on-chain. Self-reported, not audited.
              </Text>
              <Text variant="caption" style={{ marginTop: 4 }}>
                Requires Solana Mobile wallet · ~0.004–0.006 SOL rent
              </Text>

              {highestEligibleLevel(state.sr) != null && (
                <View style={{ marginTop: space.md }}>
                  <PrimaryButton
                    label={`Mint ${highestEligibleLevel(state.sr)} Badge`}
                    onPress={() => router.push(
                      `/sbt-mint?level=${highestEligibleLevel(state.sr)}&sr=${Math.round(state.sr)}` as any
                    )}
                  />
                </View>
              )}
            </Card>
          </Animated.View>
        )}

        <Text variant="caption" style={styles.disclaimer}>
          Educational simulation · Not financial advice{'\n'}
          Past performance does not predict future results
        </Text>
      </ScrollView>
    </Screen>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { padding: SCREEN_PAD, gap: space.lg, paddingBottom: 100 },

  // Hero
  hero: {},
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  progressSection: { marginTop: space.md, gap: space.xs },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  statsRow: { flexDirection: 'row', gap: space.xl, marginTop: space.md },
  statItem: { gap: 2 },
  shareBtn: {
    marginTop: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    backgroundColor: `${colors.brand}18`,
    borderWidth: 1,
    borderColor: `${colors.brand}40`,
    alignSelf: 'flex-start',
  },
  shareBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.brand,
    letterSpacing: 0.3,
  },

  // Level ladder
  ladderCard: { paddingVertical: space.md },
  ladderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 7,
  },
  ladderDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  youChip: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },

  // Metrics
  metricsCard: {},
  metricDivider: { height: 1, backgroundColor: colors.line, marginVertical: space.lg },
  behaviourPending: {
    paddingVertical: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
  },

  // Weak tags
  weakTag: {
    backgroundColor: `${colors.loss}14`,
    borderRadius: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${colors.loss}30`,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 0,
    paddingVertical: space.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.brand}18`,
    borderWidth: 1,
    borderColor: `${colors.brand}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyIconText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.brand,
  },

  // History
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  rowDivider: { height: 1, backgroundColor: `${colors.line}60` },
  historyNote: { textAlign: 'center', marginTop: space.xs },

  // Level Badges
  badgeCard: {
    borderWidth: 1,
    borderColor: `${colors.gold}35`,
    backgroundColor: colors.bg1,
  },
  badgeHeader: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  badgeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${colors.gold}12`,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeIconGlyph: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.gold,
  },

  // Global
  sectionLabel: { letterSpacing: 1, marginBottom: space.sm },
  disclaimer: { textAlign: 'center', lineHeight: 18 },
})

const mr = StyleSheet.create({
  container: { gap: space.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 15 },
  value: { fontSize: 16 },
  desc: { fontSize: 12, lineHeight: 17 },
  proxyBox: {
    backgroundColor: `${colors.warn}12`,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  proxyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.warn,
  },
})

const hr = StyleSheet.create({
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 9,
  },
  outcomeBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outcomeText: {
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
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  actionText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  tags: { flex: 1, fontSize: 11 },
  score: { fontSize: 14, minWidth: 52, textAlign: 'right' },
  date: { minWidth: 48, textAlign: 'right', fontSize: 11 },
})
