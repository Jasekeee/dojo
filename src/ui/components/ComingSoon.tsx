import React from 'react'
import { View } from 'react-native'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { space } from '@/src/ui/theme'

export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl }}>
        <Text variant="display">{title}</Text>
        <Text variant="body" style={{ textAlign: 'center' }}>
          {subtitle}
        </Text>
      </View>
    </Screen>
  )
}
