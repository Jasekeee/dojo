// Equal-width segmented control — all chips fill available width, nothing clipped.
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { SegmentedChip } from '@/src/ui/components/Chip'
import { colors, radius, space } from '@/src/ui/theme'

export function SegmentedChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.track}>
      {options.map((opt) => (
        <SegmentedChip
          key={opt.value}
          label={opt.label}
          selected={opt.value === value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
})
