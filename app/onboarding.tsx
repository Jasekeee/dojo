/**
 * Onboarding — world-class redesign.
 *
 * Architecture decisions:
 * - AnimatedDot is a stable component (no hooks in .map)
 * - Index tracking via onMomentumScrollEnd, not worklet state update
 * - scrollX SharedValue drives dot animation only (UI thread)
 * - Navigation guard (navigating ref) prevents double-fire
 * - useSafeAreaInsets for correct top/bottom safe areas
 * - isReduceMotionEnabled checked at call sites
 * - Each illustration is a pure component with no hooks
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import React, { useCallback, useRef, useState } from 'react'
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { isReduceMotionEnabled } from '@/src/ui/motion'
import { colors, radius, space } from '@/src/ui/theme'
import { episodes } from '@/src/content/episodes'

// ─── Persistence ────────────────────────────────────────────────────────────

const ONBOARDING_KEY = '@dojo/onboarding/v1'

export async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1')
}

export async function isOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1'
}

// ─── Slide data ──────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'train',
    step: '01',
    category: 'TRAIN YOUR INSTINCTS',
    headline: 'Read the chart.\nNot the noise.',
    body: 'Real historical setups. Go long, short, or skip. The chart plays forward and scores your decision.',
    accent: colors.brand,
  },
  {
    id: 'discipline',
    step: '02',
    category: 'MASTER YOUR DISCIPLINE',
    headline: 'Every entry needs\na plan.',
    body: 'Set your position size, stop loss, and target before you commit. No plan, no trade.',
    accent: colors.warn,
  },
  {
    id: 'skill',
    step: '03',
    category: 'PROVE YOUR SKILL',
    headline: 'Build a record\nyou can verify.',
    body: 'Every decision updates your Skill Rating. Track your discipline, selectivity, and edge over time.',
    accent: colors.gain,
  },
] as const

type SlideId = typeof SLIDES[number]['id']

// ─── Illustrations ───────────────────────────────────────────────────────────

// Hardcoded candle pattern: volatile chart with rising trend.
// g=green, b=body height fraction, wt=wick top, wb=wick bottom
const CANDLE_DATA = [
  { g: false, b: 0.28, wt: 0.12, wb: 0.08 },
  { g: false, b: 0.22, wt: 0.08, wb: 0.14 },
  { g: true,  b: 0.30, wt: 0.14, wb: 0.07 },
  { g: false, b: 0.18, wt: 0.06, wb: 0.16 },
  { g: true,  b: 0.38, wt: 0.16, wb: 0.08 },
  { g: true,  b: 0.44, wt: 0.18, wb: 0.08 },
  { g: false, b: 0.26, wt: 0.07, wb: 0.20 },
  { g: true,  b: 0.52, wt: 0.20, wb: 0.09 },
  { g: true,  b: 0.60, wt: 0.22, wb: 0.08 },
  { g: false, b: 0.32, wt: 0.10, wb: 0.24 },
  { g: true,  b: 0.70, wt: 0.24, wb: 0.09 },
  { g: true,  b: 0.80, wt: 0.28, wb: 0.07 },
] as const

function ChartIllustration() {
  const H = 140
  const candleCount = CANDLE_DATA.length
  const totalGap = 6 * (candleCount - 1)
  const candleW = Math.floor((CHART_W - totalGap) / candleCount)

  return (
    <View style={[illStyles.wrap, { height: H }]}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <View
          key={pct}
          style={[illStyles.gridLine, { bottom: H * pct }]}
        />
      ))}

      {/* Candles */}
      <View style={illStyles.candleRow}>
        {CANDLE_DATA.map((c, i) => {
          const color = c.g ? colors.gain : colors.loss
          const bodyH = Math.max(2, c.b * H)
          const wickTH = c.wt * H
          const wickBH = c.wb * H
          const isLast = i === candleCount - 1

          return (
            <View
              key={i}
              style={[illStyles.candleWrap, { width: candleW, height: H }]}
            >
              {/* Top wick */}
              <View style={[illStyles.wick, {
                width: 1.5,
                height: wickTH,
                backgroundColor: color,
                opacity: isLast ? 1 : 0.45,
                alignSelf: 'center',
              }]} />
              {/* Body */}
              <View style={[{
                width: candleW,
                height: bodyH,
                backgroundColor: color,
                borderRadius: 2,
                opacity: isLast ? 1 : c.g ? 0.65 : 0.5,
                shadowColor: isLast ? color : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
                elevation: isLast ? 4 : 0,
              }]} />
              {/* Bottom wick */}
              <View style={[illStyles.wick, {
                width: 1.5,
                height: wickBH,
                backgroundColor: color,
                opacity: isLast ? 1 : 0.45,
                alignSelf: 'center',
              }]} />
            </View>
          )
        })}
      </View>
    </View>
  )
}

