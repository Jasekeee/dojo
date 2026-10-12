import { useRouter } from 'expo-router'
import React, { useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
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

const LEVEL_COLORS: Record<string, string> = {
  Rookie: colors.muted,
  Analyst: '#4CC9F0',
  Trader: colors.brand,
  Sniper: '#9CFF57',
  Legend: '#FFB84D',
}

export default function ProfileScreen() {
  const router = useRouter()
  const { state, loading, refresh } = useAppState()

  useFocusEffect(useCallback(() => { refresh() }, [refresh]))

  const level = getLevel(state.sr)
  const levelColor = LEVEL_COLORS[level] ?? colors.brand

  const historyAsRoundResults = state.history.map((h) => ({
    ...h, userReturn: 0, botReturn: 0, srDelta: 0, difficulty: 2 as const,
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

        {/* SR Hero */}
        <Animated.View entering={FadeInDown.duration(350).springify()}>
          <Card variant="elevated" style={styles.srHero}>
            {/* Level badge top right */}
            <View style={[styles.levelBadge, { backgroundColor: `${levelColor}18`, borderColor: `${levelColor}40` }]}>
              <Text variant="caption" style={{ color: levelColor, fontWeight: '700', letterSpacing: 1 }}>
                {level.toUpperCase()}
              </Text>
            </View>

            <Text variant="numericLarge" style={{ fontSize: 56, marginTop: space.md }}>
              {Math.round(state.sr)}
            </Text>
            <Text variant="caption" style={{ marginTop: 4 }}>SKILL RATING</Text>

            {/* SR progress bar */}
            <View style={styles.srBarWrap}>
              <View style={styles.srBarTrack}>
                <View style={[styles.srBarFill, { width: `${(state.sr / 1000) * 100}%` as any, backgroundColor: levelColor }]} />
              </View>
              <Text variant="caption" style={{ color: levelColor }}>{Math.round(state.sr)} / 1000</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="numericLarge" style={{ fontSize: 24 }}>{totalRounds}</Text>
                <Text variant="caption">rounds</Text>
              </View>
              {state.streakDays > 0 && (
                <View style={styles.statItem}>
                  <Text variant="numericLarge" style={{ fontSize: 24, color: colors.warn }}>
                    🔥 {state.streakDays}
                  </Text>
                  <Text variant="caption">day streak</Text>
                </View>
              )}
            </View>
          </Card>
        </Animated.View>

        {/* Behaviour metrics */}
        {totalRounds >= 3 && (
          <Animated.View entering={FadeInDown.duration(350).delay(80).springify()}>
            <Card style={{ gap: space.lg }}>
              <Text variant="label" style={{ letterSpacing: 1 }}>BEHAVIOUR</Text>
              <MetricBar label="Discipline" value={metrics.disciplinePct} desc="Buys with a stop set" />
              <MetricBar label="Selectivity" value={metrics.selectivityPct} desc="SKIPs that avoided a bot loss" />
              <MetricBar label="Anti-FOMO" value={100 - metrics.fomoPct} desc="Entries not after a pump" />
            </Card>
          </Animated.View>
        )}

        {/* Empty state */}
        {totalRounds === 0 && (
          <Animated.View entering={FadeInDown.duration(350).delay(80).springify()}>
            <Card variant="ghost" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
              <Text style={{ fontSize: 40 }}>📊</Text>
              <Text variant="title" style={{ textAlign: 'center' }}>No rounds yet</Text>
              <Text variant="body" style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
                Complete a Daily to see your behaviour metrics.
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* Recent history */}
        {totalRounds > 0 && (
          <Animated.View entering={FadeInDown.duration(350).delay(160).springify()} style={{ gap: space.md }}>
            <Text variant="label" style={{ letterSpacing: 1 }}>RECENT HISTORY</Text>
            {state.history.slice(-8).reverse().map((r, i) => (
              <Card key={`${r.episodeId}-${i}`} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <View style={[
                    styles.actionBadge,
                    { backgroundColor: r.action === 'buy' ? `${colors.brand}20` : `${colors.muted}15` }
                  ]}>
                    <Text variant="caption" style={{
                      color: r.action === 'buy' ? colors.brand : colors.muted,
                      fontWeight: '700', fontSize: 10, letterSpacing: 0.5,
                    }}>
                      {r.action.toUpperCase()}
                    </Text>
                  </View>
                  <Text variant="caption">{r.tags.slice(0, 2).join(', ')}</Text>
                </View>
                <Text
                  variant="numeric"
                  style={{ color: r.score >= 0 ? colors.gain : colors.loss, fontSize: 16 }}
                >
                  {r.score >= 0 ? '+' : ''}{(r.score * 100).toFixed(0)}%
                </Text>
              </Card>
            ))}
          </Animated.View>
        )}

        {/* Certify */}
        <Animated.View entering={FadeInDown.duration(350).delay(240).springify()}>
          <Card variant="accent" style={{ gap: space.md }}>
            <View style={styles.certifyHeader}>
              <Text style={{ fontSize: 28 }}>⛓️</Text>
              <View style={{ flex: 1 }}>
                <Text variant="title">Certify on Solana</Text>
                <Text variant="caption" style={{ marginTop: 2 }}>
                  Write your SR to the blockchain
                </Text>
              </View>
            </View>
            <Text variant="body" style={{ color: colors.muted, fontSize: 14 }}>
              A Memo transaction links your wallet to your Dojo record. Verifiable proof of your training.
            </Text>
            <PrimaryButton label="Certify rating →" onPress={() => router.push('/certify' as any)} />
          </Card>
        </Animated.View>

        <Text variant="caption" style={styles.disclaimer}>
          Educational simulation. Not financial advice.{'\n'}Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

function MetricBar({ label, value, desc }: { label: string; value: number; desc: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const color = pct >= 70 ? colors.gain : pct >= 40 ? colors.warn : colors.loss

  return (
    <View style={{ gap: space.xs }}>
      <View style={mStyles.row}>
        <Text variant="body" style={{ fontWeight: '600', fontSize: 15 }}>{label}</Text>
        <Text variant="numeric" style={{ color, fontSize: 17 }}>{Math.round(pct)}%</Text>
      </View>
      <View style={mStyles.track}>
        <View style={[mStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text variant="caption" style={{ fontSize: 12 }}>{desc}</Text>
    </View>
  )
}

const mStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
})

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },

  srHero: { gap: space.sm },
  levelBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.chip,
    paddingVertical: 4,
    paddingHorizontal: space.md,
    borderWidth: 1,
  },
  srBarWrap: { gap: 6, marginTop: space.sm },
  srBarTrack: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  srBarFill: { height: 6, borderRadius: 3 },
  statsRow: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  statItem: { gap: 2 },

  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actionBadge: {
    borderRadius: radius.chip,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
  },

  certifyHeader: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  disclaimer: { textAlign: 'center', marginTop: space.md },
})
