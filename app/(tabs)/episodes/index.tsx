import React, { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { AppPage } from '@/components/app-page'
import { AppText } from '@/components/app-text'
import { AppView } from '@/components/app-view'
import { EpisodeChart } from '@/components/debug/episode-chart'
import { episodes } from '@/src/content/episodes'

const SAMPLE_SIZE = 12

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy[idx])
    copy.splice(idx, 1)
  }
  return out
}

export default function EpisodesDebugScreen() {
  const picked = useMemo(() => sample(episodes, SAMPLE_SIZE), [])

  return (
    <AppPage>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        <AppText type="subtitle">Episodes debug ({episodes.length} total)</AppText>
        <AppText style={{ opacity: 0.6, fontSize: 12 }}>
          Random sample of {picked.length}. Purple dashed line = decision point (before | after).
        </AppText>
        {picked.map((ep) => (
          <AppView key={ep.id} style={{ gap: 8 }}>
            <AppText style={{ fontWeight: '600' }}>
              {ep.asset.symbol} · {ep.timeframe} · diff {ep.difficulty}
            </AppText>
            <AppText style={{ fontSize: 12, opacity: 0.7 }}>
              tags: {ep.tags.length ? ep.tags.join(', ') : '(none)'}
            </AppText>
            <EpisodeChart episode={ep} />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <AppText style={{ fontSize: 12, opacity: 0.7 }}>
                hold: {(ep.baselines.hold_return * 100).toFixed(1)}%
              </AppText>
              <AppText style={{ fontSize: 12, opacity: 0.7 }}>
                bot: {(ep.baselines.bot_return * 100).toFixed(1)}%
              </AppText>
            </View>
          </AppView>
        ))}
      </ScrollView>
    </AppPage>
  )
}
