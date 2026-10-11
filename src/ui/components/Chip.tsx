import React from 'react'
import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native'
import { Text } from '@/src/ui/components/Text'
import { colors, radius, space } from '@/src/ui/theme'

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress?: (e: GestureResponderEvent) => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text variant="label" style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  label: { color: colors.muted },
  labelSelected: { color: colors.text },
})
