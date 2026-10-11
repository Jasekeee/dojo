import React from 'react'
import { View } from 'react-native'
import { Chip } from '@/src/ui/components/Chip'
import { haptics } from '@/src/ui/haptics'
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
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={opt.value === value}
          onPress={() => {
            if (opt.value !== value) haptics.select()
            onChange(opt.value)
          }}
        />
      ))}
    </View>
  )
}
