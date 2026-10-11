import { Stack } from 'expo-router'
import React from 'react'

export default function EpisodesLayout() {
  return (
    <Stack screenOptions={{ headerTitle: 'Episodes' }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