function DisciplineIllustration() {
  return (
    <View style={[illStyles.wrap, { height: 140, justifyContent: 'space-between', paddingVertical: 8 }]}>
      {/* TARGET line */}
      <View style={illStyles.tradeLine}>
        <View style={[illStyles.tradeLineBar, { backgroundColor: colors.gain }]} />
        <View style={[illStyles.tradeBadge, { backgroundColor: `${colors.gain}18`, borderColor: `${colors.gain}40` }]}>
          <Text style={[illStyles.tradeBadgeText, { color: colors.gain }]}>TARGET  +50%</Text>
        </View>
      </View>

      {/* ENTRY line */}
      <View style={illStyles.tradeLine}>
        <View style={[illStyles.tradeLineBar, {
          backgroundColor: colors.muted,
          opacity: 0.35,
          borderStyle: 'dashed',
        }]} />
        <View style={[illStyles.tradeBadge, { backgroundColor: `${colors.muted}12`, borderColor: `${colors.muted}25` }]}>
          <Text style={[illStyles.tradeBadgeText, { color: colors.muted }]}>ENTRY</Text>
        </View>
      </View>

      {/* STOP line */}
      <View style={illStyles.tradeLine}>
        <View style={[illStyles.tradeLineBar, { backgroundColor: colors.loss }]} />
        <View style={[illStyles.tradeBadge, { backgroundColor: `${colors.loss}18`, borderColor: `${colors.loss}40` }]}>
          <Text style={[illStyles.tradeBadgeText, { color: colors.loss }]}>STOP  −20%</Text>
        </View>
      </View>
    </View>
  )
}

function SkillIllustration() {
  const srValue = 847
  const srPct = srValue / 1000

  return (
    <View style={[illStyles.wrap, { height: 140, alignItems: 'flex-start', justifyContent: 'flex-end' }]}>
      {/* Level badge */}
      <View style={[illStyles.levelBadge]}>
        <Text style={illStyles.levelText}>SNIPER</Text>
      </View>

      {/* Big SR number */}
      <Text style={illStyles.srNumber}>{srValue}</Text>
      <Text style={illStyles.srLabel}>SKILL RATING</Text>

      {/* Progress bar */}
      <View style={illStyles.srBarTrack}>
        <Animated.View
          style={[illStyles.srBarFill, {
            width: `${srPct * 100}%` as any,
          }]}
        />
      </View>
      <Text style={illStyles.srRange}>0 ─────────────────────── 1000</Text>
    </View>
  )
}

const CHART_W = Dimensions.get('window').width - space.lg * 2

const illStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.line,
    opacity: 0.5,
  },
  candleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  candleWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'column',
  },
  wick: {
    borderRadius: 1,
  },

  tradeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  tradeLineBar: {
    flex: 1,
    height: 1.5,
    borderRadius: 1,
    opacity: 0.7,
  },
  tradeBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
  },
  tradeBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  levelBadge: {
    backgroundColor: `${colors.gain}18`,
    borderWidth: 1,
    borderColor: `${colors.gain}40`,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
    marginBottom: space.sm,
  },
  levelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.gain,
  },
  srNumber: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
    color: colors.text,
    fontVariant: ['tabular-nums'] as any,
  },
  srLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.muted,
    marginTop: 2,
    marginBottom: space.md,
  },
  srBarTrack: {
    width: '100%',
    height: 3,
    backgroundColor: colors.bg2,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: space.xs,
  },
  srBarFill: {
    height: 3,
    backgroundColor: colors.gain,
    borderRadius: 2,
    shadowColor: colors.gain,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 2,
  },
  srRange: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: colors.muted,
    opacity: 0.4,
    letterSpacing: 0.5,
  },
})

// ─── Dot indicator ────────────────────────────────────────────────────────────
// Extracted as stable component — no hooks in .map()

const { width: SCREEN_W } = Dimensions.get('window')

function AnimatedDot({
  index,
  scrollX,
  accent,
}: {
  index: number
  scrollX: SharedValue<number>
  accent: string
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * SCREEN_W, index * SCREEN_W, (index + 1) * SCREEN_W]
    const w = interpolate(scrollX.value, inputRange, [5, 18, 5], 'clamp')
    const opacity = interpolate(scrollX.value, inputRange, [0.25, 1, 0.25], 'clamp')
    return { width: w, opacity }
  })
  return <Animated.View style={[dotStyles.dot, { backgroundColor: accent }, animStyle]} />
}

const dotStyles = StyleSheet.create({
  dot: { height: 5, borderRadius: 3 },
})

// ─── Slide content — stable component, no hooks ───────────────────────────────

const ILLUSTRATIONS: Record<SlideId, React.ComponentType> = {
  train: ChartIllustration,
  discipline: DisciplineIllustration,
  skill: SkillIllustration,
}

