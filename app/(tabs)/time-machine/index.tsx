import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { campaigns, getCampaignEpisodes, type Campaign } from '@/src/content/campaigns'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { haptics } from '@/src/ui/haptics'
import { colors, radius, space } from '@/src/ui/theme'
import { springs } from '@/src/ui/motion'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const CAMPAIGN_COLORS: Record<string, string> = {
  ftx_collapse_2022: '#FF5C7A',
  luna_crash_2022: '#FF5C7A',
  aug_flush_2024: '#FFB84D',
  tariff_shock_2025: '#FFB84D',
  liquidation_cascade_2025: '#8B5CFF',
}

function CampaignCard({ camp, onPress, index }: { camp: Campaign; onPress: () => void; index: number }) {
  const pressed = useSharedValue(0)
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? 0.97 : 1, springs.snappy) }],
  }))
  const color = CAMPAIGN_COLORS[camp.id] ?? colors.brand

  return (
    <Animated.View entering={FadeInDown.duration(350).delay(index * 60).springify()}>
      <AnimatedPressable
        onPressIn={() => { pressed.value = 1 }}
        onPressOut={() => { pressed.value = 0 }}
        onPress={onPress}
        style={animStyle}
      >
        <Card variant="elevated" style={styles.campaignCard}>
          {/* Colored left border */}
          <View style={[styles.colorBar, { backgroundColor: color }]} />

          <View style={styles.campaignContent}>
            <View style={styles.campaignTop}>
              <View style={[styles.periodBadge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
                <Text variant="caption" style={{ color, fontWeight: '700', letterSpacing: 0.5 }}>
                  {camp.period.toUpperCase()}
                </Text>
              </View>
              <Text variant="caption">
                {camp.episodeIds.length} checkpoint{camp.episodeIds.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <Text variant="title" style={styles.campaignTitle}>{camp.title}</Text>
            <Text variant="body" style={styles.campaignSubtitle}>{camp.subtitle}</Text>

            <View style={styles.campaignFooter}>
              <Text variant="caption" style={{ color: colors.brand }}>Play →</Text>
            </View>
          </View>
        </Card>
      </AnimatedPressable>
    </Animated.View>
  )
}

export default function TimeMachineScreen() {
  const router = useRouter()
  const [selected, setSelected] = useState<Campaign | null>(null)

  const startCampaign = (camp: Campaign) => {
    const eps = getCampaignEpisodes(camp)
    if (eps.length === 0) return
    haptics.confirm()
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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <View style={styles.tmLabel}>
            <Text variant="caption" style={{ color: colors.warn, fontWeight: '700', letterSpacing: 1 }}>
              TIME MACHINE
            </Text>
          </View>
          <Text variant="display" style={{ fontSize: 32, marginTop: space.sm }}>
            Real crashes.
          </Text>
          <Text variant="display" style={{ fontSize: 32, color: colors.muted }}>
            Real decisions.
          </Text>
          <Text variant="body" style={{ color: colors.muted, marginTop: space.sm, lineHeight: 22 }}>
            Would you have survived? Play through the biggest crypto events — with the actual charts.
          </Text>
        </Animated.View>

        {selected ? (
          <CampaignDetail
            campaign={selected}
            onBack={() => setSelected(null)}
            onStart={startCampaign}
          />
        ) : (
          <>
            {campaigns.map((camp, i) => (
              <CampaignCard
                key={camp.id}
                camp={camp}
                index={i}
                onPress={() => { haptics.select(); setSelected(camp) }}
              />
            ))}
          </>
        )}

        <Text variant="caption" style={styles.disclaimer}>
          Educational simulation. Not financial advice.{'\n'}Past performance doesn't predict future results.
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
  const color = CAMPAIGN_COLORS[campaign.id] ?? colors.brand

  return (
    <Animated.View entering={FadeInDown.duration(300).springify()} style={{ gap: space.lg }}>
      {/* Back */}
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text variant="label" style={{ color: colors.brand }}>← All campaigns</Text>
      </Pressable>

      {/* Hero card */}
      <Card variant="elevated" style={styles.detailHero}>
        <View style={[styles.periodBadge, { backgroundColor: `${color}18`, borderColor: `${color}40`, alignSelf: 'flex-start' }]}>
          <Text variant="caption" style={{ color, fontWeight: '700', letterSpacing: 0.5 }}>
            {campaign.period.toUpperCase()}
          </Text>
        </View>
        <Text variant="display" style={{ fontSize: 28, marginTop: space.sm }}>{campaign.title}</Text>
        <Text variant="body" style={{ color: colors.muted, marginTop: space.xs }}>{campaign.subtitle}</Text>
      </Card>

      {/* Checkpoints */}
      <Text variant="label" style={{ letterSpacing: 1 }}>CHECKPOINTS</Text>
      <View style={styles.timeline}>
        {eps.map((ep, i) => (
          <View key={ep.id} style={styles.checkpointRow}>
            {/* Timeline line + dot */}
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, { backgroundColor: color }]} />
              {i < eps.length - 1 && <View style={styles.timelineLine} />}
            </View>

            <Card style={[styles.checkpointCard, { flex: 1 }]}>
              <Text variant="caption" style={{ color, fontWeight: '700', letterSpacing: 0.5 }}>
                CHECKPOINT {i + 1}
              </Text>
              {ep.context && (
                <>
                  <Text variant="title" style={{ fontSize: 14, marginTop: 4 }}>
                    {ep.context.headline}
                  </Text>
                  <Text variant="caption" style={{ marginTop: 6, lineHeight: 18 }}>
                    {ep.context.body}
                  </Text>
                </>
              )}
            </Card>
          </View>
        ))}
      </View>

      <PrimaryButton label={`Start campaign — ${eps.length} charts`} onPress={() => onStart(campaign)} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },
  header: { gap: 2, paddingVertical: space.md },
  tmLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  campaignCard: { flexDirection: 'row', overflow: 'hidden', padding: 0 },
  colorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  campaignContent: { flex: 1, padding: space.lg, gap: space.xs },
  campaignTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  periodBadge: {
    borderRadius: radius.chip,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderWidth: 1,
  },
  campaignTitle: { fontSize: 18, marginTop: 4 },
  campaignSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  campaignFooter: { marginTop: space.xs },

  backBtn: { paddingVertical: space.sm },
  detailHero: { gap: space.xs },

  timeline: { gap: 0 },
  checkpointRow: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  timelineLeft: { alignItems: 'center', width: 20, paddingTop: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.line, marginTop: 4 },
  checkpointCard: { marginBottom: 0 },

  disclaimer: { textAlign: 'center', marginTop: space.md },
})
