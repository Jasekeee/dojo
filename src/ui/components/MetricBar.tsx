import React from 'react'
import { View, type ViewStyle } from 'react-native'
import { colors } from '@/src/ui/theme'

// Returns the semantic color for a 0-100 metric value.
// Exported so callers can color the associated numeric label consistently.
export function getMetricColor(value: number, isLowerBetter = false): string {
  const effective = isLowerBetter ? 100 - value : value
  return effective >= 70 ? colors.gain : effective >= 40 ? colors.warn : colors.loss
}

interface MetricBarProps {
  value: number | null   // 0–100 percentage. null renders nothing.
  isLowerBetter?: boolean
  size?: 'sm' | 'md'    // 'sm' = 3 px, 'md' = 5 px (default)
  style?: ViewStyle
}

export function MetricBar({
  value,
  isLowerBetter = false,
  size = 'md',
  style,
}: MetricBarProps) {
  if (value === null) return null

  const pct      = Math.max(0, Math.min(100, value))
  const barColor = getMetricColor(pct, isLowerBetter)
  const barH     = size === 'sm' ? 3 : 5

  return (
    <View
      style={[
        { height: barH, borderRadius: barH / 2, overflow: 'hidden', backgroundColor: colors.bg2 },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct}%` as any,
          height: barH,
          backgroundColor: barColor,
          borderRadius: barH / 2,
        }}
      />
    </View>
  )
}
