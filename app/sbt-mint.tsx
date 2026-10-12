/**
 * Temporary devnet test screen for SBT minting.
 * Accessed via router.push('/sbt-mint?level=Trader&sr=507')
 * Will be replaced by the proper badge sheet in Phase 4.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import { Connection, PublicKey } from '@solana/web3.js'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Card } from '@/src/ui/components/Card'
import { colors, fonts, space, SCREEN_PAD } from '@/src/ui/theme'
import { haptics } from '@/src/ui/haptics'
import {
  buildSbtTransactions,
  findExistingBadge,
  isEligible,
  sbtExplorerUrl,
  sbtMintExplorerUrl,
  SBT_RPC,
  SBT_CLUSTER,
  type SbtLevel,
} from '@/src/chain/sbt'
import { flags } from '@/src/features/flags'

const MINT_STATE_KEY = (level: string, wallet: string) =>
  `@dojo/sbt_mint/${level}/${wallet}`

type Step = 'idle' | 'checking' | 'tx1' | 'tx2' | 'confirming' | 'done' | 'error'

export default function SbtMintScreen() {
  const router  = useRouter()
  const params  = useLocalSearchParams<{ level?: string; sr?: string }>()
  const level   = (params.level ?? 'Rookie') as SbtLevel
  const sr      = Number(params.sr ?? 0)

  const { connect, account, signAndSendTransactions } = useMobileWallet()
  const conn = React.useMemo(() => new Connection(SBT_RPC, 'confirmed'), [])

  const [step,     setStep]     = useState<Step>('idle')
  const [error,    setError]    = useState<string | null>(null)
  const [sig1,     setSig1]     = useState<string | null>(null)
  const [sig2,     setSig2]     = useState<string | null>(null)
  const [mintAddr, setMintAddr] = useState<string | null>(null)
  const [existing, setExisting] = useState<string | null>(null)
  const guard = useRef(false)

  // Check for existing badge and cached partial mint on mount
  useEffect(() => {
    if (!flags.levelSbt) return
    void (async () => {
      if (!account) return
      setStep('checking')
      try {
        const found = await findExistingBadge(conn, account.publicKey, level)
        if (found) { setExisting(found); setStep('done') }
        else {
          // Check if Tx1 already succeeded (resume case)
          const cached = await AsyncStorage.getItem(MINT_STATE_KEY(level, account.publicKey.toString()))
          if (cached) {
            const { mintPublicKey, sig1: s1 } = JSON.parse(cached)
            setMintAddr(mintPublicKey)
            setSig1(s1)
            setStep('tx2') // resume from Tx2
          } else {
            setStep('idle')
          }
        }
      } catch {
        setStep('idle')
      }
    })()
  }, [account?.address]) // eslint-disable-line react-hooks/exhaustive-deps

  const mint = async () => {
    if (guard.current) return
    guard.current = true
    setError(null)

    try {
      // Connect wallet if needed
      let pubkey: PublicKey
      if (account) {
        pubkey = account.publicKey
      } else {
        const connected = await connect()
        pubkey = connected.publicKey
      }

      if (!isEligible(sr, level)) throw new Error(`SR ${sr} is below the ${level} threshold`)

      // Duplicate check
      setStep('checking')
      const found = await findExistingBadge(conn, pubkey, level)
      if (found) { setExisting(found); setStep('done'); guard.current = false; return }

      // Build both transactions
      const { setupTx, mintTx, mintPublicKey } = await buildSbtTransactions(conn, pubkey, level, sr)
      const mintStr = mintPublicKey.toString()
      setMintAddr(mintStr)

      // ── Tx1: mint account setup ──────────────────────────────────────────────
      setStep('tx1')
      haptics.select()
      const { context: { slot: slot1 } } = await conn.getLatestBlockhashAndContext()
      const s1 = await signAndSendTransactions(setupTx, slot1)
      setSig1(s1)
      // Cache mint pubkey so user can resume if Tx2 fails
      await AsyncStorage.setItem(MINT_STATE_KEY(level, pubkey.toString()),
        JSON.stringify({ mintPublicKey: mintStr, sig1: s1 }))

      // Confirm Tx1 before sending Tx2
      setStep('confirming')
      const { blockhash: bh, lastValidBlockHeight: lvbh } = await conn.getLatestBlockhash()
      await conn.confirmTransaction({ signature: s1, blockhash: bh, lastValidBlockHeight: lvbh })

      // ── Tx2: metadata + mint + revoke ────────────────────────────────────────
      setStep('tx2')
      haptics.select()
      const { context: { slot: slot2 } } = await conn.getLatestBlockhashAndContext()
      const s2 = await signAndSendTransactions(mintTx, slot2)
      setSig2(s2)

      setStep('confirming')
      const { blockhash: bh2, lastValidBlockHeight: lvbh2 } = await conn.getLatestBlockhash()
      await conn.confirmTransaction({ signature: s2, blockhash: bh2, lastValidBlockHeight: lvbh2 })

      // Clear resume cache on success
      await AsyncStorage.removeItem(MINT_STATE_KEY(level, pubkey.toString()))
      setStep('done')
      haptics.win()
    } catch (err: any) {
      guard.current = false
      const msg: string = err?.message ?? ''
      const lc = msg.toLowerCase()
      if (lc.includes('cancel') || lc.includes('reject') || lc.includes('declined')) {
        setError('Cancelled. Nothing was submitted.')
      } else if (lc.includes('insufficient') || lc.includes('lamport')) {
        setError('Not enough SOL. Get devnet SOL from faucet.solana.com.')
      } else if (lc.includes('timeout') || lc.includes('timed out')) {
        setError('Timed out. Your transaction may still confirm — check Explorer.')
      } else {
        setError(msg || 'Unknown error')
      }
      setStep('error')
      haptics.error()
    }
  }

  const resumeTx2 = async () => {
    if (guard.current || !mintAddr) return
    guard.current = true
    setError(null)
    try {
      let pubkey: PublicKey
      if (account) pubkey = account.publicKey
      else { const c = await connect(); pubkey = c.publicKey }

      const { mintTx } = await buildSbtTransactions(conn, pubkey, level, sr)
      setStep('tx2')
      haptics.select()
      const { context: { slot: slot2r } } = await conn.getLatestBlockhashAndContext()
      const s2 = await signAndSendTransactions(mintTx, slot2r)
      setSig2(s2)
      setStep('confirming')
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
      await conn.confirmTransaction({ signature: s2, blockhash, lastValidBlockHeight })
      await AsyncStorage.removeItem(MINT_STATE_KEY(level, pubkey.toString()))
      setStep('done')
      haptics.win()
    } catch (err: any) {
      guard.current = false
      setError(err?.message ?? 'Unknown error')
      setStep('error')
    }
  }

  const retry = () => { guard.current = false; setStep('idle'); setError(null) }

  if (!flags.levelSbt) {
    return (
      <Screen>
        <View style={s.center}>
          <Text variant="body" style={{ color: colors.muted, textAlign: 'center' }}>
            SBT minting is currently disabled.
          </Text>
          <Text variant="label" style={s.back} onPress={() => router.back()}>← Back</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>DOJO BADGE · {SBT_CLUSTER.toUpperCase()}</Text>
          <Text style={s.title}>{level}</Text>
          <Text variant="body" style={{ color: colors.muted }}>
            Non-transferable · Earned in Dojo · Self-reported
          </Text>
        </View>

        {/* Status card */}
        <Card>
          <View style={s.row}>
            <Text variant="caption">Level</Text>
            <Text variant="numeric" style={{ color: colors.gold }}>{level}</Text>
          </View>
          <View style={s.row}>
            <Text variant="caption">SR at mint</Text>
            <Text variant="numeric" style={{ color: colors.gold }}>{Math.round(sr)}</Text>
          </View>
          <View style={s.row}>
            <Text variant="caption">Network</Text>
            <Text variant="caption" style={{ color: colors.muted }}>Solana {SBT_CLUSTER}</Text>
          </View>
          {mintAddr && (
            <View style={s.row}>
              <Text variant="caption">Mint</Text>
              <Text
                variant="numeric"
                style={{ color: colors.gold, fontSize: 11 }}
                onPress={() => Linking.openURL(sbtMintExplorerUrl(mintAddr))}
              >
                {mintAddr.slice(0, 8)}…{mintAddr.slice(-6)} ↗
              </Text>
            </View>
          )}
        </Card>

        {/* Step tracker */}
        {step !== 'idle' && step !== 'error' && (
          <Card style={{ gap: space.md }}>
            <Text variant="label" style={{ letterSpacing: 1 }}>PROGRESS</Text>
            {[
              { id: 'checking',   label: 'Checking for existing badge' },
              { id: 'tx1',        label: 'Step 1 / 2 — Sign in wallet' },
              { id: 'confirming', label: 'Confirming on-chain…' },
              { id: 'tx2',        label: 'Step 2 / 2 — Sign in wallet' },
              { id: 'done',       label: 'Minted ✓' },
            ].map(({ id, label }) => {
              const order = ['checking','tx1','confirming','tx2','done']
              const cur = order.indexOf(step)
              const self = order.indexOf(id)
              const done = cur > self
              const active = cur === self
              return (
                <View key={id} style={s.stepRow}>
                  <View style={[
                    s.dot,
                    done   && { backgroundColor: colors.gain, borderColor: colors.gain },
                    active && { borderColor: colors.gold },
                  ]}>
                    {done   && <Text style={{ color: colors.bg0, fontSize: 9, fontWeight: '700' }}>✓</Text>}
                    {active && <View style={s.pulse} />}
                  </View>
                  <Text variant="body" style={{
                    fontSize: 13,
                    color: done ? colors.gain : active ? colors.text : colors.muted,
                  }}>
                    {label}
                  </Text>
                </View>
              )
            })}
          </Card>
        )}

        {/* Done */}
        {step === 'done' && (
          <Card variant="hero" style={{ gap: space.md }}>
            <Text style={s.doneTitle}>
              {existing ? 'Badge already minted' : 'Badge minted!'}
            </Text>
            <Text variant="caption" style={{ color: colors.muted }}>
              {existing
                ? 'You already hold this level badge.'
                : 'The badge lives in your wallet. Supply is fixed at 1.'}
            </Text>
            {(sig2 || existing) && (
              <PrimaryButton
                label="View on Explorer →"
                onPress={() => Linking.openURL(
                  sig2 ? sbtExplorerUrl(sig2) : sbtMintExplorerUrl(existing!)
                )}
              />
            )}
            {sig1 && !sig2 && (
              <Text
                variant="caption"
                style={{ color: colors.gold }}
                onPress={() => Linking.openURL(sbtExplorerUrl(sig1))}
              >
                Tx1 ↗
              </Text>
            )}
          </Card>
        )}

        {/* Error */}
        {step === 'error' && (
          <Card style={{ gap: space.md }}>
            <Text variant="title" style={{ color: colors.loss }}>Failed</Text>
            <Text variant="body" style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
              {error}
            </Text>
            {mintAddr && (
              <PrimaryButton label="Resume from Step 2" onPress={resumeTx2} />
            )}
            <PrimaryButton variant="secondary" label="Try again" onPress={retry} />
          </Card>
        )}

        {/* CTA */}
        {(step === 'idle') && (
          <PrimaryButton
            label={account ? `Mint ${level} Badge` : 'Connect wallet & mint'}
            onPress={mint}
          />
        )}
        {step === 'tx2' && !sig1 && (
          <PrimaryButton label="Resume: Sign Step 2" onPress={resumeTx2} />
        )}

        <Text
          variant="label"
          style={{ color: colors.muted, textAlign: 'center', marginTop: space.md }}
          onPress={() => router.back()}
        >
          ← Back
        </Text>

        <Text variant="caption" style={s.disclaimer}>
          Educational simulation. Not financial advice.{'\n'}
          Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  content:   { padding: SCREEN_PAD, gap: space.lg, paddingBottom: 100 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SCREEN_PAD, gap: space.lg },
  header:    { gap: space.sm, paddingVertical: space.md },
  eyebrow:   { fontFamily: fonts.uiMedium, fontSize: 10, letterSpacing: 2, color: colors.gold },
  title:     { fontFamily: fonts.serif, fontSize: 38, letterSpacing: -0.3, color: colors.text },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  pulse:     { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  doneTitle: { fontFamily: fonts.serif, fontSize: 24, color: colors.gain, letterSpacing: -0.2 },
  back:      { color: colors.muted },
  disclaimer:{ textAlign: 'center', color: colors.muted, lineHeight: 18 },
})
