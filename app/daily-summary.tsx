import { useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { completeDailySession, loadState, type AppState } from '@/src/state/store'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, radius, space } from '@/src/ui/theme'
import { getLevel } from '@/src/engine/rating'

const LEVEL_COLORS: Record<string, string> = {
  Rookie: colors.muted,
  Analyst: '#4CC9F0',
  Trader: colors.brand,
  Sniper: '#9CFF57',
  Legend: '#FFB84D',
}

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

  const results = state.history.slice(-10)
  const wins = results.filter((r) => (r.score ?? 0) > 0).length
  const srNow = state.sr
  const level = getLevel(srNow)
  const levelColor = LEVEL_COLORS[level] ?? colors.brand

  const winPct = results.length > 0 ? Math.round((wins / results.length) * 100) : 0
  const trophy = wins >= 8 ? '🏆' : wins >= 5 ? '📈' : '📉'

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(350).springify()} style={styles.hero}>
          <Text style={styles.heroEmoji}>{trophy}</Text>
          <Text variant="display" style={styles.heroScore}>
            {wins}/{results.length}
          </Text>
          <Text variant="caption" style={{ letterSpacing: 1.5 }}>WINS TODAY</Text>
          {state.streakDays > 0 && (
            <View style={styles.streakRow}>
              <Text style={{ fontSize: 16 }}>🔥</Text>
              <Text variant="label" style={{ color: colors.warn }}>
                {state.streakDays} day streak
              </Text>
            </View>
          )}
        </Animated.View>

        {/* SR Card */}
        <Animated.View entering={FadeInDown.duration(350).delay(80).springify()}>
          <Card variant="elevated" style={styles.srCard}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ letterSpacing: 1 }}>SKILL RATING</Text>
              <Text variant="numericLarge" style={{ fontSize: 48, marginTop: 4 }}>
                {Math.round(srNow)}
              </Text>
              <View style={styles.srBarTrack}>
                <View
                  style={[styles.srBarFill, {
                    width: `${(srNow / 1000) * 100}%` as any,
                    backgroundColor: levelColor,
                  }]}
                />
              </View>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: `${levelColor}18`, borderColor: `${levelColor}40` }]}>
              <Text variant="caption" style={{ color: levelColor, fontWeight: '700', letterSpacing: 1 }}>
                {level.toUpperCase()}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Win rate bar */}
        <Animated.View entering={FadeInDown.duration(350).delay(140).springify()}>
          <Card style={{ gap: space.md }}>
            <View style={styles.metricRow}>
              <Text variant="label">Win rate</Text>
              <Text
                variant="numeric"
                style={{ color: winPct >= 60 ? colors.gain : winPct >= 40 ? colors.warn : colors.loss, fontSize: 18 }}
              >
                {winPct}%
              </Text>
            </View>
            <View style={styles.winBarTrack}>
              <View style={[styles.winBarFill, {
                width: `${winPct}%` as any,
                backgroundColor: winPct >= 60 ? colors.gain : winPct >= 40 ? colors.warn : colors.loss,
              }]} />
            </View>
          </Card>
        </Animated.View>

        {/* Round results */}
        <Animated.View entering={FadeInDown.duration(350).delay(200).springify()} style={{ gap: space.md }}>
          <Text variant="label" style={{ letterSpacing: 1 }}>RESULTS</Text>
          {results.map((r, i) => {
            const score = r.score ?? 0
            const isWin = score > 0
            return (
              <Card key={`${r.episodeId}-${i}`} style={styles.roundRow}>
                <View style={styles.roundLeft}>
                  <View style={[
                    styles.roundNumBadge,
                    { backgroundColor: isWin ? `${colors.gain}15` : `${colors.loss}15` }
                  ]}>
                    <Text
                      variant="caption"
                      style={{ color: isWin ? colors.gain : colors.loss, fontWeight: '700', fontSize: 11 }}
                    >
                      #{i + 1}
                    </Text>
                  </View>
                  <View>
                    <Text variant="label" style={{ fontSize: 13 }}>
                      {r.action.toUpperCase()}
                    </Text>
                    <Text variant="caption" style={{ marginTop: 1 }}>
                      {r.tags.slice(0, 2).join(', ')}
                    </Text>
                  </View>
                </View>
                <Text
                  variant="numeric"
                  style={{ color: isWin ? colors.gain : colors.loss, fontSize: 16 }}
                >
                  {isWin ? '+' : ''}{(score * 100).toFixed(0)}%
                </Text>
              </Card>
            )
          })}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.duration(350).delay(260).springify()}>
          <PrimaryButton
            label="Back to home"
            onPress={() => router.replace('/(tabs)/train')}
          />
        </Animated.View>

        <Text variant="caption" style={styles.disclaimer}>
          Educational simulation. Not financial advice.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },

  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  heroEmoji: { fontSize: 56, marginBottom: space.xs },
  heroScore: { fontSize: 56, letterSpacing: -2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },

  srCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  srBarTrack: { height: 4, backgroundColor: colors.bg2, borderRadius: 2, overflow: 'hidden', marginTop: space.sm },
  srBarFill: { height: 4, borderRadius: 2 },
  levelBadge: {
    borderRadius: radius.chip,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderWidth: 1,
  },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  winBarTrack: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  winBarFill: { height: 6, borderRadius: 3 },

  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  roundLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  roundNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disclaimer: { textAlign: 'center', color: colors.muted },
})
