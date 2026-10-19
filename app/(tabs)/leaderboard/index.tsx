import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { Card } from '@/src/ui/components/Card'
import { useAppState } from '@/src/state/useAppState'
import { getLevel } from '@/src/engine/rating'
import { fetchLeaderboard, getOrCreateDeviceId, type LeaderboardEntry } from '@/src/leaderboard'
import { colors, fonts, levelColors, radius, space, SCREEN_PAD } from '@/src/ui/theme'
import { getLevelColor } from '@/src/ui/levelConfig'

const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] // gold, silver, bronze

export default function LeaderboardScreen() {
  const { state } = useAppState()
  const [entries,   setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myId,      setMyId]      = useState<string | null>(null)
  const [myRank,    setMyRank]    = useState<number | null>(null)

  const level    = getLevel(state.sr)
  const levelColor = getLevelColor(level)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [data, id] = await Promise.all([fetchLeaderboard(50), getOrCreateDeviceId()])
      setEntries(data)
      setMyId(id)
      const myPos = data.findIndex((e) => e.id === id)
      setMyRank(myPos >= 0 ? myPos + 1 : null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const isMe = (entry: LeaderboardEntry) => entry.id === myId

  if (loading) {
    return (
      <Screen>
        <View style={s.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.gold}
          />
        }
      >
        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={s.title}>Global Ranks</Text>
          <View style={[s.myRankPill, { borderColor: `${levelColor}40` }]}>
            <Text style={[s.myRankText, { color: levelColor }]}>
              {myRank ? `#${myRank}` : 'Unranked'}
            </Text>
            <Text style={s.myRankSr}>  {Math.round(state.sr)} SR</Text>
          </View>
        </Animated.View>

        {/* ── Podium top 3 ── */}
        {entries.length >= 3 && (
          <Animated.View entering={FadeInDown.delay(60).duration(340)} style={s.podium}>
            {/* 2nd */}
            <PodiumItem entry={entries[1]!} podiumColor={PODIUM_COLORS[1]!} isMe={isMe(entries[1]!)} />
            {/* 1st */}
            <PodiumItem entry={entries[0]!} podiumColor={PODIUM_COLORS[0]!} isMe={isMe(entries[0]!)} tall />
            {/* 3rd */}
            <PodiumItem entry={entries[2]!} podiumColor={PODIUM_COLORS[2]!} isMe={isMe(entries[2]!)} />
          </Animated.View>
        )}

        {/* ── Rest of the list ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(360)}>
          <Card style={s.listCard}>
            {entries.slice(3).map((entry, i) => (
              <RankRow
                key={entry.id}
                entry={entry}
                isMe={isMe(entry)}
                isLast={i === entries.length - 4}
              />
            ))}
            {entries.length === 0 && (
              <Text style={s.empty}>No players yet. Complete a Daily to appear here.</Text>
            )}
          </Card>
        </Animated.View>

        {/* ── My entry (if not in top 50) ── */}
        {myRank !== null && myRank > 50 && (
          <Animated.View entering={FadeInDown.delay(180).duration(300)}>
            <Card style={[s.listCard, s.myCard]}>
              <RankRow
                entry={{ id: myId!, id_type: 'device', display_name: 'You', sr: Math.round(state.sr), level, streak_days: state.streakDays, total_rounds: state.history.length, rank: myRank, updated_at: '' }}
                isMe
                isLast
              />
            </Card>
          </Animated.View>
        )}

        <Text style={s.footer}>
          Refreshes when you complete a Daily · Educational simulation
        </Text>
      </ScrollView>
    </Screen>
  )
}

// ─── Podium item ──────────────────────────────────────────────────────────────

function PodiumItem({ entry, podiumColor, isMe, tall }: {
  entry: LeaderboardEntry
  podiumColor: string
  isMe: boolean
  tall?: boolean
}) {
  const levelColor = getLevelColor(entry.level as any)
  return (
    <View style={[s.podiumItem, tall && s.podiumTall]}>
      <View style={[s.podiumAvatar, { borderColor: podiumColor, backgroundColor: `${podiumColor}15` }]}>
        <Text style={[s.podiumAvatarText, { color: podiumColor }]}>{entry.rank}</Text>
      </View>
      {entry.id_type === 'wallet' && (
        <View style={s.verifiedDot} />
      )}
      <Text style={s.podiumName} numberOfLines={1}>{isMe ? 'You' : entry.display_name}</Text>
      <Text style={[s.podiumSr, { color: levelColor }]}>{entry.sr}</Text>
      <Text style={s.podiumLevel}>{entry.level}</Text>
      {entry.streak_days > 0 && (
        <Text style={s.podiumStreak}>🔥{entry.streak_days}</Text>
      )}
    </View>
  )
}

// ─── Rank row ─────────────────────────────────────────────────────────────────

function RankRow({ entry, isMe, isLast }: {
  entry: LeaderboardEntry
  isMe: boolean
  isLast: boolean
}) {
  const levelColor = getLevelColor(entry.level as any)
  return (
    <View style={[s.row, !isLast && s.rowBorder, isMe && s.rowMe]}>
      <Text style={[s.rowRank, entry.rank <= 10 && { color: colors.gold }]}>
        {entry.rank}
      </Text>
      <View style={s.rowMid}>
        <View style={s.rowNameRow}>
          <Text style={[s.rowName, isMe && { color: colors.text }]} numberOfLines={1}>
            {isMe ? 'You' : entry.display_name}
          </Text>
          {entry.id_type === 'wallet' && (
            <View style={s.verifiedChip}>
              <Text style={s.verifiedText}>✓</Text>
            </View>
          )}
        </View>
        {entry.streak_days > 1 && (
          <Text style={s.rowStreak}>{entry.streak_days}d streak</Text>
        )}
      </View>
      <View style={s.rowRight}>
        <Text style={[s.rowSr, { color: isMe ? levelColor : colors.text }]}>{entry.sr}</Text>
        <Text style={[s.rowLevel, { color: levelColor }]}>{entry.level}</Text>
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content:   { padding: SCREEN_PAD, gap: space.lg, paddingBottom: 100 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:     { fontFamily: fonts.serifBold, fontSize: 28, color: colors.text },
  myRankPill: { flexDirection: 'row', alignItems: 'baseline', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  myRankText: { fontFamily: fonts.displayBold, fontSize: 15, fontVariant: ['tabular-nums'] },
  myRankSr:  { fontFamily: fonts.ui, fontSize: 12, color: colors.muted },

  podium:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.sm, paddingVertical: space.md },
  podiumItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: space.md, paddingHorizontal: space.xs, backgroundColor: colors.bg1, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line },
  podiumTall: { paddingTop: space.xl, backgroundColor: colors.bg2, borderColor: `${colors.gold}30` },
  podiumAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  podiumAvatarText: { fontFamily: fonts.displayBold, fontSize: 18 },
  podiumName: { fontFamily: fonts.uiMedium, fontSize: 11, color: colors.textSub, textAlign: 'center' },
  podiumSr:   { fontFamily: fonts.displayBold, fontSize: 20, fontVariant: ['tabular-nums'] },
  podiumLevel: { fontFamily: fonts.ui, fontSize: 10, color: colors.muted, letterSpacing: 0.5 },
  podiumStreak: { fontFamily: fonts.ui, fontSize: 11, color: colors.warn },

  verifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand, position: 'absolute', top: 10, right: 10 },
  verifiedChip: { backgroundColor: `${colors.brand}20`, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  verifiedText: { fontFamily: fonts.uiMedium, fontSize: 9, color: colors.brand },

  listCard:  { padding: 0, overflow: 'hidden' },
  myCard:    { borderColor: `${colors.gold}30` },

  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: 12, gap: space.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMe:     { backgroundColor: `${colors.gold}08` },
  rowRank:   { fontFamily: fonts.displayBold, fontSize: 14, color: colors.muted, width: 28, textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowMid:    { flex: 1, gap: 2 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  rowName:   { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.textSub, flexShrink: 1 },
  rowStreak: { fontFamily: fonts.ui, fontSize: 11, color: colors.warn },
  rowRight:  { alignItems: 'flex-end', gap: 2 },
  rowSr:     { fontFamily: fonts.displayBold, fontSize: 16, fontVariant: ['tabular-nums'] },
  rowLevel:  { fontFamily: fonts.ui, fontSize: 10, letterSpacing: 0.5 },

  empty:     { fontFamily: fonts.ui, fontSize: 14, color: colors.muted, textAlign: 'center', padding: space.xl },
  footer:    { fontFamily: fonts.ui, fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 17 },
})
