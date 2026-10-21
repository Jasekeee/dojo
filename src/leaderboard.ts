import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
const DEVICE_ID_KEY     = '@dojo/device_id'

// Returns null client silently if keys not set (dev without Supabase)
function makeClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: AsyncStorage, autoRefreshToken: false, persistSession: false },
  })
}

const supabase = makeClient()

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank:         number
  id:           string
  id_type:      'wallet' | 'device'
  display_name: string
  sr:           number
  level:        string
  streak_days:  number
  total_rounds: number
  updated_at:   string
}

// ─── Device ID ────────────────────────────────────────────────────────────────

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  await AsyncStorage.setItem(DEVICE_ID_KEY, id)
  return id
}

function shortenWallet(addr: string): string {
  return addr.slice(0, 4) + '…' + addr.slice(-4)
}

// ─── Submit score ──────────────────────────────────────────────────────────────

export async function submitLeaderboardScore(params: {
  walletAddress?: string
  sr:            number
  level:         string
  streakDays:    number
  totalRounds:   number
}): Promise<void> {
  if (!supabase) return

  const { walletAddress, sr, level, streakDays, totalRounds } = params
  const id = walletAddress ?? (await getOrCreateDeviceId())
  const idType: 'wallet' | 'device' = walletAddress ? 'wallet' : 'device'
  const displayName = walletAddress ? shortenWallet(walletAddress) : `Player #${id.slice(-5)}`

  await supabase.from('leaderboard').upsert({
    id,
    id_type:      idType,
    display_name: displayName,
    sr:           Math.round(sr),
    level,
    streak_days:  streakDays,
    total_rounds: totalRounds,
    updated_at:   new Date().toISOString(),
  }, { onConflict: 'id' })
}

// ─── Fetch leaderboard ────────────────────────────────────────────────────────

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  if (!supabase) return MOCK_DATA

  try {
    const fetchPromise = supabase
      .from('leaderboard')
      .select('*')
      .order('sr', { ascending: false })
      .limit(limit)

    const timeoutPromise = new Promise<{ data: null; error: Error }>((res) =>
      setTimeout(() => res({ data: null, error: new Error('timeout') }), 5000),
    )

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise])
    if (error || !data || data.length === 0) return MOCK_DATA
    return data.map((row: any, i: number) => ({ ...row, rank: i + 1 }))
  } catch {
    return MOCK_DATA
  }
}

export async function fetchMyRank(id: string): Promise<number | null> {
  if (!supabase) return null

  const { count } = await supabase
    .from('leaderboard')
    .select('*', { count: 'exact', head: true })
    .gt('sr', (await supabase.from('leaderboard').select('sr').eq('id', id).single()).data?.sr ?? 0)

  return count !== null ? count + 1 : null
}

// ─── Mock data (shown when Supabase not configured) ───────────────────────────

const MOCK_DATA: LeaderboardEntry[] = [
  { rank: 1, id: 'mock1', id_type: 'wallet', display_name: 'Orca…1337', sr: 847, level: 'Sniper',  streak_days: 21, total_rounds: 340, updated_at: '' },
  { rank: 2, id: 'mock2', id_type: 'wallet', display_name: 'Sol…4200',  sr: 823, level: 'Sniper',  streak_days: 14, total_rounds: 289, updated_at: '' },
  { rank: 3, id: 'mock3', id_type: 'device', display_name: 'Player #a8f2', sr: 791, level: 'Sniper', streak_days: 9, total_rounds: 201, updated_at: '' },
  { rank: 4, id: 'mock4', id_type: 'wallet', display_name: 'Bonk…9999', sr: 744, level: 'Sniper',  streak_days: 7,  total_rounds: 178, updated_at: '' },
  { rank: 5, id: 'mock5', id_type: 'device', display_name: 'Player #c3d1', sr: 721, level: 'Sniper', streak_days: 5, total_rounds: 155, updated_at: '' },
  { rank: 6, id: 'mock6', id_type: 'wallet', display_name: 'Jup…2468',  sr: 698, level: 'Trader',  streak_days: 12, total_rounds: 210, updated_at: '' },
  { rank: 7, id: 'mock7', id_type: 'device', display_name: 'Player #f9e0', sr: 672, level: 'Trader', streak_days: 3, total_rounds: 130, updated_at: '' },
  { rank: 8, id: 'mock8', id_type: 'wallet', display_name: 'Wif…5555',  sr: 651, level: 'Trader',  streak_days: 6,  total_rounds: 142, updated_at: '' },
  { rank: 9, id: 'mock9', id_type: 'device', display_name: 'Player #b2a4', sr: 630, level: 'Trader', streak_days: 2, total_rounds: 98,  updated_at: '' },
  { rank: 10, id: 'mock10', id_type: 'wallet', display_name: 'Pyth…1111', sr: 614, level: 'Trader', streak_days: 4, total_rounds: 119, updated_at: '' },
]