function SlideContent({ slide }: { slide: typeof SLIDES[number] }) {
  const Illustration = ILLUSTRATIONS[slide.id]
  return (
    <View style={slideStyles.container}>
      {/* Illustration */}
      <View style={slideStyles.illustrationWrap}>
        <Illustration />
      </View>

      {/* Text block */}
      <View style={slideStyles.textBlock}>
        <View style={[slideStyles.stepRow]}>
          <View style={[slideStyles.stepLine, { backgroundColor: slide.accent }]} />
          <Text style={[slideStyles.stepLabel, { color: slide.accent }]}>
            {slide.step}
          </Text>
          <Text style={[slideStyles.categoryLabel, { color: slide.accent }]}>
            {slide.category}
          </Text>
        </View>

        <Text style={slideStyles.headline}>{slide.headline}</Text>
        <Text style={slideStyles.body}>{slide.body}</Text>
      </View>
    </View>
  )
}

const slideStyles = StyleSheet.create({
  container: {
    width: SCREEN_W,
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.xxl,
  },
  illustrationWrap: {
    flex: 0,
  },
  textBlock: {
    flex: 1,
    gap: space.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stepLine: {
    width: 16,
    height: 1.5,
    borderRadius: 1,
    opacity: 0.8,
  },
  stepLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  categoryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: colors.text,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.1,
    color: colors.muted,
  },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollX = useSharedValue(0)
  const scrollRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  // Guard against double navigation (async race)
  const navigating = useRef(false)

  // scrollX updated on UI thread for dot animation; index tracked via JS event
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x
    },
  })

  const onPageSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
      setCurrentIndex(idx)
    },
    [],
  )

  const goTo = useCallback((idx: number) => {
    scrollRef.current?.scrollTo({
      x: idx * SCREEN_W,
      animated: !isReduceMotionEnabled(),
    })
    setCurrentIndex(idx)
  }, [])

  const goNext = useCallback(async () => {
    if (navigating.current) return
    const isLast = currentIndex === SLIDES.length - 1

    if (!isLast) {
      haptics.select()
      goTo(currentIndex + 1)
      return
    }

    // Last slide → complete onboarding
    navigating.current = true
    haptics.confirm()
    try {
      await markOnboardingDone()
      const ep = episodes[Math.floor(Math.random() * Math.min(20, episodes.length))]
      router.replace({ pathname: '/round', params: { episodeId: ep.id } })
    } catch {
      navigating.current = false
    }
  }, [currentIndex, goTo, router])

  const goBack = useCallback(() => {
    if (currentIndex === 0) return
    haptics.select()
    goTo(currentIndex - 1)
  }, [currentIndex, goTo])

  const skip = useCallback(async () => {
    if (navigating.current) return
    navigating.current = true
    haptics.select()
    try {
      await markOnboardingDone()
      router.replace('/(tabs)/train')
    } catch {
      navigating.current = false
    }
  }, [router])

  const isLast = currentIndex === SLIDES.length - 1
  const currentSlide = SLIDES[currentIndex]

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        {/* Back — visible on slides 2+ */}
        {currentIndex > 0 ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <Pressable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.navTextMuted}>← Back</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ width: 52 }} />
        )}

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <AnimatedDot key={s.id} index={i} scrollX={scrollX} accent={s.accent} />
          ))}
        </View>

        {/* Skip — hidden on last slide */}
        {!isLast ? (
          <Pressable
            onPress={skip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.navTextMuted}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Slides */}
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onPageSettle}
        onScrollEndDrag={onPageSettle}
        decelerationRate="fast"
        style={styles.scrollView}
        contentContainerStyle={{ flexGrow: 0 }}
      >
        {SLIDES.map((s) => (
          <SlideContent key={s.id} slide={s} />
        ))}
      </Animated.ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {isLast && (
          <Animated.View
            entering={isReduceMotionEnabled() ? FadeIn.duration(1) : FadeIn.duration(250)}
            style={styles.disclaimer}
          >
            <Text style={styles.disclaimerText}>
              Educational simulation. Not financial advice.{'\n'}
              Past performance doesn't predict future results.
            </Text>
          </Animated.View>
        )}

        <PrimaryButton
          label={isLast ? 'Start training →' : 'Next'}
          onPress={goNext}
        />

        {/* Slide step indicator below button */}
        <View style={styles.stepCounter}>
          <Text style={styles.stepCounterText}>
            {currentIndex + 1} of {SLIDES.length}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    height: 52,
  },
  dots: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  navTextMuted: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: colors.muted,
    letterSpacing: 0.1,
  },
  scrollView: {
    flex: 1,
  },
  bottom: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  disclaimer: {
    backgroundColor: colors.bg2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  disclaimerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
  stepCounter: {
    alignItems: 'center',
    paddingBottom: space.xs,
  },
  stepCounterText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.muted,
    opacity: 0.4,
    letterSpacing: 0.5,
  },
})
