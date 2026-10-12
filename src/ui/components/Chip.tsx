import React from 'react'
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs } from '@/src/ui/motion'
import { colors, radius, space } from '@/src/ui/theme'

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
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        selected && styles.selected,
        animatedStyle,
      ]}
    >
      <Text
        variant="label"
        style={[
          styles.label,
          size === 'sm' && { fontSize: 11 },
          selected && styles.labelSelected,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.chip,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  md:  { paddingHorizontal: space.md, paddingVertical: space.sm },
  sm:  { paddingHorizontal: space.sm, paddingVertical: 4 },
  selected: {
    backgroundColor: `${colors.brand}22`,
    borderColor: colors.brand,
  },
  label: { color: colors.muted, fontSize: 13 },
  labelSelected: { color: colors.brand, fontWeight: '600' },
})
