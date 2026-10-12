import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, Line, Rect, vec } from '@shopify/react-native-skia'
import { Text } from '@/src/ui/components/Text'
import { colors } from '@/src/ui/theme'
import type { Candle, Timeframe } from '@/src/content/types'

// ─── Layout constants ─────────────────────────────────────────────────────────

const CANDLE_GAP      = 2
const PADDING_TOP     = 16    // breathing room above highest label
const X_AXIS_HEIGHT   = 22    // reserved strip below canvas for time labels
const PRICE_AXIS_W    = 56    // right column for price labels
const DEFAULT_WINDOW  = 60    // max candles displayed at once

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Compute a "nice" grid step: the smallest of 1, 2, 5, 10 × 10^n that
 * divides the range into ~targetCount intervals.
 */
function niceStep(range: number, targetCount: number): number {
  const raw = range / targetCount
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * mag
}

/**
 * Return human-readable price levels within [pMin, pMax].
 * Always falls on round multiples of the chosen step.
 */
function niceGridTicks(pMin: number, pMax: number, targetCount = 5): number[] {
  const range = pMax - pMin
  if (!Number.isFinite(range) || range <= 0) return []
  const step  = niceStep(range, targetCount)
  // Start at the first step boundary above pMin
  const start = Math.ceil(pMin / step + 1e-9) * step
  const ticks: number[] = []
  for (let t = start; t <= pMax && ticks.length < 10; t += step) {
    // Snap to step grid to eliminate float drift (e.g. 47999.999 → 48000)
    ticks.push(Math.round(t / step) * step)
  }
  return ticks
}

/**
 * Format a Y-axis price label consistently within a single chart.
 * All ticks use the same unit and decimal count determined by the mid-range.
 */
function fmtAxisPrice(price: number, mid: number): string {
  if (mid >= 10000) return `${(price / 1000).toFixed(1)}k`
  if (mid >= 1000)  return `${(price / 1000).toFixed(2)}k`
  if (mid >= 100)   return price.toFixed(1)
  if (mid >= 10)    return price.toFixed(2)
  if (mid >= 1)     return price.toFixed(3)
  return price.toFixed(4)
}

/**
 * Format a reference-line label price (brief absolute value with $ sign).
 */
