import React, { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { isOnboardingDone } from '@/app/onboarding'

export default function TabsIndexScreen() {
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(true)

  useEffect(() => {
    isOnboardingDone().then((d) => {
      setDone(d)
      setReady(true)
    })
  }, [])

  if (!ready) return null

  return <Redirect href={done ? '/(tabs)/train' : ('/onboarding' as any)} />
}
