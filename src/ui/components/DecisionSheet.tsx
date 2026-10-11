import React, { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { SegmentedChips } from '@/src/ui/components/SegmentedChips'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, radius, space } from '@/src/ui/theme'

export interface Decision {
  action: 'buy' | 'skip'
  size: number
  stopPct?: number
  targetPct?: number
}

const SIZE_OPTIONS = [
  { label: '25%', value: '0.25' },
  { label: '50%', value: '0.5' },
  { label: '100%', value: '1' },
]
const STOP_OPTIONS = [
  { label: '-10%', value: '0.1' },
  { label: '-20%', value: '0.2' },
  { label: '-30%', value: '0.3' },
  { label: 'None', value: 'none' },
]
const TARGET_OPTIONS = [
  { label: '+25%', value: '0.25' },
  { label: '+50%', value: '0.5' },
  { label: '+100%', value: '1' },
  { label: 'None', value: 'none' },
]

export function DecisionSheet({ onDecide }: { onDecide: (decision: Decision) => void }) {
  const [size, setSize] = useState('0.5')
  const [stop, setStop] = useState('0.2')
  const [target, setTarget] = useState('0.5')

  const buy = () => {
    haptics.confirm()
    onDecide({
      action: 'buy',
      size: Number(size),
      stopPct: stop === 'none' ? undefined : Number(stop),
      targetPct: target === 'none' ? undefined : Number(target),
    })
  }

  const skip = () => {
    haptics.select()
    onDecide({ action: 'skip', size: 0 })
  }

  return (
    <Card style={styles.sheet}>
      <View style={styles.row}>
        <Text variant="label">Size</Text>
        <SegmentedChips options={SIZE_OPTIONS} value={size} onChange={setSize} />
      </View>
      <View style={styles.row}>
        <Text variant="label">Stop</Text>
        <SegmentedChips options={STOP_OPTIONS} value={stop} onChange={setStop} />
      </View>
      <View style={styles.row}>
        <Text variant="label">Target</Text>
        <SegmentedChips options={TARGET_OPTIONS} value={target} onChange={setTarget} />
      </View>
      <View style={styles.actions}>
        <Pressable onPress={skip} style={styles.skipButton}>
          <Text variant="title" style={{ color: colors.muted }}>
            Skip
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Buy" onPress={buy} />
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  sheet: { gap: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  row: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.md, alignItems: 'center', marginTop: space.sm },
  skipButton: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
})
