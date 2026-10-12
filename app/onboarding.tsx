import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, space } from '@/src/ui/theme'
import { episodes } from '@/src/content/episodes'

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
    label: '01',
    title: 'Train like a\npro trader',
    body: 'Real charts. Real patterns. Zero money at risk. Make buy/skip decisions on historical crypto setups and see exactly what happened next.',
  },
  {
    label: '02',
    title: 'Time Machine',
    body: 'It\'s Nov 2022. A major exchange just froze withdrawals. Here\'s the SOL chart. What do you do?\n\nMake the call — then see the real outcome.',
  },
  {
    label: '03',
    title: 'Build a\nverified edge',
    body: 'Your Skill Rating tracks every decision. Once you\'ve trained, certify your score on Solana — proof that can\'t be faked.',
    isLast: true,
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const current = SLIDES[slide]

  const next = async () => {
    haptics.select()
    if (!current.isLast) {
      setSlide(slide + 1)
      return
    }
    await markOnboardingDone()
    // Go straight into first episode (onboarding rule: play before wallet prompt)
    const ep = episodes[Math.floor(Math.random() * Math.min(20, episodes.length))]
    router.replace({
      pathname: '/round',
      params: { episodeId: ep.id },
    })
  }

  const skip = async () => {
    await markOnboardingDone()
    router.replace('/(tabs)/train')
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Skip */}
        <View style={styles.topRow}>
          <Text variant="label" style={{ color: colors.muted }} onPress={skip}>
            Skip
          </Text>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text variant="label" style={{ color: colors.brand }}>{current.label}</Text>
          <Text variant="display" style={styles.title}>{current.title}</Text>
          <Text variant="body" style={styles.body}>{current.body}</Text>
        </View>

        {/* Disclaimer on last slide */}
        {current.isLast && (
          <Card style={styles.disclaimer}>
            <Text variant="label" style={{ color: colors.muted, textAlign: 'center', fontSize: 11 }}>
              Educational simulation. Not financial advice.{'\n'}Past performance doesn't predict future results.
            </Text>
          </Card>
        )}

        <PrimaryButton
          label={current.isLast ? 'Start training' : 'Next'}
          onPress={next}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.lg, gap: space.lg, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { width: 20, backgroundColor: colors.brand },
  content: { flex: 1, justifyContent: 'center', gap: space.lg },
  title: { fontSize: 40, lineHeight: 48 },
  body: { color: colors.muted, lineHeight: 24 },
  disclaimer: { paddingVertical: space.md },
})
