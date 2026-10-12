import React from 'react'
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs } from '@/src/ui/motion'
import { colors, fonts, radius, space } from '@/src/ui/theme'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Chip({
  label,
  selected,
  onPress,
  size = 'md',
}: {
  label: string
  selected?: boolean
  onPress?: (e: GestureResponderEvent) => void
  size?: 'sm' | 'md'
}) {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, springs.snappy) }],
  }))

  return (
    <AnimatedPressable
      onPressIn={() => { pressed.value = 1 }}
      onPressOut={() => { pressed.value = 0 }}
      onPress={(e) => {
        haptics.select()
        onPress?.(e)
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        selected ? styles.selected : styles.unselected,
        animatedStyle,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </AnimatedPressable>
  )
}

// Equal-width segmented chip — used inside DecisionSheet
export function SegmentedChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const pressed = useSharedValue(0)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.97 : 1, springs.snappy) }],
  }))

  return (
    <AnimatedPressable
      onPressIn={() => { pressed.value = 1 }}
      onPressOut={() => { pressed.value = 0 }}
      onPress={() => { haptics.select(); onPress() }}
      style={[styles.segBase, selected ? styles.segSelected : styles.segUnselected, animatedStyle]}
    >
      <Text style={[styles.segLabel, selected && styles.segLabelSelected]}>
        {label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  md: { paddingHorizontal: space.md, paddingVertical: space.sm },
  sm: { paddingHorizontal: space.sm, paddingVertical: 4 },

  unselected: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selected: {
    backgroundColor: `${colors.gold}18`,
    borderWidth: 1,
    borderColor: colors.lineChampagne,
  },

  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.muted,
  },
  labelSelected: {
    color: colors.gold,
  },

  // Segmented (equal-width, inside a row)
  segBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    minHeight: 36,
  },
  segUnselected: {
    backgroundColor: 'transparent',
  },
  segSelected: {
    backgroundColor: colors.bg1,
    borderWidth: 1,
    borderColor: colors.lineChampagneSoft,
  },
  segLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.muted,
  },
  segLabelSelected: {
    color: colors.gold,
    fontFamily: fonts.uiSemiBold,
  },
})
