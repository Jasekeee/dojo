import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { Card } from '@/src/ui/components/Card'
import { PrimaryButton } from '@/src/ui/components/PrimaryButton'
import { Screen } from '@/src/ui/components/Screen'
import { Text } from '@/src/ui/components/Text'
import { getLevel } from '@/src/engine/rating'
import { loadState } from '@/src/state/store'
import { haptics } from '@/src/ui/haptics'
import { colors, space } from '@/src/ui/theme'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const RPC_ENDPOINT = 'https://api.devnet.solana.com'
const CERT_SIG_KEY = '@dojo/cert_sig'

function buildMemoInstruction(signer: PublicKey, memo: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(memo, 'utf8'),
  })
}

type Step = 'idle' | 'connecting' | 'preparing' | 'signing' | 'confirming' | 'done' | 'error'

const STEPS: { id: Step; label: string; desc: string }[] = [
  { id: 'connecting', label: 'Connect wallet',      desc: 'Opening Solana wallet app' },
  { id: 'preparing', label: 'Prepare transaction',  desc: 'Fetching recent blockhash' },
  { id: 'signing',   label: 'Sign & submit',        desc: 'Approve in wallet — check your phone' },
  { id: 'confirming',label: 'Confirm on-chain',     desc: 'Waiting for block inclusion' },
  { id: 'done',      label: 'Certified',            desc: '' },
]

const STEP_ORDER: Step[] = ['connecting', 'preparing', 'signing', 'confirming', 'done']

