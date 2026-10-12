import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, Line, Rect, vec } from '@shopify/react-native-skia'
import { Text } from '@/src/ui/components/Text'
import { colors } from '@/src/ui/theme'
import type { Candle } from '@/src/content/types'

const CANDLE_GAP = 2
const PADDING_TOP = 10
const PADDING_BOTTOM = 10
const PRICE_AXIS_WIDTH = 48

function formatPrice(p: number): string {
  if (p >= 10000) return `${(p / 1000).toFixed(0)}k`
  if (p >= 1000) return `${(p / 1000).toFixed(1)}k`
  if (p >= 100) return p.toFixed(0)
  if (p >= 10) return p.toFixed(1)
  return p.toFixed(2)
}

export interface ReferenceLines {
  entry?: number
  stop?: number
  target?: number
}

export function CandleChart({
  candles,
  width,
  height,
  splitIndex,
  revealCount,
  referenceLines,
}: {
  candles: Candle[]
  width: number
  height: number
  splitIndex?: number
  revealCount?: number
  referenceLines?: ReferenceLines
}) {
  const visible = revealCount === undefined ? candles : candles.slice(0, revealCount)

  const { min, max } = useMemo(() => {
    if (candles.length === 0) return { min: 0, max: 1 }
    const highs = candles.map((c) => c[2])
    const lows = candles.map((c) => c[3])
    const rawMin = Math.min(...lows)
    const rawMax = Math.max(...highs)
    const pad = (rawMax - rawMin) * 0.07
    return { min: rawMin - pad, max: rawMax + pad }
  }, [candles])

  const range = max - min || 1
  const chartW = width - PRICE_AXIS_WIDTH
  const chartH = height - PADDING_TOP - PADDING_BOTTOM
  const candleWidth = candles.length > 0 ? chartW / candles.length - CANDLE_GAP : 0

  const y = (price: number) =>
    PADDING_TOP + chartH - ((price - min) / range) * chartH

  const priceLabels = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => {
      const price = min + (range * i) / steps
      return { price, pct: i / steps }
    })
  }, [min, range])

  return (
    <View style={{ width, height }}>
      {/* Skia canvas — candles and lines */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Grid lines */}
        {priceLabels.map(({ pct }, i) => {
          const yPos = PADDING_TOP + chartH - pct * chartH
          return (
            <Line
              key={`grid-${i}`}
              p1={vec(0, yPos)}
              p2={vec(chartW, yPos)}
              color={colors.line}
              strokeWidth={0.5}
              opacity={0.4}
            />
          )
        })}

        {/* Candles */}
        {visible.map((c, i) => {
          const [, open, high, low, close] = c
          const isGreen = close >= open
          const color = isGreen ? colors.gain : colors.loss
          const x = i * (candleWidth + CANDLE_GAP)
          const bodyTop = y(Math.max(open, close))
          const bodyBottom = y(Math.min(open, close))
          return (
            <React.Fragment key={i}>
              <Line
                p1={vec(x + candleWidth / 2, y(high))}
                p2={vec(x + candleWidth / 2, y(low))}
                color={color}
                strokeWidth={1}
                opacity={0.55}
              />
              <Rect
                x={x}
                y={bodyTop}
                width={Math.max(1, candleWidth)}
                height={Math.max(1, bodyBottom - bodyTop)}
                color={color}
              />
            </React.Fragment>
          )
        })}

        {/* Split marker */}
        {splitIndex !== undefined && (
          <Line
            p1={vec(splitIndex * (candleWidth + CANDLE_GAP), PADDING_TOP)}
            p2={vec(splitIndex * (candleWidth + CANDLE_GAP), height - PADDING_BOTTOM)}
            color={colors.brand}
            strokeWidth={1.5}
            opacity={0.6}
          />
        )}

        {/* Reference lines */}
        {referenceLines?.entry !== undefined && (
          <Line
            p1={vec(0, y(referenceLines.entry))}
            p2={vec(chartW, y(referenceLines.entry))}
            color={colors.muted}
            strokeWidth={1}
            opacity={0.5}
          />
        )}
        {referenceLines?.stop !== undefined && (
          <Line
            p1={vec(0, y(referenceLines.stop))}
            p2={vec(chartW, y(referenceLines.stop))}
            color={colors.loss}
            strokeWidth={1}
            opacity={0.75}
          />
        )}
        {referenceLines?.target !== undefined && (
          <Line
            p1={vec(0, y(referenceLines.target))}
            p2={vec(chartW, y(referenceLines.target))}
            color={colors.gain}
            strokeWidth={1}
            opacity={0.75}
          />
        )}
      </Canvas>

      {/* Price axis labels — RN Text overlay */}
      <View style={[StyleSheet.absoluteFill, { left: chartW }]} pointerEvents="none">
        {priceLabels.map(({ price, pct }, i) => {
          const yPos = PADDING_TOP + chartH - pct * chartH
          return (
            <Text
              key={`lbl-${i}`}
              variant="caption"
              style={{
                position: 'absolute',
                top: yPos - 7,
                left: 4,
                fontSize: 9,
                lineHeight: 12,
                color: colors.muted,
                opacity: 0.7,
              }}
            >
              {formatPrice(price)}
            </Text>
          )
        })}
      </View>
    </View>
  )
}
