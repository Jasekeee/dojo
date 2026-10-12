import React, { useRef, useState, useCallback } from 'react'
import { Alert, Share, StyleSheet, View } from 'react-native'
import ViewShot from 'react-native-view-shot'
import * as ExpoSharing from 'expo-sharing'
import { Text } from '@/src/ui/components/Text'
import { SRBar } from '@/src/ui/components/SRBar'
import { getLevelBand } from '@/src/ui/levelConfig'
import { getLevel } from '@/src/engine/rating'
import { colors, levelColors, space } from '@/src/ui/theme'
import { haptics } from '@/src/ui/haptics'

// ─── Card dimensions ─────────────────────────────────────────────────────────
// 375×560 points at @2x = 750×1120 physical pixels — Instagram-friendly portrait.
const CARD_W = 375
const CARD_H = 560

// ─── ShareCardView ────────────────────────────────────────────────────────────
// Pure presentational component — rendered off-screen for capture.

interface ShareCardViewProps {
  sr: number
  streakDays: number
  totalRounds: number
}

function ShareCardView({ sr, streakDays, totalRounds }: ShareCardViewProps) {
  const level = getLevel(sr)
  const { band } = getLevelBand(sr)
  const levelColor = levelColors[level]
  const srDisplay = Math.round(sr)

  return (
    <View style={card.root}>
      {/* Background grid decoration */}
      <View style={card.grid} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[card.gridLine, { top: `${(i + 1) * 12}%` as any }]} />
        ))}
      </View>

      {/* Top: Dojo wordmark */}
      <View style={card.header}>
        <Text style={card.wordmark}>DOJO</Text>
        <Text style={card.tagline}>Trade · Train · Improve</Text>
      </View>

      {/* SR hero */}
      <View style={card.srSection}>
        <Text style={card.srLabel}>SKILL RATING</Text>
        <Text style={[card.srValue, { color: levelColor }]}>{srDisplay}</Text>
        <View style={[card.levelPill, { borderColor: levelColor }]}>
          <Text style={[card.levelText, { color: levelColor }]}>{level.toUpperCase()}</Text>
        </View>
      </View>

      {/* SR bar */}
      <View style={card.barWrap}>
        <SRBar sr={sr} showLabels compact style={{ width: '100%' }} />
      </View>

      {/* Stats row */}
      <View style={card.statsRow}>
        <View style={card.stat}>
          <Text style={card.statVal}>{totalRounds}</Text>
          <Text style={card.statLabel}>SESSIONS</Text>
        </View>
        {streakDays > 0 && (
          <View style={[card.stat, card.statDivider]}>
            <Text style={[card.statVal, { color: colors.warn }]}>{streakDays}</Text>
            <Text style={card.statLabel}>STREAK</Text>
          </View>
        )}
        <View style={[card.stat, streakDays > 0 && card.statDivider]}>
          <Text style={[card.statVal, { color: colors.brand }]}>
            {band.level === 'Legend' ? '★' : `${Math.round((sr / band.max) * 100)}%`}
          </Text>
          <Text style={card.statLabel}>LEVEL</Text>
        </View>
      </View>

      {/* Footer disclaimer */}
      <View style={card.footer}>
        <Text style={card.disclaimer}>
          Educational simulation · Results do not reflect real trading performance
        </Text>
        <Text style={card.dojoUrl}>dojo.app</Text>
      </View>
    </View>
  )
}

const card = StyleSheet.create({
  root: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: colors.bg0,
    borderRadius: 24,
    overflow: 'hidden',
    padding: space.xl,
    justifyContent: 'space-between',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.text,
  },
  header: {
    alignItems: 'flex-start',
  },
  wordmark: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: 6,
    color: colors.text,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  srSection: {
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  srLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.muted,
    marginBottom: space.sm,
  },
  srValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 96,
    lineHeight: 96,
    letterSpacing: -4,
    fontVariant: ['tabular-nums'],
  },
  levelPill: {
    marginTop: space.md,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  levelText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    letterSpacing: 3,
  },
  barWrap: {
    paddingHorizontal: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
    paddingVertical: space.md,
  },
  stat: {
    alignItems: 'center',
    minWidth: 60,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    paddingLeft: space.xl,
  },
  statVal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 2,
    color: colors.muted,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: `${colors.muted}66`,
    textAlign: 'center',
    lineHeight: 13,
  },
  dojoUrl: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 10,
    color: `${colors.muted}44`,
    letterSpacing: 1,
  },
})

// ─── useShareCard hook ────────────────────────────────────────────────────────

export function useShareCard(sr: number, streakDays: number, totalRounds: number) {
  const ref = useRef<ViewShot>(null)
  const [sharing, setSharing] = useState(false)

  const share = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    haptics.confirm()

    try {
      if (!ref.current) {
        Alert.alert('Error', 'Card not ready. Please try again.')
        setSharing(false)
        return
      }

      const available = await ExpoSharing.isAvailableAsync()

      // Capture the off-screen card view
      const uri = await (ref.current as any).capture()

      if (available) {
        await ExpoSharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your Dojo rating',
        })
      } else {
        // Fallback: native Share sheet (text only)
        await Share.share({
          message: `My Dojo Skill Rating: ${Math.round(sr)} — Level ${getLevel(sr)}\nEducational simulation only.`,
        })
      }
    } catch (err: any) {
      // User dismissed the share sheet — not an error
      if (!err?.message?.toLowerCase().includes('cancel')) {
        Alert.alert('Share failed', 'Could not export the card. Please try again.')
        haptics.error()
      }
    } finally {
      setSharing(false)
    }
  }, [sharing, sr])

  const cardView = (
    <ViewShot
      ref={ref}
      options={{ format: 'png', quality: 1.0, width: CARD_W * 2, height: CARD_H * 2 }}
      style={styles.offscreen}
    >
      <ShareCardView sr={sr} streakDays={streakDays} totalRounds={totalRounds} />
    </ViewShot>
  )

  return { share, sharing, cardView }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: CARD_W,
    height: CARD_H,
  },
})
