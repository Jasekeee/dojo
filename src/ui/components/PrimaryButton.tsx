import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs, timings } from '@/src/ui/motion'
import { colors, radius, space } from '@/src/ui/theme'

interface ButtonProps {
  label: string
  onPress?: (e: GestureResponderEvent) => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'lg',
}: ButtonProps) {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, springs.snappy) }],
    opacity: withTiming(disabled || loading ? 0.45 : 1, timings.fast),
  }))

  const isDisabled = disabled || loading

  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPressIn={() => { pressed.value = 1 }}
      onPressOut={() => { pressed.value = 0 }}
      onPress={(e) => {
        if (isDisabled) return
        haptics.confirm()
        onPress?.(e)
      }}
      style={[styles.base, styles[`size_${size}`], styles[`variant_${variant}`], animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.text : colors.brand} size="small" />
      ) : (
        <Text
          variant="title"
          style={[
            styles.label,
            variant === 'secondary' && { color: colors.brand },
            variant === 'ghost' && { color: colors.muted },
            variant === 'danger' && { color: colors.loss },
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  size_lg: { paddingVertical: space.lg, paddingHorizontal: space.xl },
  size_md: { paddingVertical: space.md, paddingHorizontal: space.lg },
  variant_primary: {
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  variant_ghost: {
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  variant_danger: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.loss,
  },
  label: { color: colors.text },
})
