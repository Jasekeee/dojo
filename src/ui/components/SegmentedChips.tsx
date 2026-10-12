import React from 'react'
import { View } from 'react-native'
import { Chip } from '@/src/ui/components/Chip'
import { space } from '@/src/ui/theme'

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
    <View
      style={{ flexDirection: 'row', gap: space.sm }}
      accessibilityRole="radiogroup"
    >
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={opt.value === value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  )
}