function StepRow({
  id, label, desc, current,
}: {
  id: Step; label: string; desc: string; current: Step
}) {
  const idx        = STEP_ORDER.indexOf(id)
  const currentIdx = STEP_ORDER.indexOf(current)
  const done   = currentIdx > idx
  const active = current === id

  return (
    <View style={stepStyles.row}>
      <View style={[
        stepStyles.dot,
        done   && { backgroundColor: colors.gain, borderColor: colors.gain },
        active && { borderColor: colors.brand },
      ]}>
        {done   && <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>✓</Text>}
        {active && <View style={stepStyles.pulse} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="body"
          style={{
            color: done ? colors.gain : active ? colors.text : colors.muted,
            fontSize: 13,
          }}
        >
          {label}
        </Text>
        {active && desc ? (
          <Text variant="caption" style={{ fontSize: 10, marginTop: 1, color: colors.muted }}>
            {desc}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
})

// ─── Screen ──────────────────────────────────────────────────────────────────

interface LiveStats { sr: number; level: string; rounds: number }

export default function CertifyScreen() {
  const router = useRouter()
  const { connect, account, signAndSendTransactions, connection } = useMobileWallet()

  const [step,       setStep]       = useState<Step>('idle')
  const [txSig,      setTxSig]      = useState<string | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [liveStats,  setLiveStats]  = useState<LiveStats | null>(null)
  const [priorSig,   setPriorSig]   = useState<string | null>(null)

  const certifying = useRef(false)

  useEffect(() => {
    loadState().then((s) => setLiveStats({
      sr: Math.round(s.sr),
      level: getLevel(s.sr),
      rounds: s.history.length,
    }))
    AsyncStorage.getItem(CERT_SIG_KEY).then((sig) => { if (sig) setPriorSig(sig) })
  }, [])

  const explorerUrl = (sig: string) =>
    `https://explorer.solana.com/tx/${sig}?cluster=devnet`

  const certify = async () => {
    if (certifying.current) return
    certifying.current = true
    setErrorMsg(null)

    let submittedSig: string | null = null

    try {
      setStep('connecting')
      haptics.select()

      // Use returned account directly — hook state is stale until next render
      let pubkey: PublicKey
      if (account) {
        pubkey = new PublicKey(account.address)
      } else {
        const connected = await connect()
        pubkey = new PublicKey(connected.address)
      }

      setStep('preparing')
      const state = await loadState()
      const conn  = connection ?? new Connection(RPC_ENDPOINT, 'confirmed')

      const {
        context: { slot: minContextSlot },
        value: latestBlockhash,
      } = await conn.getLatestBlockhashAndContext()

      const payload = JSON.stringify({
        v:      1,
        app:    'dojo',
        sr:     Math.round(state.sr),
        level:  getLevel(state.sr),
        rounds: state.history.length,
        ts:     Math.floor(Date.now() / 1000),
      })

      setStep('signing')
      haptics.confirm()

      const message = new TransactionMessage({
        payerKey:        pubkey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions:    [buildMemoInstruction(pubkey, payload)],
      }).compileToLegacyMessage()

      const tx  = new VersionedTransaction(message)
      const sig = await signAndSendTransactions(tx, minContextSlot)

      // Persist signature before confirmation so a crash during confirming is recoverable
      submittedSig = sig
      setTxSig(sig)
      setPriorSig(sig)
      await AsyncStorage.setItem(CERT_SIG_KEY, sig)

      setStep('confirming')

      // Wait for actual on-chain inclusion
      await conn.confirmTransaction({
        signature:          sig,
        blockhash:          latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      })

      setStep('done')
      haptics.win()
    } catch (err: any) {
      certifying.current = false
      setStep('error')

      const msg: string = err?.message ?? ''
      const lc = msg.toLowerCase()

      if (lc.includes('cancel') || lc.includes('reject') || lc.includes('declined')) {
        setErrorMsg('Cancelled by wallet. Nothing was submitted.')
        haptics.select()
      } else if (lc.includes('not confirmed') || lc.includes('timed out') || lc.includes('timeout')) {
        setErrorMsg(
          submittedSig
            ? 'Confirmation timed out. Your transaction was submitted — check Explorer to see if it confirmed.'
            : 'Request timed out. Please try again.',
        )
        haptics.error()
      } else if (lc.includes('blockhash') || lc.includes('block hash')) {
        setErrorMsg('Blockhash expired. Please try again.')
        haptics.error()
      } else if (lc.includes('insufficient') || lc.includes('lamport')) {
        setErrorMsg('Insufficient devnet SOL. Get a free airdrop at faucet.solana.com.')
        haptics.warning()
      } else {
        setErrorMsg(msg || 'Unknown error. Please try again.')
        haptics.error()
      }
    }
  }

  const isInProgress = ['connecting', 'preparing', 'signing', 'confirming'].includes(step)
  const showProgress = step !== 'idle' && step !== 'error'
  const certifiedSig = txSig ?? (step === 'done' ? priorSig : null)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350).springify()} style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={{ fontSize: 36 }}>⛓️</Text>
          </View>
          <Text variant="display" style={{ fontSize: 28, marginTop: space.md }}>
            Certify on Solana
          </Text>
          <Text variant="body" style={{ color: colors.muted, marginTop: space.xs, lineHeight: 22 }}>
            Write your Skill Rating to Solana devnet as a signed memo transaction.
          </Text>
        </Animated.View>

        {/* What gets written */}
        <Animated.View entering={FadeInDown.duration(350).delay(60).springify()}>
          <Card variant="elevated" style={{ gap: space.sm }}>
            <Text variant="label" style={{ letterSpacing: 1 }}>WHAT GETS WRITTEN</Text>
            <View style={styles.row}>
              <Text variant="caption">Skill Rating</Text>
              <Text variant="numeric" style={{ color: colors.brand, fontSize: 14 }}>
                {liveStats ? `${liveStats.sr} · ${liveStats.level}` : '—'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text variant="caption">Rounds played</Text>
              <Text variant="numeric" style={{ color: colors.brand, fontSize: 14 }}>
                {liveStats ? String(liveStats.rounds) : '—'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text variant="caption">Network</Text>
              <Text variant="caption" style={{ color: colors.warn }}>Solana devnet</Text>
            </View>
            <View style={styles.row}>
              <Text variant="caption">Fee</Text>
              <Text variant="caption" style={{ color: colors.muted }}>~0.000005 devnet SOL</Text>
            </View>
            <Text variant="caption" style={styles.feeNote}>
              Devnet SOL has no real-world value. Your wallet must hold a small devnet SOL balance to pay fees.
            </Text>
          </Card>
        </Animated.View>

        {/* Honesty card */}
        <Animated.View entering={FadeInDown.duration(350).delay(100).springify()}>
          <Card style={{ gap: space.xs }}>
            <Text variant="label" style={{ letterSpacing: 1, color: colors.muted }}>WHAT THIS IS NOT</Text>
            <Text variant="caption" style={{ lineHeight: 18 }}>
              This is a self-signed memo — not an audited credential. The SR is computed from
              local device data and cannot be independently verified against market outcomes.
            </Text>
          </Card>
        </Animated.View>

        {/* Prior signature recovery */}
        {priorSig && step === 'idle' && (
          <Animated.View entering={FadeInDown.duration(300).springify()}>
            <Card style={{ gap: space.sm }}>
              <Text variant="label" style={{ letterSpacing: 1, color: colors.muted }}>
                PREVIOUS CERTIFICATION
              </Text>
              <View style={styles.row}>
                <Text variant="caption">Tx</Text>
                <Text
                  variant="numeric"
                  style={{ color: colors.brand, fontSize: 12 }}
                  onPress={() => Linking.openURL(explorerUrl(priorSig))}
                >
                  {priorSig.slice(0, 10)}…{priorSig.slice(-8)}
                </Text>
              </View>
              <Text
                variant="caption"
                style={{ color: colors.brand }}
                onPress={() => Linking.openURL(explorerUrl(priorSig))}
              >
                View on Explorer →
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* Step tracker */}
        {showProgress && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Card style={{ gap: space.lg }}>
              <Text variant="label" style={{ letterSpacing: 1 }}>PROGRESS</Text>
              {STEPS.filter((s) => s.id !== 'done' || step === 'done').map((s) => (
                <StepRow key={s.id} id={s.id} label={s.label} desc={s.desc} current={step} />
              ))}
            </Card>
          </Animated.View>
        )}

        {/* Done */}
        {step === 'done' && certifiedSig && (
          <Animated.View entering={FadeInDown.duration(350).springify()}>
            <Card variant="accent" style={{ gap: space.md }}>
              <View style={styles.doneHeader}>
                <Text style={{ fontSize: 28 }}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="title" style={{ color: colors.gain }}>Confirmed!</Text>
                  <Text variant="caption" style={{ marginTop: 2 }}>
                    Transaction included in a block.
                  </Text>
                </View>
              </View>
              {liveStats && (
                <View style={styles.row}>
                  <Text variant="caption">Certified SR</Text>
                  <Text variant="numeric" style={{ color: colors.brand, fontSize: 13 }}>
                    {liveStats.sr} · {liveStats.level}
                  </Text>
                </View>
              )}
              <View style={styles.row}>
                <Text variant="caption">Transaction</Text>
                <Text
                  variant="numeric"
                  style={{ color: colors.brand, fontSize: 12 }}
                  onPress={() => Linking.openURL(explorerUrl(certifiedSig))}
                >
                  {certifiedSig.slice(0, 12)}…{certifiedSig.slice(-8)}
                </Text>
              </View>
              <PrimaryButton
                label="View on Explorer →"
                onPress={() => Linking.openURL(explorerUrl(certifiedSig))}
              />
            </Card>
          </Animated.View>
        )}

        {/* Error */}
        {step === 'error' && (
          <Animated.View entering={FadeInDown.duration(350).springify()}>
            <Card style={{ gap: space.md }}>
              <Text variant="title" style={{ color: colors.loss }}>Failed</Text>
              <Text variant="body" style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
                {errorMsg}
              </Text>
              {txSig && (
                <View style={styles.row}>
                  <Text variant="caption">Submitted tx</Text>
                  <Text
                    variant="numeric"
                    style={{ color: colors.brand, fontSize: 12 }}
                    onPress={() => Linking.openURL(explorerUrl(txSig))}
                  >
                    {txSig.slice(0, 10)}…{txSig.slice(-8)}
                  </Text>
                </View>
              )}
              <PrimaryButton
                variant="secondary"
                label="Try again"
                onPress={() => { setStep('idle'); setErrorMsg(null) }}
              />
            </Card>
          </Animated.View>
        )}

        {/* CTA */}
        {step === 'idle' && (
          <Animated.View entering={FadeInDown.duration(350).delay(140).springify()}>
            <PrimaryButton
              label={priorSig ? 'Certify again' : 'Connect wallet & certify'}
              onPress={certify}
            />
          </Animated.View>
        )}

        {isInProgress && (
          <Animated.View entering={FadeIn.duration(200)}>
            <PrimaryButton label="Working…" onPress={() => {}} loading />
          </Animated.View>
        )}

        <Text
          variant="label"
          style={{ color: colors.muted, textAlign: 'center' }}
          onPress={() => router.back()}
        >
          ← Back
        </Text>

        <Text variant="caption" style={styles.disclaimer}>
          Educational simulation. Not financial advice.{'\n'}
          Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },

  header: { paddingVertical: space.md },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: `${colors.brand}15`,
    borderWidth: 1, borderColor: `${colors.brand}30`,
    alignItems: 'center', justifyContent: 'center',
  },

  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.line, opacity: 0.5 },
  feeNote: { color: colors.muted, lineHeight: 16, opacity: 0.65, marginTop: 2 },

  doneHeader: { flexDirection: 'row', gap: space.md, alignItems: 'center' },

  disclaimer: { textAlign: 'center', color: colors.muted, lineHeight: 18 },
})
