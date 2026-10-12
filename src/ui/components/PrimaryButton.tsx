// Champagne gold primary CTA — no neon, no glow, pill shape.
// Press: scale 0.98 + light haptic. Gradient: warm gold sheen.
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs, timings } from '@/src/ui/motion'
import { colors, fonts, radius, space } from '@/src/ui/theme'

interface ButtonProps {
  label: string
  onPress?: (e: GestureResponderEvent) => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  style?: ViewStyle
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  size = 'lg',
  style,
}: ButtonProps) {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.98 : 1, springs.snappy) }],
    opacity: withTiming(disabled || loading ? 0.38 : 1, timings.fast),
  }))

  const isDisabled = disabled || loading

  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPressIn={() => { pressed.value = 1 }}
      onPressOut={() => { pressed.value = 0 }}
      onPress={(e) => {
        if (isDisabled) return
        haptics.select()
        onPress?.(e)
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[styles.base, styles[`size_${size}`], style, animatedStyle]}
    >
      {/* Gradient fill for primary */}
      {variant === 'primary' && (
        <LinearGradient
          colors={['#D4B47A', '#B8934E', '#C9A96E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {/* Danger fill */}
      {variant === 'danger' && (
        <LinearGradient
          colors={['#D45E58', '#B03F3A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {/* Secondary / ghost border overlays */}
      {variant === 'secondary' && <LinearGradient colors={['transparent','transparent']} style={[StyleSheet.absoluteFillObject, styles.secondaryBg]} />}
      {variant === 'ghost' && <LinearGradient colors={['transparent','transparent']} style={[StyleSheet.absoluteFillObject, styles.ghostBg]} />}

      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.bg0 : colors.gold}
          size="small"
        />
      ) : (
        <Text style={[
          styles.label,
          (variant === 'primary' || variant === 'danger') && styles.labelDark,
          variant === 'secondary' && styles.labelSecondary,
          variant === 'ghost' && styles.labelGhost,
        ]}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  size_lg: { paddingVertical: 15, paddingHorizontal: space.xxl },
  size_md: { paddingVertical: space.md, paddingHorizontal: space.xl },

  secondaryBg: {
    borderWidth: 1,
    borderColor: colors.lineChampagne,
    borderRadius: radius.pill,
  },
  ghostBg: {
    backgroundColor: colors.bg2,
    borderRadius: radius.pill,
  },

  label: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: colors.text,
  },
  labelDark:      { color: colors.bg0 },
  labelSecondary: { color: colors.gold },
  labelGhost:     { color: colors.textSub },
})
