import { useRouter } from 'expo-router'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import {
  campaigns,
  getCampaignEpisodes,
  timeMachineEpisodes,
  type Campaign,
} from '@/src/content/campaigns'
import type { Episode, PatternTag } from '@/src/content/types'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs } from '@/src/ui/motion'
import { colors, radius, space } from '@/src/ui/theme'
import { loadState } from '@/src/state/store'

// ─── Campaign metadata ────────────────────────────────────────────────────────

const CAMPAIGN_ACCENT: Record<string, string> = {
  ftx_collapse_2022:       colors.loss,
  luna_crash_2022:         colors.loss,
  aug_flush_2024:          colors.warn,
  tariff_shock_2025:       colors.warn,
  liquidation_cascade_2025: colors.brand,
}

// Short editorial descriptor per campaign — one line, no sensationalism
const CAMPAIGN_DESCRIPTOR: Record<string, string> = {
  ftx_collapse_2022:        'Exchange failure · SOL −70%',
  luna_crash_2022:          'Algorithmic stablecoin death spiral',
  aug_flush_2024:           'Macro risk-off · Yen carry unwind',
  tariff_shock_2025:        'Policy shock → reversal in 6 days',
  liquidation_cascade_2025: 'Leverage flush · funding reset',
}

const TAG_LABEL: Record<PatternTag, string> = {
  slow_bleed:    'SLOW BLEED',
  capitulation:  'CAPITULATION',
  fakeout:       'FAKEOUT',
  breakout:      'BREAKOUT',
  range:         'RANGE',
  trend_pullback:'PULLBACK',
  pump_dump:     'PUMP & DUMP',
}

// ─── Status computation ───────────────────────────────────────────────────────

type CampaignState = 'available' | 'completed'

interface CampaignStatus {
  state: CampaignState
  completedCount: number
  totalCount: number
}

function computeStatus(campaign: Campaign, attemptedIds: Set<string>): CampaignStatus {
  const totalCount = campaign.episodeIds.length
  const completedCount = campaign.episodeIds.filter((id) => attemptedIds.has(id)).length
  const state: CampaignState = completedCount >= totalCount ? 'completed' : 'available'
  return { state, completedCount, totalCount }
}

function getMaxDifficulty(eps: Episode[]): 1 | 2 | 3 {
  return (Math.max(...eps.map((e) => e.difficulty)) as 1 | 2 | 3) || 2
}

function getUniqueTags(eps: Episode[]): PatternTag[] {
  const seen = new Set<PatternTag>()
  eps.forEach((ep) => ep.tags.forEach((t) => seen.add(t)))
  return Array.from(seen).slice(0, 3)
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────
// Pure View bars, close-price downsampled from episode before-candles.
// No Skia dependency — keeps card rendering lightweight.

function MiniSparkline({ episodeId, color }: { episodeId: string; color: string }) {
  const candles = useMemo(() => {
    const ep = timeMachineEpisodes.find((e) => e.id === episodeId)
    if (!ep || ep.before.length === 0) return []
    const closes = ep.before.map((c) => c[4])
    const step = Math.max(1, Math.floor(closes.length / 16))
    return closes.filter((_, i) => i % step === 0).slice(0, 16)
  }, [episodeId])

  if (candles.length === 0) return <View style={{ height: 28 }} />

  const min = Math.min(...candles)
  const max = Math.max(...candles)
  const range = max - min || 1
  const H = 28

  return (
    <View style={sparkStyles.row}>
      {candles.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * H)
        const isLast = i === candles.length - 1
        return (
          <View
            key={i}
            style={[sparkStyles.bar, {
              height: h,
              backgroundColor: color,
              opacity: isLast ? 0.9 : 0.28 + (i / candles.length) * 0.22,
            }]}
          />
        )
      })}
    </View>
  )
}

const sparkStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 28 },
  bar: { width: 3, borderRadius: 1 },
})

// ─── Tag chip ────────────────────────────────────────────────────────────────

function TagChip({ tag, color }: { tag: PatternTag; color: string }) {
  return (
    <View style={[tagStyles.chip, { borderColor: `${color}35` }]}>
      <Text style={[tagStyles.label, { color: `${color}CC` }]}>
        {TAG_LABEL[tag] ?? tag.toUpperCase()}
      </Text>
    </View>
  )
}

const tagStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.6,
  },
})

// ─── Campaign card ────────────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

