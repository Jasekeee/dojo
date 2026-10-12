import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
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

export default function TrainScreen() {
  const router = useRouter()
  const { state, loading, refresh, dailyNumber, isDailyDone, dailyEpisodeIds, ensureDailyStarted } = useAppState()

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level = getLevel(state.sr)
  const weakTags: PatternTag[] = getWeakTags(state.history)

  const startDaily = async () => {
    const ids = await ensureDailyStarted()
    // Store the episode IDs globally so round.tsx can look up the next one.
    ;(global as any).__pendingDailyIds = ids
    router.push({
      pathname: '/round',
      params: {
        episodeId: ids[0],
        sessionIndex: '0',
        sessionTotal: String(ids.length),
      },
    })
  }

  const startPractice = (tag: PatternTag) => {
    const { episodes } = require('@/src/content/episodes')
    const tagged = (episodes as any[]).filter((e: any) => e.tags.includes(tag))
    if (tagged.length === 0) return
    const ep = tagged[Math.floor(Math.random() * tagged.length)]
    router.push({ pathname: '/round', params: { episodeId: ep.id } })
  }

  const lastResult = state.history[state.history.length - 1]

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text variant="label">{greeting()}</Text>
            <Text variant="display">Dojo</Text>
          </View>
          {state.streakDays > 0 && (
            <Card style={styles.streakBadge}>
              <Text variant="numeric" style={{ fontSize: 16 }}>
                {state.streakDays}
              </Text>
              <Text variant="label">day streak</Text>
            </Card>
          )}
        </View>

        <Card style={styles.srCard}>
          <View>
            <Text variant="label">Skill Rating</Text>
            <Text variant="display" style={{ fontSize: 40 }}>
              {Math.round(state.sr)}
            </Text>
          </View>
          <View style={styles.levelBadge}>
            <Text variant="title" style={{ color: colors.brand }}>
              {level}
            </Text>
          </View>
        </Card>

        <LinearGradient
          colors={isDailyDone ? [colors.bg2, colors.bg2] : [colors.brand, '#5B2FD6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dailyCard}
        >
          <Text variant="label" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Daily #{dailyNumber}
          </Text>
          <Text variant="title" style={{ color: colors.text, fontSize: 24 }}>
            {isDailyDone ? 'Completed today ✓' : `${dailyEpisodeIds.length} charts · ~3 min`}
          </Text>
          {!isDailyDone && (
            <View style={{ marginTop: space.md }}>
              <PrimaryButton label="Start Daily" onPress={startDaily} />
            </View>
          )}
        </LinearGradient>

        {weakTags.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text variant="title">Practice by topic</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
            >
              {weakTags.map((tag) => (
                <Chip key={tag} label={tag.replace('_', ' ')} onPress={() => startPractice(tag)} />
              ))}
            </ScrollView>
          </>
        )}

        {lastResult && (
          <>
            <View style={styles.sectionHeader}>
              <Text variant="title">Last result</Text>
            </View>
            <Card style={styles.resultCard}>
              <View>
                <Text variant="label">Score</Text>
                <Text variant="numeric">{(((lastResult as any).score ?? 0) * 100).toFixed(0)}%</Text>
              </View>
              <View>
                <Text variant="label">Action</Text>
                <Text variant="numeric" style={{ textTransform: 'uppercase' }}>
                  {(lastResult as any).action ?? '—'}
                </Text>
              </View>
              <View>
                <Text variant="label">Tags</Text>
                <Text variant="label" style={{ color: colors.muted }}>
                  {lastResult.tags.join(', ')}
                </Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  streakBadge: { alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: space.md },
  srCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelBadge: {
    backgroundColor: colors.bg2,
    borderRadius: radius.chip,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  dailyCard: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
  sectionHeader: { marginTop: space.sm },
  resultCard: { flexDirection: 'row', gap: space.xl },
})
