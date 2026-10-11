import React, { useMemo } from 'react'
import { Canvas, Line, Rect, vec } from '@shopify/react-native-skia'
import { colors } from '@/src/ui/theme'
import type { Candle } from '@/src/content/types'

const CANDLE_GAP = 2

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
  /** Index where `before` ends and `after` begins; draws a split marker there. Omit for no marker. */
  splitIndex?: number
  /** Only render the first N candles (for reveal animation). Defaults to all. */
  revealCount?: number
  referenceLines?: ReferenceLines
}) {
  const visible = revealCount === undefined ? candles : candles.slice(0, revealCount)

  const { min, max } = useMemo(() => {
    if (candles.length === 0) return { min: 0, max: 1 }
    const highs = candles.map((c) => c[2])
    const lows = candles.map((c) => c[3])
    return { min: Math.min(...lows), max: Math.max(...highs) }
  }, [candles])

  const range = max - min || 1
  const candleWidth = candles.length > 0 ? width / candles.length - CANDLE_GAP : 0
  const y = (price: number) => height - ((price - min) / range) * height

  return (
    <Canvas style={{ width, height }}>
      {visible.map((c, i) => {
        const [, open, high, low, close] = c
        const isGreen = close >= open
        const color = isGreen ? colors.gain : colors.loss
        const x = i * (candleWidth + CANDLE_GAP)
        const bodyTop = y(Math.max(open, close))
        const bodyBottom = y(Math.min(open, close))
        return (
          <React.Fragment key={i}>
            <Line p1={vec(x + candleWidth / 2, y(high))} p2={vec(x + candleWidth / 2, y(low))} color={color} strokeWidth={1} />
            <Rect
              x={x}
              y={bodyTop}
              width={candleWidth}
              height={Math.max(1, bodyBottom - bodyTop)}
              color={color}
            />
          </React.Fragment>
        )
      })}
      {splitIndex !== undefined && (
        <Line
          p1={vec(splitIndex * (candleWidth + CANDLE_GAP), 0)}
          p2={vec(splitIndex * (candleWidth + CANDLE_GAP), height)}
          color={colors.brand}
          strokeWidth={2}
        />
      )}
      {referenceLines?.entry !== undefined && (
        <Line p1={vec(0, y(referenceLines.entry))} p2={vec(width, y(referenceLines.entry))} color={colors.text} strokeWidth={1} />
      )}
      {referenceLines?.stop !== undefined && (
        <Line p1={vec(0, y(referenceLines.stop))} p2={vec(width, y(referenceLines.stop))} color={colors.loss} strokeWidth={1} />
      )}
      {referenceLines?.target !== undefined && (
        <Line p1={vec(0, y(referenceLines.target))} p2={vec(width, y(referenceLines.target))} color={colors.gain} strokeWidth={1} />
      )}
    </Canvas>
  )
}
