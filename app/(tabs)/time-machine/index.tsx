import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { campaigns, getCampaignEpisodes, type Campaign } from '@/src/content/campaigns'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, radius, space } from '@/src/ui/theme'

export default function TimeMachineScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<Campaign | null>(null)

  const startCampaign = (camp: Campaign) => {
    const eps = getCampaignEpisodes(camp)
    if (eps.length === 0) return
    haptics.select()
    ;(global as any).__pendingDailyIds = eps.map((e) => e.id)
    router.push({
      pathname: '/round',
      params: {
        episodeId: eps[0].id,
        sessionIndex: '0',
        sessionTotal: String(eps.length),
        returnTo: 'time-machine',
      },
    })
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="label" style={{ color: colors.brand }}>Time Machine</Text>
          <Text variant="display" style={{ fontSize: 28 }}>Real crashes.</Text>
          <Text variant="display" style={{ fontSize: 28, color: colors.muted }}>Real decisions.</Text>
        </View>

        {selected ? (
          <CampaignDetail campaign={selected} onBack={() => setSelected(null)} onStart={startCampaign} />
        ) : (
          <>
            <Text variant="title" style={{ marginBottom: space.sm }}>Select a campaign</Text>
            {campaigns.map((camp) => (
              <TouchableOpacity
                key={camp.id}
                onPress={() => { haptics.select(); setSelected(camp) }}
                activeOpacity={0.75}
              >
                <Card style={styles.campaignCard}>
                  <View style={styles.campaignTop}>
                    <View style={styles.periodBadge}>
                      <Text variant="label" style={{ color: colors.brand, fontSize: 11 }}>
                        {camp.period}
                      </Text>
                    </View>
                    <Text variant="label" style={{ color: colors.muted }}>
                      {camp.episodeIds.length} checkpoint{camp.episodeIds.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text variant="title" style={{ marginTop: space.xs }}>{camp.title}</Text>
                  <Text variant="body" style={{ color: colors.muted, marginTop: space.xs }}>
                    {camp.subtitle}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text variant="label" style={styles.disclaimer}>
          Educational simulation. Not financial advice. Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

function CampaignDetail({
  campaign,
  onBack,
  onStart,
}: {
  campaign: Campaign
  onBack: () => void
  onStart: (c: Campaign) => void
}) {
  const eps = getCampaignEpisodes(campaign)

  return (
    <View style={{ gap: space.lg }}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text variant="label" style={{ color: colors.brand }}>← Back</Text>
      </TouchableOpacity>

      <Card>
        <Text variant="label" style={{ color: colors.brand }}>{campaign.period}</Text>
        <Text variant="display" style={{ fontSize: 28, marginTop: space.xs }}>{campaign.title}</Text>
        <Text variant="body" style={{ color: colors.muted, marginTop: space.sm }}>
          {campaign.subtitle}
        </Text>
      </Card>

      <Text variant="title">Checkpoints</Text>
      {eps.map((ep, i) => (
        <Card key={ep.id} style={styles.checkpointCard}>
          <View style={styles.checkpointRow}>
            <View style={[styles.dot, { backgroundColor: colors.brand }]} />
            <View style={{ flex: 1 }}>
              <Text variant="label">Checkpoint {i + 1}</Text>
              {ep.context && (
                <>
                  <Text variant="title" style={{ fontSize: 14, marginTop: space.xs }}>
                    {ep.context.headline}
                  </Text>
                  <Text variant="body" style={{ color: colors.muted, marginTop: space.xs, fontSize: 13 }}>
                    {ep.context.body}
                  </Text>
                </>
              )}
            </View>
          </View>
        </Card>
      ))}

      <PrimaryButton
        label={`Start — ${eps.length} charts`}
        onPress={() => onStart(campaign)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { gap: space.xs, paddingVertical: space.md },
  campaignCard: { gap: space.xs, marginBottom: 0 },
  campaignTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodBadge: {
    backgroundColor: colors.bg2,
    borderRadius: radius.chip,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
  },
  checkpointCard: { gap: space.sm },
  checkpointRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  backBtn: { paddingVertical: space.sm },
  disclaimer: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: space.md,
  },
})
