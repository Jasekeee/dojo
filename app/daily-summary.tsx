import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { completeDailySession, loadState, type AppState } from '@/src/state/store'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, space } from '@/src/ui/theme'
import { getLevel } from '@/src/engine/rating'

export default function DailySummaryScreen() {
  const router = useRouter()
  const [state, setState] = useState<AppState | null>(null)

  useEffect(() => {
    completeDailySession().then((s) => {
      setState(s)
      haptics.streakMilestone()
    })
  }, [])

  if (!state) return null

  const daily = (state as any)._completedDaily
  const results = state.history.slice(-10)
  const wins = results.filter((r) => ((r as any).score ?? 0) > 0).length

  // Reload after completion to get completed state
  const completedResults = state.history.slice(-10)
  const srNow = state.sr
  const level = getLevel(srNow)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="label" style={{ color: colors.brand }}>Daily complete</Text>
          <Text variant="display" style={{ fontSize: 36 }}>
            {wins}/10 wins
          </Text>
          <Text variant="body" style={{ color: colors.muted }}>
            Streak: {state.streakDays} day{state.streakDays !== 1 ? 's' : ''}
          </Text>
        </View>

        <Card style={styles.srCard}>
          <View>
            <Text variant="label">Skill Rating</Text>
            <Text variant="display" style={{ fontSize: 40 }}>{Math.round(srNow)}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text variant="title" style={{ color: colors.brand }}>{level}</Text>
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <Text variant="title">Round results</Text>
        </View>
        {completedResults.map((r, i) => (
          <Card key={i} style={styles.roundRow}>
            <Text variant="label" style={{ flex: 1 }}>
              #{i + 1} {(r as any).action?.toUpperCase() ?? '—'}
            </Text>
            <Text
              variant="numeric"
              style={{ color: ((r as any).score ?? 0) >= 0 ? colors.gain : colors.loss }}
            >
              {((r as any).score ?? 0) >= 0 ? '+' : ''}
              {((((r as any).score ?? 0)) * 100).toFixed(0)}%
            </Text>
          </Card>
        ))}

        <View style={{ marginTop: space.lg }}>
          <PrimaryButton
            label="Back to home"
            onPress={() => router.replace('/(tabs)/train')}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  header: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  srCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelBadge: {
    backgroundColor: colors.bg2,
    borderRadius: 999,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  sectionHeader: { marginTop: space.sm },
  roundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
