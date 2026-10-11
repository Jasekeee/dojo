import React from 'react'
import { View } from 'react-native'
import Svg, { Line, Rect } from 'react-native-svg'
import type { Episode } from '@/src/content/episodes'

const WIDTH = 340
const HEIGHT = 160
const CANDLE_GAP = 2

export function EpisodeChart({ episode }: { episode: Episode }) {
  const candles = [...episode.before, ...episode.after]
  const splitIndex = episode.before.length

  const highs = candles.map((c) => c[2])
  const lows = candles.map((c) => c[3])
  const max = Math.max(...highs)
  const min = Math.min(...lows)
  const range = max - min || 1

  const candleWidth = WIDTH / candles.length - CANDLE_GAP
  const y = (price: number) => HEIGHT - ((price - min) / range) * HEIGHT

  return (
    <View>
      <Svg width={WIDTH} height={HEIGHT}>
        {candles.map((c, i) => {
          const [, open, high, low, close] = c
          const isGreen = close >= open
          const color = isGreen ? '#9CFF57' : '#FF5C7A'
          const x = i * (candleWidth + CANDLE_GAP)
          const bodyTop = y(Math.max(open, close))
          const bodyBottom = y(Math.min(open, close))
          return (
            <React.Fragment key={i}>
              <Line x1={x + candleWidth / 2} x2={x + candleWidth / 2} y1={y(high)} y2={y(low)} stroke={color} strokeWidth={1} />
              <Rect x={x} y={bodyTop} width={candleWidth} height={Math.max(1, bodyBottom - bodyTop)} fill={color} />
            </React.Fragment>
          )
        })}
        <Line
          x1={splitIndex * (candleWidth + CANDLE_GAP)}
          x2={splitIndex * (candleWidth + CANDLE_GAP)}
          y1={0}
          y2={HEIGHT}
          stroke="#8B5CFF"
          strokeWidth={2}
          strokeDasharray="4,4"
        />
      </Svg>
    </View>
  )
}
