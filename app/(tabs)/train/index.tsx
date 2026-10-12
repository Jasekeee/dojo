import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { Card } from '@/src/ui/components/Card'
import { Chip } from '@/src/ui/components/Chip'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { SRBar } from '@/src/ui/components/SRBar'
import { getLevel } from '@/src/engine/rating'
import { episodes } from '@/src/content/episodes'
import { colors, levelColors, radius, space } from '@/src/ui/theme'
import { haptics } from '@/src/ui/haptics'
import type { PatternTag } from '@/src/content/types'
import { useAppState } from '@/src/state/useAppState'
import { getWeakTags } from '@/src/state/store'

export default function TrainScreen() {
  const router = useRouter()
  const { state, loading, refresh, dailyNumber, isDailyDone, dailyEpisodeIds, ensureDailyStarted } = useAppState()
  const [starting, setStarting] = useState(false)
  const startGuard = useRef(false)

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level      = getLevel(state.sr)
  const levelColor = levelColors[level]
  const weakTags: PatternTag[] = getWeakTags(state.history)
  const lastResult = state.history[state.history.length - 1]

  const startDaily = async () => {
    if (startGuard.current) return
    startGuard.current = true
    setStarting(true)
    haptics.confirm()
    try {
      const ids = await ensureDailyStarted()
      ;(global as any).__pendingDailyIds = ids
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
        {/* Header — wordmark + streak */}
        <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.header}>
          <View>
            <Text variant="caption" style={{ letterSpacing: 2, color: colors.muted }}>
              DAILY #{dailyNumber}
            </Text>
            <Text variant="display" style={{ fontSize: 34, letterSpacing: -1 }}>Dojo</Text>
          </View>
          {state.streakDays > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakNum}>{state.streakDays}</Text>
              <Text variant="caption" style={{ color: colors.warn, fontSize: 10 }}>day streak</Text>
            </View>
          )}
        </Animated.View>

        {/* SR Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(60).springify()}>
          <Card variant="elevated" style={styles.srCard}>
            <View style={{ flex: 1, gap: space.sm }}>
              <Text variant="caption" style={{ letterSpacing: 1 }}>SKILL RATING</Text>
              <Text variant="numericLarge" style={{ marginTop: 0 }}>
                {Math.round(state.sr)}
              </Text>
              <SRBar sr={state.sr} />
            </View>
            <View style={styles.levelBadge}>
              <Text
                variant="label"
                style={{ color: levelColor, fontSize: 11, letterSpacing: 1 }}
              >
                LEVEL
              </Text>
              <Text
                variant="title"
                style={{ color: levelColor, fontSize: 22 }}
              >
                {level}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Daily Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(120).springify()}>
          {isDailyDone ? (
            <Card variant="ghost" style={styles.dailyDoneCard}>
              <View style={styles.dailyDoneRow}>
                <View style={styles.doneMark}>
                  <Text style={styles.doneCheck}>✓</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" style={{ color: colors.gain, letterSpacing: 0.5 }}>
                    DAILY #{dailyNumber} COMPLETE
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    Come back tomorrow for your next set
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            <LinearGradient
              colors={['#6B3FE7', '#8B5CFF', '#A67DFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dailyCard}
            >
              <View style={styles.dailyCardInner}>
                <View style={{ gap: 4 }}>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
                    TODAY
                  </Text>
                  <Text variant="title" style={{ color: '#fff', fontSize: 22 }}>
                    {dailyEpisodeIds.length} charts · ~3 min
                  </Text>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Beat the bot. Earn your rating.
                  </Text>
                </View>
                <View style={{ marginTop: space.lg }}>
                  <PrimaryButton
                    label={starting ? 'Loading…' : 'Start Daily →'}
                    onPress={startDaily}
                    disabled={starting}
                    style={styles.dailyBtn}
                  />
                </View>
              </View>
            </LinearGradient>
          )}
        </Animated.View>

        {/* Practice by topic */}
        {weakTags.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(180).springify()} style={{ gap: space.md }}>
            <View style={styles.sectionHeader}>
              <Text variant="title" style={{ fontSize: 16 }}>Focus areas</Text>
              <Text variant="caption">Based on your history</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}
            >
              {weakTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag.replace(/_/g, ' ')}
                  onPress={() => startPractice(tag)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Last result — action + beat/missed */}
        {lastResult && (
          <Animated.View entering={FadeInDown.duration(400).delay(240).springify()}>
            <Card style={{ gap: space.sm }}>
              <View style={styles.lastResultHeader}>
                <Text variant="label" style={{ letterSpacing: 0.5 }}>LAST ROUND</Text>
                <View style={[
                  styles.resultOutcomePill,
                  { backgroundColor: lastResult.score > 0 ? `${colors.gain}18` : lastResult.score < 0 ? `${colors.loss}18` : `${colors.muted}18` },
                ]}>
                  <Text style={{
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 12,
                    color: lastResult.score > 0 ? colors.gain : lastResult.score < 0 ? colors.loss : colors.muted,
                    letterSpacing: 0.3,
                  }}>
                    {lastResult.score > 0 ? 'Beat bot' : lastResult.score < 0 ? 'Missed' : 'Neutral'}
                  </Text>
                </View>
              </View>
              <Text variant="caption" style={{ color: colors.muted }}>
                {lastResult.action.toUpperCase()}
                {lastResult.tags.length > 0 && ` · ${lastResult.tags.slice(0, 2).map((t) => t.replace(/_/g, ' ')).join(', ')}`}
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* Empty state — new user */}
        {state.history.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(300).springify()}>
            <Card variant="ghost" style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>◆</Text>
              </View>
              <Text variant="title" style={{ textAlign: 'center' }}>Start your first Daily</Text>
              <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                Make decisions on real historical charts.{'\n'}Your Skill Rating starts at 500.
              </Text>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: `${colors.warn}15`,
    borderRadius: radius.card,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: `${colors.warn}30`,
  },
  streakNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.warn,
    lineHeight: 26,
  },

  srCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md },
  levelBadge: { alignItems: 'flex-end', gap: 2 },

  dailyCard: {
    borderRadius: radius.card,
    overflow: 'hidden',
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  dailyCardInner: { padding: space.lg },
  dailyBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)' },

  dailyDoneCard: { borderWidth: 1, borderColor: `${colors.gain}30` },
  dailyDoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  doneMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.gain}18`,
    borderWidth: 1,
    borderColor: `${colors.gain}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: colors.gain,
    lineHeight: 18,
  },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastResultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultOutcomePill: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },

  emptyCard: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.brand}18`,
    borderWidth: 1,
    borderColor: `${colors.brand}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.brand,
  },
})
