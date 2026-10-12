import { Tabs } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'
import { colors, fonts, space } from '@/src/ui/theme'
import { haptics } from '@/src/ui/haptics'

type IconName = 'bolt.fill' | 'chart.bar.fill' | 'clock.fill' | 'person.fill' | 'gearshape.fill' | 'ladybug.fill'

const HIDDEN = { tabBarItemStyle: { display: 'none' as const } }

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <UiIconSymbol
        size={20}
        name={name}
        color={focused ? colors.gold : colors.muted}
      />
      {focused && <View style={styles.activeDot} />}
    </View>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: [
          styles.tabBar,
          // Ensure labels never touch the Android gesture bar
          { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0) },
        ],
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
          tabBarIcon: ({ focused }) => <TabIcon name="bolt.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="time-machine"
        options={{
          title: 'Archive',
          tabBarIcon: ({ focused }) => <TabIcon name="clock.fill" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person.fill" focused={focused} />,
        }}
      />

      <Tabs.Screen name="account"  options={HIDDEN} />
      <Tabs.Screen name="settings" options={HIDDEN} />
      <Tabs.Screen name="demo"     options={HIDDEN} />
      <Tabs.Screen name="episodes" options={HIDDEN} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg1,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    height: Platform.OS === 'ios' ? 84 : 60,
    paddingTop: space.xs,
  },
  tabLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 0.15,
    marginTop: 1,
  },
  tabItem: { paddingTop: space.xs },
  iconWrap: {
    alignItems: 'center',
    gap: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
})