function CampaignCard({
  campaign,
  status,
  onPress,
  index,
}: {
  campaign: Campaign
  status: CampaignStatus
  onPress: () => void
  index: number
}) {
  const pressed = useSharedValue(0)
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.975 : 1, springs.snappy) }],
  }))

  const accent = CAMPAIGN_ACCENT[campaign.id] ?? colors.brand
  const eps = getCampaignEpisodes(campaign)
  const maxDiff = getMaxDifficulty(eps)
  const tags = getUniqueTags(eps)
  const firstEpisodeId = campaign.episodeIds[0]
  const descriptor = CAMPAIGN_DESCRIPTOR[campaign.id] ?? campaign.subtitle
  const isCompleted = status.state === 'completed'

  return (
    <Animated.View entering={FadeInDown.duration(320).delay(index * 55).springify()}>
      <AnimatedPressable
        onPressIn={() => { pressed.value = 1 }}
        onPressOut={() => { pressed.value = 0 }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${campaign.title}, ${campaign.period}`}
        style={animStyle}
      >
        <View style={[cardStyles.card, isCompleted && cardStyles.cardCompleted]}>
          {/* Top row: period + difficulty */}
          <View style={cardStyles.topRow}>
            <View style={[cardStyles.periodBadge, { backgroundColor: `${accent}14`, borderColor: `${accent}35` }]}>
              <Text style={[cardStyles.periodText, { color: accent }]}>
                {campaign.period.toUpperCase()}
              </Text>
            </View>
            <View style={cardStyles.topRight}>
              {maxDiff === 3 && (
                <View style={cardStyles.hardBadge}>
                  <Text style={cardStyles.hardText}>HARD</Text>
                </View>
              )}
              {isCompleted && (
                <View style={cardStyles.doneBadge}>
                  <Text style={cardStyles.doneText}>✓ DONE</Text>
                </View>
              )}
            </View>
          </View>

          {/* Title + descriptor */}
          <View style={cardStyles.titleBlock}>
            <Text style={cardStyles.title}>{campaign.title}</Text>
            <Text style={cardStyles.descriptor}>{descriptor}</Text>
          </View>

          {/* Sparkline */}
          <MiniSparkline episodeId={firstEpisodeId} color={accent} />

          {/* Footer: tags + checkpoint count */}
          <View style={cardStyles.footer}>
            <View style={cardStyles.tagRow}>
              {tags.map((t) => (
                <TagChip key={t} tag={t} color={accent} />
              ))}
            </View>
            <Text style={cardStyles.checkpointCount}>
              {campaign.episodeIds.length} chart{campaign.episodeIds.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  )
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  cardCompleted: {
    borderColor: `${colors.gain}25`,
    backgroundColor: colors.bg1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodBadge: {
    borderRadius: 5,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  periodText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.7,
  },
  topRight: {
    flexDirection: 'row',
    gap: space.xs,
    alignItems: 'center',
  },
  hardBadge: {
    backgroundColor: `${colors.loss}14`,
    borderWidth: 1,
    borderColor: `${colors.loss}35`,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  hardText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.loss,
  },
  doneBadge: {
    backgroundColor: `${colors.gain}14`,
    borderWidth: 1,
    borderColor: `${colors.gain}35`,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  doneText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.gain,
  },
  titleBlock: { gap: 3 },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.text,
  },
  descriptor: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    letterSpacing: 0.1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', flex: 1 },
  checkpointCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.6,
  },
})

// ─── Campaign detail ──────────────────────────────────────────────────────────

function CampaignDetail({
  campaign,
  status,
  onBack,
  onStart,
}: {
  campaign: Campaign
  status: CampaignStatus
  onBack: () => void
  onStart: (c: Campaign) => void
}) {
  const eps = getCampaignEpisodes(campaign)
  const accent = CAMPAIGN_ACCENT[campaign.id] ?? colors.brand
  const maxDiff = getMaxDifficulty(eps)
  const isCompleted = status.state === 'completed'

  const ctaLabel = isCompleted
    ? `Replay — ${eps.length} chart${eps.length !== 1 ? 's' : ''}`
    : `Start — ${eps.length} chart${eps.length !== 1 ? 's' : ''}`

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={{ gap: space.lg }}
    >
      {/* Back nav */}
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back to all scenarios"
        style={detailStyles.backBtn}
      >
        <Text style={detailStyles.backLabel}>← Scenarios</Text>
      </Pressable>

      {/* Header */}
      <View style={detailStyles.header}>
        <View style={detailStyles.headerMeta}>
          <View style={[detailStyles.periodBadge, { backgroundColor: `${accent}14`, borderColor: `${accent}35` }]}>
            <Text style={[detailStyles.periodText, { color: accent }]}>
              {campaign.period.toUpperCase()}
            </Text>
          </View>
          {isCompleted ? (
            <View style={detailStyles.completedBadge}>
              <Text style={detailStyles.completedText}>COMPLETED</Text>
            </View>
          ) : maxDiff === 3 ? (
            <View style={detailStyles.hardBadge}>
              <Text style={detailStyles.hardText}>HARD</Text>
            </View>
          ) : null}
        </View>

        <Text style={detailStyles.title}>{campaign.title}</Text>
        <Text style={detailStyles.subtitle}>{campaign.subtitle}</Text>
      </View>

      {/* Divider */}
      <View style={detailStyles.divider} />

      {/* Timeline */}
      <View style={{ gap: 2 }}>
        <Text style={detailStyles.sectionLabel}>SCENARIO TIMELINE</Text>
        <Text style={detailStyles.sectionSub}>
          {eps.length} decision point{eps.length !== 1 ? 's' : ''} · chronological
        </Text>
      </View>

      <View style={detailStyles.timeline}>
        {eps.map((ep, i) => {
          const isLast = i === eps.length - 1
          const epTags = ep.tags.slice(0, 2)
          const diffLabel = ep.difficulty === 3 ? 'HARD' : ep.difficulty === 1 ? 'EASY' : 'STD'
          const diffColor = ep.difficulty === 3 ? colors.loss : ep.difficulty === 1 ? colors.gain : colors.muted

          return (
            <View key={ep.id} style={detailStyles.timelineRow}>
              {/* Left: dot + line */}
              <View style={detailStyles.timelineTrack}>
                <View style={[detailStyles.dot, { backgroundColor: accent }]} />
                {!isLast && <View style={[detailStyles.line, { backgroundColor: `${accent}30` }]} />}
              </View>

              {/* Right: content */}
              <View style={[detailStyles.checkpointCard, isLast && { marginBottom: 0 }]}>
                {/* Date */}
                {ep.context?.date && (
                  <Text style={[detailStyles.epDate, { color: accent }]}>
                    {ep.context.date.toUpperCase()}
                  </Text>
                )}

                {/* Headline */}
                {ep.context?.headline && (
                  <Text style={detailStyles.epHeadline}>{ep.context.headline}</Text>
                )}

                {/* Body */}
                {ep.context?.body && (
                  <Text style={detailStyles.epBody} numberOfLines={3}>
                    {ep.context.body}
                  </Text>
                )}

                {/* Tags + difficulty */}
                <View style={detailStyles.epMeta}>
                  {epTags.map((t) => (
                    <TagChip key={t} tag={t} color={accent} />
                  ))}
                  <View style={[detailStyles.diffBadge, { borderColor: `${diffColor}35` }]}>
                    <Text style={[detailStyles.diffText, { color: diffColor }]}>{diffLabel}</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        })}
      </View>

      <PrimaryButton
        label={ctaLabel}
        onPress={() => onStart(campaign)}
        variant={isCompleted ? 'secondary' : 'primary'}
      />

      <Text style={detailStyles.disclaimer}>
        Simulated decisions on historical data.{'\n'}
        Outcomes reflect the actual market, not guaranteed results.
      </Text>
    </Animated.View>
  )
}

const detailStyles = StyleSheet.create({
  backBtn: { paddingVertical: space.xs },
  backLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: colors.muted,
    letterSpacing: 0.1,
  },

  header: { gap: space.sm },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  periodBadge: {
    borderRadius: 5,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  periodText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.7,
  },
  completedBadge: {
    backgroundColor: `${colors.gain}14`,
    borderWidth: 1,
    borderColor: `${colors.gain}35`,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  completedText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.gain,
  },
  hardBadge: {
    backgroundColor: `${colors.loss}14`,
    borderWidth: 1,
    borderColor: `${colors.loss}35`,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  hardText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.loss,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.8,
    color: colors.text,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },

  divider: { height: 1, backgroundColor: colors.line },

  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.muted,
  },
  sectionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.5,
    marginTop: 1,
  },

  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: space.md },
  timelineTrack: { alignItems: 'center', width: 16, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  line: { width: 1.5, flex: 1, marginTop: 4, marginBottom: 0 },

  checkpointCard: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.sm,
    marginBottom: space.md,
  },

  epDate: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  epHeadline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    letterSpacing: -0.1,
  },
  epBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  epMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  diffBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  diffText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },

  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.45,
    textAlign: 'center',
    lineHeight: 16,
  },
})

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TimeMachineScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set())
  const navigating = useRef(false)

  const refresh = useCallback(async () => {
    const state = await loadState()
    setAttemptedIds(new Set(state.history.map((h) => h.episodeId)))
  }, [])

  useFocusEffect(useCallback(() => {
    refresh()
    return () => {}
  }, [refresh]))

  const startCampaign = useCallback((camp: Campaign) => {
    if (navigating.current) return
    const eps = getCampaignEpisodes(camp)
    if (eps.length === 0) return
    navigating.current = true
    haptics.confirm()
    ;(global as any).__pendingDailyIds = eps.map((e) => e.id)
    router.push({
      pathname: '/round',
      params: {
        episodeId: eps[0].id,
        sessionIndex: '0',
        sessionTotal: String(eps.length),
        returnTo: 'time-machine',
      },
    })
    // Reset guard after navigation (screen will remount)
    setTimeout(() => { navigating.current = false }, 1000)
  }, [router])

  const openDetail = useCallback((camp: Campaign) => {
    haptics.select()
    setSelected(camp)
  }, [])

  const closeDetail = useCallback(() => {
    setSelected(null)
  }, [])

  const statuses = useMemo(
    () => Object.fromEntries(
      campaigns.map((c) => [c.id, computeStatus(c, attemptedIds)])
    ) as Record<string, CampaignStatus>,
    [attemptedIds],
  )

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={screenStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — always visible */}
        <Animated.View entering={FadeInDown.duration(280).springify()} style={screenStyles.header}>
          <Text style={screenStyles.headerEyebrow}>TIME MACHINE</Text>
          <Text style={screenStyles.headerTitle}>
            Historical{'\n'}scenarios.
          </Text>
          <Text style={screenStyles.headerBody}>
            Navigate real market events using the actual charts from those days.
            Your decisions are scored against what the market did next.
          </Text>
        </Animated.View>

        {/* Stats bar */}
        <Animated.View entering={FadeInDown.duration(280).delay(60).springify()}>
          <View style={screenStyles.statsBar}>
            <View style={screenStyles.statItem}>
              <Text style={screenStyles.statValue}>{campaigns.length}</Text>
              <Text style={screenStyles.statLabel}>scenarios</Text>
            </View>
            <View style={screenStyles.statDivider} />
            <View style={screenStyles.statItem}>
              <Text style={screenStyles.statValue}>
                {campaigns.reduce((s, c) => s + c.episodeIds.length, 0)}
              </Text>
              <Text style={screenStyles.statLabel}>decision points</Text>
            </View>
            <View style={screenStyles.statDivider} />
            <View style={screenStyles.statItem}>
              <Text style={screenStyles.statValue}>
                {Object.values(statuses).filter((s) => s.state === 'completed').length}
              </Text>
              <Text style={screenStyles.statLabel}>completed</Text>
            </View>
          </View>
        </Animated.View>

        {/* Campaign list or detail */}
        {selected ? (
          <CampaignDetail
            campaign={selected}
            status={statuses[selected.id] ?? { state: 'available', completedCount: 0, totalCount: selected.episodeIds.length }}
            onBack={closeDetail}
            onStart={startCampaign}
          />
        ) : (
          <View style={{ gap: space.md }}>
            {campaigns.map((camp, i) => (
              <CampaignCard
                key={camp.id}
                campaign={camp}
                status={statuses[camp.id] ?? { state: 'available', completedCount: 0, totalCount: camp.episodeIds.length }}
                onPress={() => openDetail(camp)}
                index={i}
              />
            ))}
          </View>
        )}

        <Text style={screenStyles.disclaimer}>
          Educational simulation. Not financial advice.{'\n'}
          Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const screenStyles = StyleSheet.create({
  content: {
    padding: space.lg,
    gap: space.lg,
    paddingBottom: 100,
  },
  header: { gap: space.sm, paddingBottom: space.xs },
  headerEyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.warn,
  },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: colors.text,
  },
  headerBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    letterSpacing: 0.1,
  },

  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as any,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.line,
    marginVertical: 4,
  },

  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.4,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: space.sm,
  },
})
