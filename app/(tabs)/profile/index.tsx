import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { getLevel } from '@/src/engine/rating'
import { computeBehaviourMetrics } from '@/src/engine/insights'
import { useAppState } from '@/src/state/useAppState'
import { colors, radius, space } from '@/src/ui/theme'
import type { RoundResult } from '@/src/state/store'

export default function ProfileScreen() {
  const router = useRouter()
  const { state, loading, refresh } = useAppState()

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level = getLevel(state.sr)

  const historyAsRoundResults = state.history.map((h) => ({
    ...h,
    userReturn: 0,
    botReturn: 0,
    srDelta: 0,
    difficulty: 2 as const,
  })) as RoundResult[]

  const metrics = computeBehaviourMetrics(historyAsRoundResults)
  const totalRounds = state.history.length

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
        <Text variant="display" style={{ fontSize: 28 }}>Profile</Text>

        {/* SR card */}
        <Card style={styles.srCard}>
          <View>
            <Text variant="label">Skill Rating</Text>
            <Text variant="display" style={{ fontSize: 48 }}>{Math.round(state.sr)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: space.sm }}>
            <View style={styles.levelBadge}>
              <Text variant="title" style={{ color: colors.brand }}>{level}</Text>
            </View>
            <Text variant="label">{totalRounds} rounds played</Text>
            {state.streakDays > 0 && (
              <Text variant="label" style={{ color: colors.gain }}>
                {state.streakDays}-day streak
              </Text>
            )}
          </View>
        </Card>

        {/* Behaviour metrics */}
        {totalRounds >= 3 && (
          <>
            <Text variant="title" style={styles.sectionTitle}>Behaviour</Text>
            <Card style={{ gap: space.md }}>
              <MetricRow
                label="Discipline"
                value={metrics.disciplinePct}
                description="Buys with a stop set"
              />
              <View style={styles.divider} />
              <MetricRow
                label="Selectivity"
                value={metrics.selectivityPct}
                description="SKIPs that avoided a bot loss"
              />
              <View style={styles.divider} />
              <MetricRow
                label="Anti-FOMO"
                value={100 - metrics.fomoPct}
                description="Buys not after a pump"
              />
            </Card>
          </>
        )}

        {totalRounds === 0 && (
          <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
            <Text variant="title">No rounds yet</Text>
            <Text variant="body" style={{ color: colors.muted, textAlign: 'center' }}>
              Complete a Daily or Time Machine session to see your stats.
            </Text>
          </Card>
        )}

        {/* Recent history */}
        {totalRounds > 0 && (
          <>
            <Text variant="title" style={styles.sectionTitle}>Recent history</Text>
            {state.history
              .slice(-10)
              .reverse()
              .map((r, i) => (
                <Card key={i} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{r.tags.join(', ')}</Text>
                    <Text variant="body" style={{ color: colors.muted, fontSize: 12 }}>
                      {r.action.toUpperCase()} · {r.dateISO}
                    </Text>
                  </View>
                  <Text
                    variant="numeric"
                    style={{ color: r.score >= 0 ? colors.gain : colors.loss }}
                  >
                    {r.score >= 0 ? '+' : ''}
                    {(r.score * 100).toFixed(0)}%
                  </Text>
                </Card>
              ))}
          </>
        )}

        {/* Certify */}
        <Text variant="title" style={styles.sectionTitle}>Certify on Solana</Text>
        <Card style={{ gap: space.md }}>
          <Text variant="body" style={{ color: colors.muted }}>
            Write your Skill Rating to Solana as a Memo transaction. Verifiable proof of your training record.
          </Text>
          <PrimaryButton
            label="Certify Rating"
            onPress={() => router.push('/certify' as any)}
          />
        </Card>

        <Text variant="label" style={styles.disclaimer}>
          Educational simulation. Not financial advice.{'\n'}Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

function MetricRow({ label, value, description }: { label: string; value: number; description: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct >= 70 ? colors.gain : pct >= 40 ? colors.warn : colors.loss
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.metricHeader}>
        <Text variant="label">{label}</Text>
        <Text variant="numeric" style={{ color, fontSize: 16 }}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text variant="label" style={{ color: colors.muted, fontSize: 11 }}>{description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  srCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  levelBadge: {
    backgroundColor: colors.bg2,
    borderRadius: radius.chip,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  sectionTitle: { marginBottom: -space.sm },
  divider: { height: 1, backgroundColor: colors.line },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barBg: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  disclaimer: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: space.md,
  },
})
