import { Tabs } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'
import { colors, space } from '@/src/ui/theme'
import { haptics } from '@/src/ui/haptics'

const HIDDEN = { tabBarItemStyle: { display: 'none' as const } }

type IconName = 'bolt.fill' | 'chart.bar.fill' | 'clock.fill' | 'person.fill' | 'gearshape.fill' | 'ladybug.fill' | 'wallet.pass.fill'

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <UiIconSymbol size={22} name={name} color={focused ? colors.brand : colors.muted} />
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
      screenListeners={{
        tabPress: () => haptics.select(),
      }}
    >
      <Tabs.Screen name="index" options={HIDDEN} />

      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ focused }) => <TabIcon name={'bolt.fill'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="time-machine"
        options={{
          title: 'Time Machine',
          tabBarIcon: ({ focused }) => <TabIcon name={'clock.fill'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name={'person.fill'} focused={focused} />,
        }}
      />

      <Tabs.Screen name="account" options={HIDDEN} />
      <Tabs.Screen name="settings" options={HIDDEN} />
      <Tabs.Screen name="demo" options={HIDDEN} />
      <Tabs.Screen name="episodes" options={HIDDEN} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg1,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: space.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 16,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: Platform.OS === 'ios' ? 0 : space.xs,
  },
  tabItem: { paddingTop: space.xs },
  iconWrap: {
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  iconWrapActive: {
    backgroundColor: `${colors.brand}20`,
  },
})
