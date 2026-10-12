import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { SegmentedChips } from '@/src/ui/components/SegmentedChips'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs } from '@/src/ui/motion'
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

export function DecisionSheet({ onDecide }: { onDecide: (decision: Decision) => void }) {
  const [size, setSize] = useState('0.5')
  const [stop, setStop] = useState('0.2')
  const [target, setTarget] = useState('0.5')
  const skipPressed = useSharedValue(0)

  const skipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(skipPressed.value ? 0.95 : 1, springs.snappy) }],
  }))

  const buy = () => {
    haptics.confirm()
    onDecide({
      action: 'buy',
      size: Number(size),
      stopPct: stop === 'none' ? undefined : Number(stop),
      targetPct: target === 'none' ? undefined : Number(target),
    })
  }

  const skip = () => {
    haptics.select()
    onDecide({ action: 'skip', size: 0 })
  }

  return (
    <View style={styles.sheet}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Trade parameters */}
      <View style={styles.params}>
        <View style={styles.paramRow}>
          <Text variant="caption" style={styles.paramLabel}>SIZE</Text>
          <SegmentedChips options={SIZE_OPTIONS} value={size} onChange={setSize} />
        </View>
        <View style={styles.divider} />
        <View style={styles.paramRow}>
          <Text variant="caption" style={styles.paramLabel}>STOP</Text>
          <SegmentedChips options={STOP_OPTIONS} value={stop} onChange={setStop} />
        </View>
        <View style={styles.divider} />
        <View style={styles.paramRow}>
          <Text variant="caption" style={styles.paramLabel}>TARGET</Text>
          <SegmentedChips options={TARGET_OPTIONS} value={target} onChange={setTarget} />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <AnimatedPressable
          onPressIn={() => { skipPressed.value = 1 }}
          onPressOut={() => { skipPressed.value = 0 }}
          onPress={skip}
          accessibilityRole="button"
          accessibilityLabel="Skip this chart"
          style={[styles.skipButton, skipStyle]}
        >
          <Text variant="title" style={styles.skipLabel}>Skip</Text>
        </AnimatedPressable>

        <View style={styles.buyWrap}>
          <PrimaryButton label="Buy →" onPress={buy} />
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
    paddingBottom: space.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.line,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: space.md,
    marginBottom: space.md,
  },
  params: {
    paddingHorizontal: space.lg,
    gap: 0,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  paramLabel: {
    letterSpacing: 1,
    fontSize: 11,
    width: 52,
    color: colors.muted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: -space.lg,
    opacity: 0.6,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    color: colors.muted,
    fontSize: 16,
  },
  buyWrap: { flex: 1 },
})
