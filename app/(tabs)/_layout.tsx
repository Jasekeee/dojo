import { Tabs } from 'expo-router'
import React from 'react'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'
import { colors } from '@/src/ui/theme'

const HIDDEN = { tabBarItemStyle: { display: 'none' as const } }

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg1, borderTopColor: colors.line },
      }}
    >
      {/* index just redirects to /train */}
      <Tabs.Screen name="index" options={HIDDEN} />

      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ color }) => <UiIconSymbol size={28} name="bolt.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="time-machine"
        options={{
          title: 'Time Machine',
          tabBarIcon: ({ color }) => <UiIconSymbol size={28} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <UiIconSymbol size={28} name="person.fill" color={color} />,
        }}
      />

      {/* Dev/QA screens from the scaffold + Phase 1 spike — hidden from the tab bar, still routable. */}
      <Tabs.Screen name="account" options={HIDDEN} />
      <Tabs.Screen name="settings" options={HIDDEN} />
      <Tabs.Screen name="demo" options={HIDDEN} />
      <Tabs.Screen name="episodes" options={HIDDEN} />
    </Tabs>
  )
}
