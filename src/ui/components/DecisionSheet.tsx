import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { SegmentedChips } from '@/src/ui/components/SegmentedChips'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs } from '@/src/ui/motion'
import { COST_ROUND_TRIP } from '@/src/engine/sim'
import { colors, radius, space } from '@/src/ui/theme'

export interface Decision {
  action: 'buy' | 'skip'
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
  { label: 'None', value: 'none' },
]
const TARGET_OPTIONS = [
  { label: '+25%', value: '0.25' },
  { label: '+50%', value: '0.5' },
  { label: '+100%', value: '1' },
  { label: 'None', value: 'none' },
]

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

function formatPrice(p: number): string {
  if (p >= 10000) return `$${Math.round(p).toLocaleString()}`
  if (p >= 1000)  return `$${p.toFixed(0)}`
  if (p >= 10)    return `$${p.toFixed(2)}`
  return `$${p.toFixed(4)}`
}

export function DecisionSheet({
  onDecide,
  entryPrice,
  assetSymbol,
}: {
  onDecide: (decision: Decision) => void
  entryPrice?: number
  assetSymbol?: string
}) {
  const [size, setSize]     = useState('0.5')
  const [stop, setStop]     = useState('0.2')
  const [target, setTarget] = useState('0.5')
  const skipPressed = useSharedValue(0)
  // Guard: prevent double-tap from submitting twice
  const submitting = useRef(false)

  // Reset guard on unmount so remounted sheets work correctly
  useEffect(() => () => { submitting.current = false }, [])

  const skipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(skipPressed.value ? 0.95 : 1, springs.snappy) }],
  }))

  // ── Risk / Reward calculation ──
  const sizeNum   = parseFloat(size)
  const stopNum   = stop   === 'none' ? undefined : parseFloat(stop)
  const targetNum = target === 'none' ? undefined : parseFloat(target)

  const maxLoss   = stopNum   !== undefined ? sizeNum * (stopNum   + COST_ROUND_TRIP) : undefined
  const maxGain   = targetNum !== undefined ? sizeNum * (targetNum - COST_ROUND_TRIP) : undefined
  const rrRatio   = maxLoss && maxGain && maxLoss > 0 ? maxGain / maxLoss : undefined

  const buy = () => {
    if (submitting.current) return
    submitting.current = true
    haptics.confirm()
    onDecide({
      action: 'buy',
      size: sizeNum,
      stopPct: stopNum,
      targetPct: targetNum,
    })
  }

  const skip = () => {
    if (submitting.current) return
    submitting.current = true
    haptics.select()
    onDecide({ action: 'skip', size: 0 })
  }

  return (
    <View style={styles.sheet}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Entry context */}
      {entryPrice !== undefined && (
        <View style={styles.entryBanner}>
          <View style={styles.entryLeft}>
            <Text variant="caption" style={{ letterSpacing: 1 }}>
              {assetSymbol ? `${assetSymbol} · ` : ''}ENTRY
            </Text>
            <Text
              variant="numeric"
              style={{ fontSize: 18, color: colors.text, marginTop: 1 }}
            >
              {formatPrice(entryPrice)}
            </Text>
          </View>
          <View style={styles.entryRight}>
            <Text variant="caption" style={{ textAlign: 'right' }}>
              Virtual position
            </Text>
            <Text variant="caption" style={{ textAlign: 'right', marginTop: 1 }}>
              1,000 USDC
            </Text>
          </View>
        </View>
      )}

      {/* Parameters */}
      <View style={styles.params}>
        <View style={styles.paramRow}>
          <View>
            <Text variant="caption" style={styles.paramLabel}>SIZE</Text>
            <Text variant="caption" style={styles.paramDesc}>% of position</Text>
          </View>
          <SegmentedChips options={SIZE_OPTIONS} value={size} onChange={setSize} />
        </View>

        <View style={styles.divider} />

        <View style={styles.paramRow}>
          <View>
            <Text variant="caption" style={styles.paramLabel}>STOP</Text>
            <Text variant="caption" style={styles.paramDesc}>Max loss from entry</Text>
          </View>
          <SegmentedChips options={STOP_OPTIONS} value={stop} onChange={setStop} />
        </View>

        <View style={styles.divider} />

        <View style={styles.paramRow}>
          <View>
            <Text variant="caption" style={styles.paramLabel}>TARGET</Text>
            <Text variant="caption" style={styles.paramDesc}>Take profit from entry</Text>
          </View>
          <SegmentedChips options={TARGET_OPTIONS} value={target} onChange={setTarget} />
        </View>
      </View>

      {/* Risk summary */}
      <View style={styles.riskRow}>
        {maxLoss !== undefined ? (
          <View style={styles.riskItem}>
            <Text variant="caption" style={{ fontSize: 10 }}>MAX LOSS</Text>
            <Text variant="numeric" style={[styles.riskValue, { color: colors.loss }]}>
              −{(maxLoss * 100).toFixed(1)}%
            </Text>
          </View>
        ) : (
          <View style={[styles.riskItem, styles.riskWarning]}>
            <Text variant="caption" style={{ fontSize: 10, color: colors.warn }}>
              NO STOP SET
            </Text>
            <Text
              variant="caption"
              style={{ fontSize: 10, color: colors.warn, marginTop: 1 }}
            >
              Unlimited risk
            </Text>
          </View>
        )}

        {maxGain !== undefined ? (
          <View style={styles.riskItem}>
            <Text variant="caption" style={{ fontSize: 10 }}>MAX GAIN</Text>
            <Text variant="numeric" style={[styles.riskValue, { color: colors.gain }]}>
              +{(maxGain * 100).toFixed(1)}%
            </Text>
          </View>
        ) : (
          <View style={styles.riskItem}>
            <Text variant="caption" style={{ fontSize: 10 }}>TARGET</Text>
            <Text variant="caption" style={{ marginTop: 1, color: colors.muted }}>
              None
            </Text>
          </View>
        )}

        {rrRatio !== undefined ? (
          <View style={[styles.riskItem, styles.riskItemHighlight]}>
            <Text variant="caption" style={{ fontSize: 10 }}>R : R</Text>
            <Text
              variant="numeric"
              style={[
                styles.riskValue,
                { color: rrRatio >= 1.5 ? colors.gain : rrRatio >= 1 ? colors.warn : colors.loss },
              ]}
            >
              {rrRatio.toFixed(1)} : 1
            </Text>
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <AnimatedPressable
          onPressIn={() => { skipPressed.value = 1 }}
          onPressOut={() => { skipPressed.value = 0 }}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel="Skip this chart — no trade"
          style={[styles.skipButton, skipStyle]}
        >
          <Text style={styles.skipLabel}>Skip</Text>
          <Text variant="caption" style={{ marginTop: 2, color: colors.muted, fontSize: 11 }}>
            No trade
          </Text>
        </AnimatedPressable>

        <View style={styles.buyWrap}>
          <PrimaryButton
            label="Buy →"
            onPress={buy}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bg1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.line,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.line,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },

  entryBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.bg2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 2,
  },
  entryLeft: { gap: 1 },
  entryRight: { gap: 1 },

  params: { paddingHorizontal: space.lg },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: space.sm,
  },
  paramLabel: { letterSpacing: 1, fontSize: 11, color: colors.muted },
  paramDesc:  { fontSize: 10, color: `${colors.muted}88`, marginTop: 1 },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: -space.lg,
    opacity: 0.5,
  },

  riskRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginTop: 2,
  },
  riskItem: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 8,
    padding: space.sm,
    gap: 2,
  },
  riskItemHighlight: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  riskWarning: {
    backgroundColor: `${colors.warn}10`,
    borderWidth: 1,
    borderColor: `${colors.warn}30`,
  },
  riskValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },

  actions: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    alignItems: 'stretch',
  },
  skipButton: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  skipLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.muted,
  },
  buyWrap: { flex: 1 },
})
