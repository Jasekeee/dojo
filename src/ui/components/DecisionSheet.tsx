// Compact decision panel. Default shows ONLY entry + Long/Short + Skip.
// "Adjust" expands size/stop/target. No orange boxes.
import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { SegmentedChips } from '@/src/ui/components/SegmentedChips'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs, timings } from '@/src/ui/motion'
import { COST_ROUND_TRIP } from '@/src/engine/sim'
import { colors, fonts, radius, space, SCREEN_PAD } from '@/src/ui/theme'

export interface Decision {
  action: 'long' | 'short' | 'skip'
  size: number
  stopPct?: number
  targetPct?: number
}

const SIZE_OPTIONS = [
  { label: '25%', value: '0.25' },
  { label: '50%', value: '0.5' },
  { label: '100%', value: '1' },
]
const STOP_OPTIONS = [
  { label: '−10%', value: '0.1' },
  { label: '−20%', value: '0.2' },
  { label: '−30%', value: '0.3' },
  { label: 'None',  value: 'none' },
]
const TARGET_OPTIONS = [
  { label: '+25%', value: '0.25' },
  { label: '+50%', value: '0.5' },
  { label: '+100%', value: '1' },
  { label: 'None',  value: 'none' },
]

function formatPrice(p: number): string {
  if (p >= 10000) return `$${Math.round(p).toLocaleString()}`
  if (p >= 1000)  return `$${p.toFixed(0)}`
  if (p >= 10)    return `$${p.toFixed(2)}`
  return `$${p.toFixed(4)}`
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function DecisionSheet({
  onDecide,
  entryPrice,
  assetSymbol,
}: {
  onDecide: (decision: Decision) => void
  entryPrice?: number
  assetSymbol?: string
}) {
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [size,   setSize]   = useState('0.5')
  const [stop,   setStop]   = useState('0.2')
  const [target, setTarget] = useState('0.5')
  const [expanded, setExpanded] = useState(false)
  const submitting = useRef(false)
  const skipAnim   = useSharedValue(0)

  useEffect(() => () => { submitting.current = false }, [])

  const toggleExpand = () => {
    haptics.select()
    setExpanded((v) => !v)
  }

  const skipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(skipAnim.value ? 0.97 : 1, springs.snappy) }],
  }))

  const sizeNum   = parseFloat(size)
  const stopNum   = stop   === 'none' ? undefined : parseFloat(stop)
  const targetNum = target === 'none' ? undefined : parseFloat(target)
  const maxLoss   = stopNum   !== undefined ? sizeNum * (stopNum   + COST_ROUND_TRIP) : undefined
  const maxGain   = targetNum !== undefined ? sizeNum * (targetNum - COST_ROUND_TRIP) : undefined
  const rrRatio   = maxLoss && maxGain && maxLoss > 0 ? maxGain / maxLoss : undefined

  const enter = () => {
    if (submitting.current) return
    submitting.current = true
    haptics.confirm()
    onDecide({ action: direction, size: sizeNum, stopPct: stopNum, targetPct: targetNum })
  }

  const skip = () => {
    if (submitting.current) return
    submitting.current = true
    haptics.select()
    onDecide({ action: 'skip', size: 0 })
  }

  const isLong = direction === 'long'

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      {/* Entry price row */}
      {entryPrice !== undefined && (
        <View style={styles.entryRow}>
          <View>
            <Text style={styles.entryEyebrow}>{assetSymbol ? `${assetSymbol} · ` : ''}ENTRY</Text>
            <Text style={styles.entryPrice}>{formatPrice(entryPrice)}</Text>
          </View>
          <View style={styles.entryRight}>
            <Text style={styles.entryVirtual}>Virtual · 1,000 USDC</Text>
          </View>
        </View>
      )}

      {/* Direction */}
      <View style={styles.dirRow}>
        <Pressable
          style={[styles.dirBtn, isLong && styles.dirBtnLong]}
          onPress={() => { haptics.select(); setDirection('long') }}
          accessibilityRole="button"
          accessibilityLabel="Long"
        >
          <Text style={[styles.dirArrow, { color: isLong ? colors.gain : colors.muted }]}>↑</Text>
          <Text style={[styles.dirLabel, { color: isLong ? colors.gain : colors.muted }]}>LONG</Text>
        </Pressable>

        <Pressable
          style={[styles.dirBtn, !isLong && styles.dirBtnShort]}
          onPress={() => { haptics.select(); setDirection('short') }}
          accessibilityRole="button"
          accessibilityLabel="Short"
        >
          <Text style={[styles.dirArrow, { color: !isLong ? colors.loss : colors.muted }]}>↓</Text>
          <Text style={[styles.dirLabel, { color: !isLong ? colors.loss : colors.muted }]}>SHORT</Text>
        </Pressable>
      </View>

      {/* Adjust toggle */}
      <Pressable style={styles.adjustRow} onPress={toggleExpand} accessibilityRole="button">
        <Text style={styles.adjustLabel}>
          {stopNum !== undefined ? `Stop −${(stopNum * 100).toFixed(0)}%` : 'No stop'} · {targetNum !== undefined ? `Target +${(targetNum * 100).toFixed(0)}%` : 'No target'} · Size {(sizeNum * 100).toFixed(0)}%
        </Text>
        <Text style={styles.adjustCaret}>{expanded ? '∧' : '∨'} Adjust</Text>
      </Pressable>

      {/* Expanded params */}
      {expanded && (
        <Animated.View style={styles.paramsPanel}>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>SIZE</Text>
            <SegmentedChips options={SIZE_OPTIONS} value={size} onChange={setSize} />
          </View>
          <View style={styles.paramDivider} />
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>STOP</Text>
            <SegmentedChips options={STOP_OPTIONS} value={stop} onChange={setStop} />
          </View>
          <View style={styles.paramDivider} />
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>TARGET</Text>
            <SegmentedChips options={TARGET_OPTIONS} value={target} onChange={setTarget} />
          </View>

          {/* R:R summary — one slim line */}
          <View style={styles.riskLine}>
            {maxLoss !== undefined && (
              <Text style={styles.riskItem}>
                Loss <Text style={{ color: colors.loss }}>−{(maxLoss * 100).toFixed(1)}%</Text>
              </Text>
            )}
            {maxGain !== undefined && (
              <Text style={styles.riskItem}>
                Gain <Text style={{ color: colors.gain }}>+{(maxGain * 100).toFixed(1)}%</Text>
              </Text>
            )}
            {rrRatio !== undefined && (
              <Text style={styles.riskItem}>
                R:R <Text style={{ color: rrRatio >= 1.5 ? colors.gain : rrRatio >= 1 ? colors.textSub : colors.loss }}>
                  {rrRatio.toFixed(1)}×
                </Text>
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <AnimatedPressable
          onPressIn={() => { skipAnim.value = 1 }}
          onPressOut={() => { skipAnim.value = 0 }}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel="Skip — no trade"
          style={[styles.skipBtn, skipStyle]}
        >
          <Text style={styles.skipLabel}>Skip</Text>
        </AnimatedPressable>

        <View style={{ flex: 1 }}>
          <PrimaryButton
            label={isLong ? '↑ Buy Long' : '↓ Sell Short'}
            onPress={enter}
            variant={isLong ? 'primary' : 'danger'}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingBottom: 40,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 14,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.bg3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },

  // Entry row
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SCREEN_PAD,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: space.sm,
  },
  entryEyebrow: {
    fontFamily: fonts.uiMedium,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.muted,
  },
  entryPrice: {
    fontFamily: fonts.serif,
    fontSize: 28,
    letterSpacing: -0.3,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  entryRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  entryVirtual: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.muted,
  },

  // Direction
  dirRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: SCREEN_PAD,
    marginBottom: space.sm,
  },
  dirBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg2,
  },
  dirBtnLong: {
    borderColor: `${colors.gain}35`,
    backgroundColor: `${colors.gain}08`,
  },
  dirBtnShort: {
    borderColor: `${colors.loss}35`,
    backgroundColor: `${colors.loss}08`,
  },
  dirArrow: {
    fontFamily: fonts.displayBold,
    fontSize: 16,
    lineHeight: 20,
  },
  dirLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 13,
    letterSpacing: 0.8,
  },

  // Adjust row
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PAD,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: space.sm,
  },
  adjustLabel: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted,
  },
  adjustCaret: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.gold,
  },

  // Params panel
  paramsPanel: {
    paddingHorizontal: SCREEN_PAD,
    marginBottom: space.sm,
    gap: 0,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  paramLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.muted,
    width: 52,
  },
  paramDivider: {
    height: 1,
    backgroundColor: colors.line,
  },

  // R:R slim line
  riskLine: {
    flexDirection: 'row',
    gap: space.xxl,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: space.xs,
  },
  riskItem: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.muted,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: SCREEN_PAD,
    paddingTop: space.sm,
    alignItems: 'center',
  },
  skipBtn: {
    paddingVertical: 15,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  skipLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: colors.muted,
  },
})
