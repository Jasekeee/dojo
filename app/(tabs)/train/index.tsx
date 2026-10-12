import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { Chip } from '@/src/ui/components/Chip'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { SRBar } from '@/src/ui/components/SRBar'
import { getLevel } from '@/src/engine/rating'
import { episodes } from '@/src/content/episodes'
import { colors, fonts, levelColors, radius, space, SCREEN_PAD } from '@/src/ui/theme'
import { haptics } from '@/src/ui/haptics'
import type { PatternTag } from '@/src/content/types'
import { useAppState } from '@/src/state/useAppState'
import { getWeakTags } from '@/src/state/store'
import { getLevelBand } from '@/src/ui/levelConfig'

export default function TrainScreen() {
  const router = useRouter()
  const { state, loading, refresh, dailyNumber, isDailyDone, dailyEpisodeIds, ensureDailyStarted } = useAppState()
  const [starting, setStarting] = useState(false)
  const startGuard = useRef(false)

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level      = getLevel(state.sr)
  const levelColor = levelColors[level]
  const { nextBand } = getLevelBand(state.sr)
  const weakTags: PatternTag[] = getWeakTags(state.history)
  const lastResult = state.history[state.history.length - 1]
  const srToNext   = nextBand ? nextBand.min - Math.round(state.sr) : 0

  const startDaily = async () => {
    if (startGuard.current) return
    startGuard.current = true
    setStarting(true)
    haptics.confirm()
    try {
      const ids = await ensureDailyStarted()
      ;(global as any).__pendingDailyIds = ids
      await AsyncStorage.setItem('@dojo/pendingSessionIds', JSON.stringify(ids))
      router.push({
        pathname: '/round',
        params: { episodeId: ids[0], sessionIndex: '0', sessionTotal: String(ids.length) },
      })
    } finally {
      startGuard.current = false
      setStarting(false)
    }
  }

  const startPractice = (tag: PatternTag) => {
    const tagged = episodes.filter((e) => e.tags.includes(tag))
    if (tagged.length === 0) return
    haptics.select()
    const ep = tagged[Math.floor(Math.random() * tagged.length)]!
    router.push({ pathname: '/round', params: { episodeId: ep.id } })
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonHeader} />
          <View style={styles.skeletonHero} />
          <View style={styles.skeletonSm} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header: wordmark + SR pill ── */}
        <Animated.View entering={FadeInDown.duration(380).springify()} style={styles.header}>
          <Text style={styles.wordmark}>Dojo</Text>
          <View style={[styles.srPill, { borderColor: `${levelColor}30` }]}>
            <Text style={styles.srNum}>{Math.round(state.sr)}</Text>
            <Text style={[styles.srLevel, { color: levelColor }]}>{level}</Text>
          </View>
        </Animated.View>

        {/* ── Hero daily card — dark tonal, champagne border ── */}
        <Animated.View entering={FadeInDown.duration(380).delay(60).springify()}>
          {isDailyDone ? (
            <View style={styles.doneCard}>
              <View style={styles.doneIcon}>
                <Text style={styles.doneCheck}>✓</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.doneTitle}>Daily #{dailyNumber} complete</Text>
                <Text style={styles.doneSub}>Back tomorrow for a new set</Text>
              </View>
            </View>
          ) : (
            <View style={styles.heroCard}>
              {/* Champagne top edge */}
              <View style={styles.heroEdge} />

              <Text style={styles.heroEyebrow}>DAILY #{dailyNumber}</Text>
              <Text style={styles.heroTitle}>
                {dailyEpisodeIds.length} charts · ~{Math.ceil(dailyEpisodeIds.length * 0.35)} min
              </Text>
              <Text style={styles.heroSub}>Read the market. Beat the bot.</Text>

              {/* Progress dots */}
              <View style={styles.progressDots}>
                {Array.from({ length: Math.min(dailyEpisodeIds.length, 10) }).map((_, i) => (
                  <View key={i} style={styles.progressDot} />
                ))}
              </View>

              <PrimaryButton
                label={starting ? 'Setting up your charts…' : 'Start Training →'}
                loading={starting}
                onPress={startDaily}
                style={styles.heroBtn}
              />
            </View>
          )}
        </Animated.View>

        {/* ── SR detail row ── */}
        <Animated.View entering={FadeInDown.duration(380).delay(100).springify()} style={styles.srRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.srEyebrow}>SKILL RATING</Text>
              {nextBand && <Text style={styles.srToNext}>{srToNext} to {nextBand.level}</Text>}
            </View>
            <SRBar sr={state.sr} compact />
          </View>
          {state.streakDays > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakNum}>{state.streakDays}</Text>
              <Text style={styles.streakLabel}>streak</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Focus areas ── */}
        {weakTags.length > 0 && (
          <Animated.View entering={FadeInDown.duration(380).delay(140).springify()} style={{ gap: space.sm }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Focus areas</Text>
              <Text variant="caption">From your history</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm, paddingRight: SCREEN_PAD }}
            >
              {weakTags.map((tag) => (
                <Chip key={tag} label={tag.replace(/_/g, ' ')} onPress={() => startPractice(tag)} />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Last round ── */}
        {lastResult && (
          <Animated.View entering={FadeInDown.duration(380).delay(180).springify()}>
            <View style={styles.lastCard}>
              <View style={styles.lastHeader}>
                <Text style={styles.sectionEyebrow}>LAST ROUND</Text>
                <View style={[
                  styles.outcomePill,
                  { backgroundColor: lastResult.score > 0 ? colors.gainSoft : lastResult.score < 0 ? colors.lossSoft : `${colors.muted}12` },
                ]}>
                  <Text style={[styles.outcomePillText, {
                    color: lastResult.score > 0 ? colors.gain : lastResult.score < 0 ? colors.loss : colors.muted,
                  }]}>
                    {lastResult.score > 0 ? 'Beat bot' : lastResult.score < 0 ? 'Missed' : 'Neutral'}
                  </Text>
                </View>
              </View>
              <Text variant="caption">
                {lastResult.action === 'long' ? '▲ Long' : lastResult.action === 'short' ? '▼ Short' : '— Skip'}
                {lastResult.tags.length > 0 && ` · ${lastResult.tags.slice(0, 2).map((t) => t.replace(/_/g, ' ')).join(', ')}`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Empty state ── */}
        {state.history.length === 0 && (
          <Animated.View entering={FadeInDown.duration(380).delay(200).springify()} style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconGlyph}>◆</Text>
            </View>
            <Text style={styles.emptyTitle}>Your first session awaits</Text>
            <Text style={styles.emptyBody}>
              Make decisions on real historical charts.{'\n'}Skill Rating begins at 500.
            </Text>
          </Animated.View>
        )}

      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: SCREEN_PAD,
    gap: space.xl,
    paddingBottom: 100,
  },

  skeletonWrap: { padding: SCREEN_PAD, gap: space.xl },
  skeletonHeader: { height: 40,  borderRadius: radius.md,  backgroundColor: colors.bg2, opacity: 0.6 },
  skeletonHero:   { height: 200, borderRadius: radius.card, backgroundColor: colors.bg2, opacity: 0.4 },
  skeletonSm:     { height: 60,  borderRadius: radius.md,  backgroundColor: colors.bg2, opacity: 0.3 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: fonts.serif,
    fontSize: 32,
    letterSpacing: -0.5,
    color: colors.text,
  },
  srPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bg2,
  },
  srNum: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  srLevel: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  // Hero card — dark tonal, NO purple gradient
  heroCard: {
    backgroundColor: colors.bg2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
    padding: SCREEN_PAD,
    gap: space.md,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  heroEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.lineChampagne,
  },
  heroEyebrow: {
    fontFamily: fonts.uiMedium,
    fontSize: 9,
    letterSpacing: 2.5,
    color: colors.gold,
  },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 30,
    letterSpacing: -0.3,
    color: colors.text,
    lineHeight: 36,
  },
  heroSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 5,
    marginTop: space.xs,
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
  },
  heroBtn: {
    marginTop: space.xs,
  },

  // Done state
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: `${colors.gain}20`,
    padding: SCREEN_PAD,
  },
  doneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.gain}14`,
    borderWidth: 1,
    borderColor: `${colors.gain}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: colors.gain,
    lineHeight: 18,
  },
  doneTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: colors.gain,
  },
  doneSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.muted,
  },

  // SR row
  srRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  srEyebrow: {
    fontFamily: fonts.uiMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.muted,
  },
  srToNext: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
    opacity: 0.7,
  },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
    gap: 1,
    minWidth: 52,
  },
  streakNum: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    color: colors.gold,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    fontFamily: fonts.ui,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 0.5,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  sectionEyebrow: {
    fontFamily: fonts.uiMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.muted,
  },

  // Last round
  lastCard: {
    backgroundColor: colors.bg1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
  },
  lastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outcomePill: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  outcomePillText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: SCREEN_PAD,
    paddingVertical: space.huge,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.gold}10`,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconGlyph: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.gold,
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