function fmtRefPrice(p: number): string {
  if (p >= 10000) return `$${Math.round(p).toLocaleString()}`
  if (p >= 1000)  return `$${p.toFixed(0)}`
  if (p >= 10)    return `$${p.toFixed(2)}`
  return `$${p.toFixed(4)}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'] as const

function fmtTime(ts: number, tf: Timeframe): string {
  const d = new Date(ts * 1000)
  const mm = MONTHS[d.getUTCMonth()]!
  const dd = d.getUTCDate()
  if (tf === '1d' || tf === '4h') return `${mm} ${dd}`
  // For intraday: show the date at midnight boundaries, time otherwise
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  if (tf === '1h' && h === 0 && m === 0) return `${mm} ${dd}`
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Seconds of one "period" for meaningful boundary selection per timeframe. */
const TF_PERIOD: Record<Timeframe, number> = {
  '1d':  7 * 86400,   // weekly boundaries
  '4h':  86400,       // daily boundaries
  '1h':  6 * 3600,    // 6-hour boundaries
  '15m': 3600,        // hourly boundaries
  '5m':  1800,        // 30-minute boundaries
}

/**
 * Pick X-axis tick positions at round time boundaries (midnight, hourly, etc.).
 * Falls back to evenly-spaced indices when no meaningful boundaries exist.
 */
function smartXTicks(
  candles: Candle[],
  tf: Timeframe,
  maxCount = 5,
): { idx: number; ts: number }[] {
  if (candles.length < 2) return []

  const period = TF_PERIOD[tf] ?? 3600

  // Find the first candle in each new period
  const candidates: { idx: number; ts: number }[] = []
  let lastPeriod = -Infinity
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    if (!c) continue
    const p = Math.floor(c[0] / period)
    if (p !== lastPeriod) {
      candidates.push({ idx: i, ts: c[0] })
      lastPeriod = p
    }
  }

  if (candidates.length >= 2) {
    // Evenly subsample down to maxCount, always including the first candidate
    const n = Math.min(maxCount, candidates.length)
    return Array.from({ length: n }, (_, i) => {
      const ci = Math.round((i / (n - 1)) * (candidates.length - 1))
      return candidates[ci]!
    })
  }

  // Fallback: evenly spaced by candle index
  const n = Math.min(maxCount, candles.length)
  return Array.from({ length: n }, (_, i) => {
    const idx = Math.round((i / Math.max(1, n - 1)) * (candles.length - 1))
    const c   = candles[idx]
    return c ? { idx, ts: c[0] } : null
  }).filter(Boolean) as { idx: number; ts: number }[]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReferenceLines {
  entry?: number
  stop?: number
  target?: number
}

// ─── CandleChart ──────────────────────────────────────────────────────────────

export function CandleChart({
  candles,
  width,
  height,
  splitIndex,
  revealCount,
  referenceLines,
  timeframe = '1h',
  windowSize = DEFAULT_WINDOW,
}: {
  candles: Candle[]
  width: number
  height: number
  splitIndex?: number
  revealCount?: number
  referenceLines?: ReferenceLines
  timeframe?: Timeframe
  windowSize?: number
}) {
  // ── All hooks first — never after a conditional return (Rules of Hooks) ─────

  // Price scale: uses the full candle set so the axis never rescales during reveal.
  const { pMin, pMax } = useMemo(() => {
    if (!candles || candles.length === 0) return { pMin: 0, pMax: 1 }
    let rawMin =  Infinity
    let rawMax = -Infinity
    for (const c of candles) {
      // c[2]=high, c[3]=low
      if (!c || !Number.isFinite(c[2]) || !Number.isFinite(c[3])) continue
      if (c[3] < rawMin) rawMin = c[3]
      if (c[2] > rawMax) rawMax = c[2]
    }
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return { pMin: 0, pMax: 1 }
    const pad = (rawMax - rawMin) * 0.07
    return { pMin: rawMin - pad, pMax: rawMax + pad }
  }, [candles])

  // Y-axis grid: stable, human-readable price levels
  const gridPrices = useMemo(
    () => niceGridTicks(pMin, pMax),
    [pMin, pMax],
  )

  // Windowing — derived before xTicks so the memo has `visible` available
  const revealed     = revealCount !== undefined
    ? (candles ?? []).slice(0, revealCount)
    : (candles ?? [])
  const windowStart  = Math.max(0, revealed.length - windowSize)
  const visible      = revealed.slice(windowStart)

  // X-axis ticks: prefer round time boundaries, fall back to evenly spaced
  const xTicks = useMemo(
    () => smartXTicks(visible, timeframe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible.length, visible[0]?.[0], visible[visible.length - 1]?.[0], timeframe],
  )

  // ── Guard: after all hooks ─────────────────────────────────────────────────
  if (!candles || candles.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text variant="caption">No chart data</Text>
      </View>
    )
  }

  // ── Derived layout values (not hooks) ─────────────────────────────────────

  const adjSplit =
    splitIndex !== undefined ? splitIndex - windowStart : undefined

  const range  = pMax - pMin || 1
  const pMid   = (pMin + pMax) / 2

  const chartW  = width - PRICE_AXIS_W
  const canvasH = height - X_AXIS_HEIGHT
  const chartH  = canvasH - PADDING_TOP

  const slotW = visible.length > 0 ? chartW / visible.length : 0
  const bodyW = Math.max(1, slotW - CANDLE_GAP)

  // Shared price → canvas-Y transform.  pMax maps to PADDING_TOP, pMin to canvasH.
  const y = (price: number): number =>
    PADDING_TOP + chartH - ((price - pMin) / range) * chartH

  const hasSplit =
    adjSplit !== undefined && adjSplit > 0 && adjSplit < visible.length

  // Suppress grid labels that would collide with reference line labels
  const refYs = ([referenceLines?.entry, referenceLines?.stop, referenceLines?.target] as const)
    .filter((p): p is number => p !== undefined)
    .map((p) => y(p))
  const nearRef = (yPos: number) => refYs.some((ry) => Math.abs(ry - yPos) < 16)

  // Clamp a reference label so it stays within the visible canvas area
  const refTop = (yPos: number): number =>
    Math.max(0, Math.min(canvasH - 22, yPos - 16))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Candlestick chart, ${visible.length} candles`}
    >

      {/* ── Skia canvas: candles, gridlines, reference lines ── */}
      <Canvas style={[StyleSheet.absoluteFill, { bottom: X_AXIS_HEIGHT }]}>

        {/* Horizontal grid lines at human-readable price intervals */}
        {gridPrices.map((price, i) => (
          <Line
            key={`g${i}`}
            p1={vec(0, y(price))}
            p2={vec(chartW, y(price))}
            color={colors.line}
            strokeWidth={0.5}
            opacity={0.35}
          />
        ))}

        {/* Faint fill between stop and target when both are set */}
        {referenceLines?.stop !== undefined && referenceLines?.target !== undefined && (
          <Rect
            x={0}
            y={y(referenceLines.target)}
            width={chartW}
            height={Math.max(0, y(referenceLines.stop) - y(referenceLines.target))}
            color="#FFFFFF"
            opacity={0.03}
          />
        )}

        {/* Entry overlay */}
        {referenceLines?.entry !== undefined && (
          <Line
            p1={vec(0, y(referenceLines.entry))}
            p2={vec(chartW, y(referenceLines.entry))}
            color={colors.muted}
            strokeWidth={1}
            opacity={0.6}
          />
        )}
        {/* Stop overlay */}
        {referenceLines?.stop !== undefined && (
          <Line
            p1={vec(0, y(referenceLines.stop))}
            p2={vec(chartW, y(referenceLines.stop))}
            color={colors.loss}
            strokeWidth={1}
            opacity={0.8}
          />
        )}
        {/* Target overlay */}
        {referenceLines?.target !== undefined && (
          <Line
            p1={vec(0, y(referenceLines.target))}
            p2={vec(chartW, y(referenceLines.target))}
            color={colors.gain}
            strokeWidth={1}
            opacity={0.8}
          />
        )}

        {/* Vertical split marker at the entry candle */}
        {hasSplit && (
          <Line
            p1={vec(adjSplit! * slotW, PADDING_TOP)}
            p2={vec(adjSplit! * slotW, canvasH)}
            color={colors.brand}
            strokeWidth={1.5}
            opacity={0.45}
          />
        )}

        {/* Candlestick bodies and wicks */}
        {visible.map((c, i) => {
          if (!c) return null

          // Destructure with volume at index 5 (Candle = [t,o,h,l,c,v])
          const open  = c[1]
          const high  = c[2]
          const low   = c[3]
          const close = c[4]

          // Reject malformed or inverted OHLC
          if (
            !Number.isFinite(open)  || !Number.isFinite(high) ||
            !Number.isFinite(low)   || !Number.isFinite(close) ||
            high < low
          ) return null

          const isGreen   = close >= open
          const baseColor = isGreen ? colors.gain : colors.loss

          // Visual differentiation: history is dimmed, revealed outcome is bright
          const isAfter = hasSplit && i >= adjSplit!
          const opacity = hasSplit ? (isAfter ? 1.0 : 0.4) : 0.8

          const cx       = i * slotW
          const bodyTop  = y(Math.max(open, close))
          const bodyBot  = y(Math.min(open, close))
          const bodyH    = Math.max(1, bodyBot - bodyTop)
          const wickX    = cx + bodyW / 2

          return (
            <React.Fragment key={i}>
              {/* Wick */}
              <Line
                p1={vec(wickX, y(high))}
                p2={vec(wickX, y(low))}
                color={baseColor}
                strokeWidth={1}
                opacity={opacity * 0.65}
              />
              {/* Body */}
              <Rect
                x={cx}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                color={baseColor}
                opacity={opacity}
              />
            </React.Fragment>
          )
        })}
      </Canvas>

      {/* ── Price axis — right column, same height as canvas ── */}
      <View
        style={[StyleSheet.absoluteFill, { left: chartW, bottom: X_AXIS_HEIGHT }]}
        pointerEvents="none"
      >
        {/* Grid price labels — suppressed if within 16px of a reference label */}
        {gridPrices.map((price, i) => {
          const yPos = y(price)
          if (nearRef(yPos)) return null
          // Clamp so the label stays inside the axis view
          const top = Math.max(0, Math.min(canvasH - 14, yPos - 7))
          return (
            <Text
              key={`pl${i}`}
              variant="caption"
              style={{
                position: 'absolute',
                top,
                left: 4,
                right: 0,
                fontSize: 9,
                lineHeight: 12,
                color: colors.muted,
                opacity: 0.55,
              }}
            >
              {fmtAxisPrice(price, pMid)}
            </Text>
          )
        })}

        {/* Reference line labels — ENTRY, STOP, TARGET */}
        {referenceLines?.entry !== undefined && (
          <View style={{ position: 'absolute', top: refTop(y(referenceLines.entry)), left: 0 }}>
            <Text style={s.refTag}>ENTRY</Text>
            <Text style={[s.refPrice, { color: colors.muted }]}>
              {fmtRefPrice(referenceLines.entry)}
            </Text>
          </View>
        )}
        {referenceLines?.stop !== undefined && (
          <View style={{ position: 'absolute', top: refTop(y(referenceLines.stop)), left: 0 }}>
            <Text style={[s.refTag, { color: `${colors.loss}CC` }]}>STOP</Text>
            <Text style={[s.refPrice, { color: colors.loss }]}>
              {fmtRefPrice(referenceLines.stop)}
            </Text>
          </View>
        )}
        {referenceLines?.target !== undefined && (
          <View style={{ position: 'absolute', top: refTop(y(referenceLines.target)), left: 0 }}>
            <Text style={[s.refTag, { color: `${colors.gain}CC` }]}>TARGET</Text>
            <Text style={[s.refPrice, { color: colors.gain }]}>
              {fmtRefPrice(referenceLines.target)}
            </Text>
          </View>
        )}
      </View>

      {/* ── X-axis — bottom strip, clipped so labels never bleed into price axis ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: PRICE_AXIS_W,
          height: X_AXIS_HEIGHT,
          overflow: 'hidden',
        }}
        pointerEvents="none"
      >
        {xTicks.map(({ idx, ts }, ti) => {
          const cx = (idx + 0.5) * slotW
          return (
            <Text
              key={`xt${ti}`}
              variant="caption"
              style={{
                position: 'absolute',
                left: cx - 22,
                top: 4,
                width: 44,
                textAlign: 'center',
                fontSize: 9,
                color: colors.muted,
                opacity: 0.5,
              }}
            >
              {fmtTime(ts, timeframe)}
            </Text>
          )
        })}
      </View>

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  refTag: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 8,
    color: `${colors.muted}BB`,
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  refPrice: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 9,
    lineHeight: 12,
    color: colors.muted,
  },
})
