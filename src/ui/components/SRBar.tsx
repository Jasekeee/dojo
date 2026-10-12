import React from 'react'
import { View, type ViewStyle } from 'react-native'
import { LEVEL_BANDS } from '@/src/ui/levelConfig'
import { colors } from '@/src/ui/theme'

interface SRBarProps {
  sr: number
  compact?: boolean
  style?: ViewStyle
}

export function SRBar({ sr, compact = false, style }: SRBarProps) {
  const barH   = compact ? 2 : 4
  const srSafe = Math.max(0, Math.min(1000, sr))

  return (
    <View style={style}>
      <View style={{ height: barH, borderRadius: barH / 2, overflow: 'hidden', backgroundColor: colors.bg3 }}>
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
                top: 0, bottom: 0,
                width: `${widthPct}%` as any,
                backgroundColor: band.color,
                opacity: 0.7,
              }}
            />
          )
        })}
        {/* Subtle band separators */}
        {[300, 500, 700, 850].map((m) => (
          <View
            key={m}
            style={{
              position: 'absolute',
              left: `${(m / 1000) * 100}%` as any,
              top: 0, bottom: 0,
              width: 1,
              backgroundColor: colors.bg0,
              opacity: 0.6,
            }}
          />
        ))}
        {/* Position marker */}
        {srSafe > 0 && srSafe < 1000 && (
          <View
            style={{
              position: 'absolute',
              left: `${(srSafe / 1000) * 100}%` as any,
              top: -1, bottom: -1,
              width: 2,
              backgroundColor: colors.gold,
              opacity: 0.9,
              transform: [{ translateX: -1 }],
            }}
          />
        )}
      </View>
    </View>
  )
}
