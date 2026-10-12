import React from 'react'
import { type GestureResponderEvent, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { Pressable } from 'react-native'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs, timings } from '@/src/ui/motion'
import { colors, radius, space } from '@/src/ui/theme'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress?: (e: GestureResponderEvent) => void
}) {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.93 : 1, springs.snappy) }],
  }))

  return (
    <AnimatedPressable
      onPressIn={() => { pressed.value = 1 }}
      onPressOut={() => { pressed.value = 0 }}
      onPress={(e) => {
        haptics.select()
        onPress?.(e)
      }}
      style={[styles.chip, selected && styles.chipSelected, animatedStyle]}
    >
      <Text
        variant="label"
        style={[
          styles.label,
          selected && styles.labelSelected,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: `${colors.brand}22`,
    borderColor: colors.brand,
  },
  label: { color: colors.muted, fontSize: 13 },
  labelSelected: { color: colors.brand, fontWeight: '600' },
})
