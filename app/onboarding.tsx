import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import React, { useRef, useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, radius, space } from '@/src/ui/theme'
import { episodes } from '@/src/content/episodes'
import { Pressable } from 'react-native'

const { width } = Dimensions.get('window')

const ONBOARDING_KEY = '@dojo/onboarding/v1'

export async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1')
}

export async function isOnboardingDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1'
}

const SLIDES = [
  {
    emoji: '📊',
    label: '01 — TRAIN',
    title: 'Read charts.\nNot opinions.',
    body: 'Real historical setups. You make the call — buy or skip. Then the chart plays forward.',
    accent: colors.brand,
  },
  {
    emoji: '⚡',
    label: '02 — TIME MACHINE',
    title: 'It\'s Nov 2022.\nExchange frozen.',
    body: 'A major crypto exchange just halted withdrawals. SOL is in freefall. Here\'s the chart. What do you do?',
    accent: '#FF5C7A',
  },
  {
    emoji: '🏆',
    label: '03 — SKILL RATING',
    title: 'Earn a rating\nyou can prove.',
    body: 'Every decision updates your Skill Rating. Certify it on Solana — verifiable proof of your edge.',
    accent: '#9CFF57',
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const scrollX = useSharedValue(0)
  const scrollRef = useRef<ScrollView>(null)

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
    const newSlide = Math.round(e.contentOffset.x / width)
    setSlide(newSlide)
  })

  const goNext = async () => {
    haptics.select()
    if (slide < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (slide + 1) * width, animated: true })
    } else {
      await markOnboardingDone()
      const ep = episodes[Math.floor(Math.random() * Math.min(20, episodes.length))]
      router.replace({ pathname: '/round', params: { episodeId: ep.id } })
    }
  }

  const skip = async () => {
    await markOnboardingDone()
    router.replace('/(tabs)/train')
  }

  const current = SLIDES[slide]

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg0 }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={skip}>
          <Text variant="label" style={{ color: colors.muted }}>Skip</Text>
        </Pressable>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const dotStyle = useAnimatedStyle(() => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width]
              const width_ = interpolate(scrollX.value, inputRange, [6, 20, 6], 'clamp')
              const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], 'clamp')
              return { width: width_, opacity }
            })
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { backgroundColor: current.accent }, dotStyle]}
              />
            )
          })}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Slides */}
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {/* Big emoji */}
            <View style={[styles.emojiWrap, { backgroundColor: `${s.accent}15` }]}>
              <Text style={styles.emoji}>{s.emoji}</Text>
            </View>

            <View style={styles.slideText}>
              <Text variant="caption" style={{ color: s.accent, letterSpacing: 1.5, fontWeight: '700' }}>
                {s.label}
              </Text>
              <Text variant="display" style={styles.slideTitle}>{s.title}</Text>
              <Text variant="body" style={styles.slideBody}>{s.body}</Text>
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      {/* Bottom */}
      <View style={styles.bottom}>
        {slide === SLIDES.length - 1 && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.disclaimer}
          >
            <Text variant="caption" style={{ textAlign: 'center', lineHeight: 18 }}>
              Educational simulation. Not financial advice.{'\n'}Past performance doesn't predict future results.
            </Text>
          </Animated.View>
        )}
        <PrimaryButton
          label={slide === SLIDES.length - 1 ? 'Start training →' : 'Next'}
          onPress={goNext}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: 56,
    paddingBottom: space.md,
  },
  dots: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },

  slide: {
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    gap: space.xl,
  },
  emojiWrap: {
    width: 120,
    height: 120,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  emoji: { fontSize: 56 },
  slideText: { gap: space.md },
  slideTitle: { fontSize: 38, lineHeight: 44, letterSpacing: -1 },
  slideBody: { color: colors.muted, lineHeight: 26, fontSize: 16 },

  bottom: {
    paddingHorizontal: space.lg,
    paddingBottom: 48,
    gap: space.md,
  },
  disclaimer: {
    backgroundColor: colors.bg2,
    borderRadius: radius.card,
    padding: space.md,
  },
})
