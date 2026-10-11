import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { CandleChart } from '@/src/chart/CandleChart'
import { episodes } from '@/src/content/episodes'
import type { Episode } from '@/src/content/types'
import { applySrDelta, getLevel, SR_START } from '@/src/engine/rating'
import { computeScore } from '@/src/engine/score'
import { simulateTrade, skipReturn, type SimResult } from '@/src/engine/sim'
import { Card } from '@/src/ui/components/Card'
import { type Decision, DecisionSheet } from '@/src/ui/components/DecisionSheet'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, space } from '@/src/ui/theme'

type Phase = 'deciding' | 'revealing' | 'result'

const CHART_WIDTH = Dimensions.get('window').width - space.lg * 2
const CHART_HEIGHT = 280
const REVEAL_INTERVAL_MS = 50

function pickRandomEpisode(): Episode {
  return episodes[Math.floor(Math.random() * episodes.length)]
}

export default function RoundScreen() {
  const router = useRouter()
  const [episode] = useState<Episode>(pickRandomEpisode)
  const [phase, setPhase] = useState<Phase>('deciding')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [revealCount, setRevealCount] = useState(episode.before.length)
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const entry = episode.before[episode.before.length - 1][4]
  const userReturn = decision?.action === 'skip' ? skipReturn() : (simResult?.returnOnEquity ?? 0)
  const score = computeScore(userReturn, episode.baselines.bot_return)
  const srAfter = applySrDelta(SR_START, score, episode.difficulty)
  const srDelta = Math.round(srAfter - SR_START)

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current)
    }
  }, [])

  const onDecide = (d: Decision) => {
    setDecision(d)
    const result =
      d.action === 'buy'
        ? simulateTrade({ entry, size: d.size, stopPct: d.stopPct, targetPct: d.targetPct, afterCandles: episode.after })
        : null
    setSimResult(result)
    setPhase('revealing')

    const total = episode.before.length + episode.after.length
    revealTimer.current = setInterval(() => {
      setRevealCount((prev) => {
        const next = prev + 1
        if (next >= total) {
          if (revealTimer.current) clearInterval(revealTimer.current)
          const finalReturn = d.action === 'skip' ? 0 : (result?.returnOnEquity ?? 0)
          if (finalReturn > 0) haptics.win()
          else if (finalReturn < 0) haptics.loss()
        }
        return next
      })
    }, REVEAL_INTERVAL_MS)
  }

  const allCandles = [...episode.before, ...episode.after]
  const stopPrice = decision?.stopPct !== undefined ? entry * (1 - decision.stopPct) : undefined
  const targetPrice = decision?.targetPct !== undefined ? entry * (1 + decision.targetPct) : undefined
  const revealDone = revealCount >= allCandles.length

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text variant="label">{episode.timeframe.toUpperCase()}</Text>
        <Text variant="numeric">1000 training USDC</Text>
      </View>

      <View style={styles.chartWrap}>
        <CandleChart
          candles={phase === 'deciding' ? episode.before : allCandles}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          splitIndex={phase === 'deciding' ? undefined : episode.before.length}
          revealCount={phase === 'deciding' ? episode.before.length : revealCount}
          referenceLines={
            phase !== 'deciding' && decision?.action === 'buy'
              ? { entry, stop: stopPrice, target: targetPrice }
              : undefined
          }
        />
      </View>

      {phase === 'deciding' && <DecisionSheet onDecide={onDecide} />}

      {phase === 'revealing' && revealDone && (
        <Card style={{ gap: space.sm }}>
          <Text variant="title">
            {episode.asset.symbol === episode.asset.name
              ? episode.asset.symbol
              : `${episode.asset.symbol} · ${episode.asset.name}`}
          </Text>
          <Text variant="numeric" style={{ color: userReturn >= 0 ? colors.gain : colors.loss, fontSize: 28 }}>
            {userReturn >= 0 ? '+' : ''}
            {(userReturn * 100).toFixed(1)}%
          </Text>
          <PrimaryButton label="See result" onPress={() => setPhase('result')} />
        </Card>
      )}

      {phase === 'result' && (
        <Card style={{ gap: space.md }}>
          <Text variant="title">Result</Text>
          <View style={styles.resultRow}>
            <View>
              <Text variant="label">Score</Text>
              <Text variant="numeric">{(score * 100).toFixed(0)}%</Text>
            </View>
            <View>
              <Text variant="label">SR change</Text>
              <Text variant="numeric" style={{ color: srDelta >= 0 ? colors.gain : colors.loss }}>
                {srDelta >= 0 ? '+' : ''}
                {srDelta}
              </Text>
            </View>
            <View>
              <Text variant="label">Level</Text>
              <Text variant="numeric">{getLevel(srAfter)}</Text>
            </View>
          </View>
          <View style={styles.resultRow}>
            <View>
              <Text variant="label">You</Text>
              <Text variant="numeric">{(userReturn * 100).toFixed(1)}%</Text>
            </View>
            <View>
              <Text variant="label">Bot</Text>
              <Text variant="numeric">{(episode.baselines.bot_return * 100).toFixed(1)}%</Text>
            </View>
            <View>
              <Text variant="label">Hold</Text>
              <Text variant="numeric">{(episode.baselines.hold_return * 100).toFixed(1)}%</Text>
            </View>
          </View>
          <PrimaryButton label="Done" onPress={() => router.back()} />
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  chartWrap: { paddingHorizontal: space.lg, marginBottom: space.lg },
  resultRow: { flexDirection: 'row', gap: space.xl },
})
