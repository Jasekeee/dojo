import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Card } from '@/src/ui/components/Card'
import { Chip } from '@/src/ui/components/Chip'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { getLevel } from '@/src/engine/rating'
import { colors, radius, space } from '@/src/ui/theme'
import type { PatternTag } from '@/src/content/types'

// Mock data for the Phase 2 skeleton — wired to real state/engine in Phase 3-4.
const MOCK = {
  streakDays: 5,
  sr: 612,
  dailyNumber: 42,
  lastResult: { score: 0.42, srDelta: 14 },
  weakTags: ['fakeout', 'pump_dump', 'slow_bleed'] as PatternTag[],
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function TrainScreen() {
  const router = useRouter()
  const level = getLevel(MOCK.sr)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text variant="label">{greeting()}</Text>
            <Text variant="display">Dojo</Text>
          </View>
          <Card style={styles.streakBadge}>
            <Text variant="numeric" style={{ fontSize: 16 }}>
              {MOCK.streakDays}
            </Text>
            <Text variant="label">day streak</Text>
          </Card>
        </View>

        <Card style={styles.srCard}>
          <View>
            <Text variant="label">Skill Rating</Text>
            <Text variant="display" style={{ fontSize: 40 }}>
              {MOCK.sr}
            </Text>
          </View>
          <View style={styles.levelBadge}>
            <Text variant="title" style={{ color: colors.brand }}>
              {level}
            </Text>
          </View>
        </Card>

        <LinearGradient
          colors={[colors.brand, '#5B2FD6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dailyCard}
        >
          <Text variant="label" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Daily #{MOCK.dailyNumber}
          </Text>
          <Text variant="title" style={{ color: colors.text, fontSize: 24 }}>
            10 charts · ~3 min
          </Text>
          <View style={{ marginTop: space.md }}>
            <PrimaryButton label="Start Daily" onPress={() => router.push('/round')} />
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text variant="title">Practice by topic</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {MOCK.weakTags.map((tag) => (
            <Chip key={tag} label={tag.replace('_', ' ')} />
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text variant="title">Last result</Text>
        </View>
        <Card style={styles.resultCard}>
          <View>
            <Text variant="label">Score</Text>
            <Text variant="numeric">{(MOCK.lastResult.score * 100).toFixed(0)}%</Text>
          </View>
          <View>
            <Text variant="label">SR change</Text>
            <Text variant="numeric" style={{ color: MOCK.lastResult.srDelta >= 0 ? colors.gain : colors.loss }}>
              {MOCK.lastResult.srDelta >= 0 ? '+' : ''}
              {MOCK.lastResult.srDelta}
            </Text>
          </View>
        </Card>
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
