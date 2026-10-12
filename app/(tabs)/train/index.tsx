import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { Card } from '@/src/ui/components/Card'
import { Chip } from '@/src/ui/components/Chip'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { getLevel } from '@/src/engine/rating'
import { colors, radius, space } from '@/src/ui/theme'
import type { PatternTag } from '@/src/content/types'
import { useAppState } from '@/src/state/useAppState'
import { getWeakTags } from '@/src/state/store'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function SRBar({ sr }: { sr: number }) {
  const pct = (sr / 1000) * 100
  return (
    <View style={srBarStyles.wrap}>
      <View style={srBarStyles.track}>
        <View style={[srBarStyles.fill, { width: `${pct}%` as any }]} />
      </View>
      <Text variant="caption">{Math.round(sr)} / 1000</Text>
    </View>
  )
}
const srBarStyles = StyleSheet.create({
  wrap: { gap: 6 },
  track: { height: 4, backgroundColor: colors.bg2, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.brand, borderRadius: 2 },
})

export default function TrainScreen() {
  const router = useRouter()
  const { state, loading, refresh, dailyNumber, isDailyDone, dailyEpisodeIds, ensureDailyStarted } = useAppState()

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level = getLevel(state.sr)
  const weakTags: PatternTag[] = getWeakTags(state.history)
  const lastResult = state.history[state.history.length - 1]

  const startDaily = async () => {
    const ids = await ensureDailyStarted()
    ;(global as any).__pendingDailyIds = ids
    router.push({
      pathname: '/round',
      params: { episodeId: ids[0], sessionIndex: '0', sessionTotal: String(ids.length) },
    })
  }

  const startPractice = (tag: PatternTag) => {
    const { episodes } = require('@/src/content/episodes')
    const tagged = (episodes as any[]).filter((e: any) => e.tags.includes(tag))
    if (tagged.length === 0) return
    const ep = tagged[Math.floor(Math.random() * tagged.length)]
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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.header}>
          <View>
            <Text variant="caption">{greeting()}</Text>
            <Text variant="display" style={{ fontSize: 34, letterSpacing: -1 }}>Dojo</Text>
          </View>
          {state.streakDays > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text variant="title" style={{ color: colors.warn, fontSize: 18 }}>
                {state.streakDays}
              </Text>
              <Text variant="caption" style={{ color: colors.warn }}>streak</Text>
            </View>
          )}
        </Animated.View>

        {/* SR Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(60).springify()}>
          <Card variant="elevated" style={styles.srCard}>
            <View>
              <Text variant="caption">SKILL RATING</Text>
              <Text variant="numericLarge" style={{ marginTop: 2 }}>
                {Math.round(state.sr)}
              </Text>
              <SRBar sr={state.sr} />
            </View>
            <View style={styles.levelBadge}>
              <Text variant="label" style={{ color: colors.brand, fontSize: 11, letterSpacing: 1 }}>
                LEVEL
              </Text>
              <Text variant="title" style={{ color: colors.brand, fontSize: 22 }}>
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
                <Text style={{ fontSize: 28 }}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="label" style={{ color: colors.gain }}>DAILY #{dailyNumber} COMPLETE</Text>
                  <Text variant="title" style={{ color: colors.muted, fontSize: 15 }}>
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
                <View>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
                    DAILY #{dailyNumber}
                  </Text>
                  <Text variant="title" style={{ color: '#fff', fontSize: 22, marginTop: 4 }}>
                    {dailyEpisodeIds.length} charts · ~3 min
                  </Text>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    Beat the bot. Earn your rating.
                  </Text>
                </View>
                <View style={{ marginTop: space.lg }}>
                  <Pressable style={styles.dailyBtn} onPress={startDaily}>
                    <Text variant="title" style={{ color: colors.brand, fontSize: 15 }}>
                      Start Daily →
                    </Text>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          )}
        </Animated.View>

        {/* Practice by topic */}
        {weakTags.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(180).springify()} style={{ gap: space.md }}>
            <View style={styles.sectionHeader}>
              <Text variant="title" style={{ fontSize: 16 }}>Practice by topic</Text>
              <Text variant="caption">Your weak spots</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}
            >
              {weakTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag.replace('_', ' ')}
                  onPress={() => startPractice(tag)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Last result */}
        {lastResult && (
          <Animated.View entering={FadeInDown.duration(400).delay(240).springify()}>
            <Card style={{ gap: space.sm }}>
              <View style={styles.lastResultHeader}>
                <Text variant="label" style={{ letterSpacing: 0.5 }}>LAST RESULT</Text>
                <Text
                  variant="numeric"
                  style={{
                    color: (lastResult as any).score >= 0 ? colors.gain : colors.loss,
                    fontSize: 18,
                  }}
                >
                  {(lastResult as any).score >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(((lastResult as any).score ?? 0) * 100).toFixed(0)}%
                </Text>
              </View>
              <Text variant="caption">
                {lastResult.action.toUpperCase()} · {lastResult.tags.slice(0, 2).join(', ')}
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* New user empty state */}
        {state.history.length === 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(300).springify()}>
            <Card variant="ghost" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
              <Text style={{ fontSize: 36 }}>📈</Text>
              <Text variant="title" style={{ textAlign: 'center' }}>Start your first Daily</Text>
              <Text variant="body" style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
                Make decisions on real historical charts. Your Skill Rating starts at 500.
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
    gap: 0,
  },
  streakFire: { fontSize: 20 },

  srCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  levelBadge: {
    alignItems: 'flex-end',
    gap: 2,
  },

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
  dailyBtn: {
    backgroundColor: '#fff',
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dailyDoneCard: { borderWidth: 1, borderColor: `${colors.gain}30` },
  dailyDoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastResultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
