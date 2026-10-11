import React from 'react'
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { springs } from '@/src/ui/motion'
import { colors, radius, space } from '@/src/ui/theme'

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress?: (e: GestureResponderEvent) => void
  disabled?: boolean
}) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.97, springs.snappy)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, springs.snappy)
        }}
        onPress={(e) => {
          haptics.confirm()
          onPress?.(e)
        }}
        style={[styles.button, disabled && styles.buttonDisabled]}
      >
        <Text variant="title" style={styles.label}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  label: { color: colors.text },
})
