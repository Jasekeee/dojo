import React from 'react'
import { View, type ViewStyle } from 'react-native'
import { Text } from '@/src/ui/components/Text'
import { LEVEL_BANDS } from '@/src/ui/levelConfig'
import { colors } from '@/src/ui/theme'

interface SRBarProps {
  sr: number
  showLabels?: boolean  // milestone labels: 0 300 500 700 850 1k
  compact?: boolean     // bar height: compact=3, default=5
  style?: ViewStyle
}

export function SRBar({ sr, showLabels = false, compact = false, style }: SRBarProps) {
  const barH   = compact ? 3 : 5
  const srSafe = Math.max(0, Math.min(1000, sr))

  return (
    <View style={style}>
      {/* Segmented track */}
      <View
        style={{
          height: barH,
          borderRadius: barH / 2,
          overflow: 'hidden',
          backgroundColor: colors.bg2,
        }}
      >
        {/* Colored fill: each band contributes its portion up to current SR */}
        {LEVEL_BANDS.map((band) => {
          const fillEnd = Math.min(band.max, srSafe)
          if (fillEnd <= band.min) return null
          const leftPct  = (band.min / 1000) * 100
          const widthPct = ((fillEnd - band.min) / 1000) * 100
          return (
            <View
              key={band.level}
              style={{
                position: 'absolute',
                left: `${leftPct}%` as any,
                top: 0,
                bottom: 0,
                width: `${widthPct}%` as any,
                backgroundColor: band.color,
              }}
            />
          )
        })}

        {/* Thin dividers at level boundaries */}
        {[300, 500, 700, 850].map((m) => (
          <View
            key={m}
            style={{
              position: 'absolute',
              left: `${(m / 1000) * 100}%` as any,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: colors.bg0,
              opacity: 0.5,
            }}
          />
        ))}

        {/* Position pip at current SR */}
        {srSafe > 0 && srSafe < 1000 && (
          <View
            style={{
              position: 'absolute',
              left: `${(srSafe / 1000) * 100}%` as any,
              top: -1,
              bottom: -1,
              width: 2,
              backgroundColor: colors.text,
              opacity: 0.85,
              transform: [{ translateX: -1 }],
            }}
          />
        )}
      </View>

      {/* Milestone labels */}
      {showLabels && (
        <View style={{ height: 14, position: 'relative', marginTop: 2 }}>
          <Text variant="caption" style={{ position: 'absolute', left: 0, fontSize: 8, opacity: 0.5 }}>
            0
          </Text>
          <Text variant="caption" style={{ position: 'absolute', left: '30%' as any, fontSize: 8, opacity: 0.5, transform: [{ translateX: -8 }] }}>
            300
          </Text>
          <Text variant="caption" style={{ position: 'absolute', left: '50%' as any, fontSize: 8, opacity: 0.5, transform: [{ translateX: -8 }] }}>
            500
          </Text>
          <Text variant="caption" style={{ position: 'absolute', left: '70%' as any, fontSize: 8, opacity: 0.5, transform: [{ translateX: -8 }] }}>
            700
          </Text>
          <Text variant="caption" style={{ position: 'absolute', left: '85%' as any, fontSize: 8, opacity: 0.5, transform: [{ translateX: -8 }] }}>
            850
          </Text>
          <Text variant="caption" style={{ position: 'absolute', right: 0, fontSize: 8, opacity: 0.5 }}>
            1k
          </Text>
        </View>
      )}
    </View>
  )
}
