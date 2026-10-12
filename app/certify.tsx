import { useRouter } from 'expo-router'
import React, { useState } from 'react'
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
import { colors, radius, space } from '@/src/ui/theme'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const RPC_ENDPOINT = 'https://api.devnet.solana.com'

function buildMemoInstruction(signer: PublicKey, memo: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(memo, 'utf8'),
  })
}

type Step = 'idle' | 'connecting' | 'signing' | 'confirming' | 'done' | 'error'

const STEPS: { id: Step; label: string }[] = [
  { id: 'connecting', label: 'Connect wallet' },
  { id: 'signing', label: 'Build transaction' },
  { id: 'confirming', label: 'Confirm on-chain' },
  { id: 'done', label: 'Certified' },
]

const STEP_ORDER = ['connecting', 'signing', 'confirming', 'done']

function StepRow({ id, label, current }: { id: Step; label: string; current: Step }) {
  const idx = STEP_ORDER.indexOf(id)
  const currentIdx = STEP_ORDER.indexOf(current)
  const done = currentIdx > idx
  const active = current === id

  return (
    <View style={stepStyles.row}>
      <View style={[
        stepStyles.dot,
        done && { backgroundColor: colors.gain, borderColor: colors.gain },
        active && { borderColor: colors.brand },
      ]}>
        {done && <Text style={{ color: '#000', fontSize: 10, fontWeight: '700' }}>✓</Text>}
        {active && <View style={stepStyles.activePulse} />}
      </View>
      <Text
        variant="body"
        style={{ color: done ? colors.gain : active ? colors.text : colors.muted, fontSize: 14 }}
      >
        {label}
      </Text>
    </View>
  )
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
})

export default function CertifyScreen() {
  const router = useRouter()
  const { connect, account, signAndSendTransactions, connection } = useMobileWallet()
  const [step, setStep] = useState<Step>('idle')
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const explorerUrl = txSignature
    ? `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
    : null

  const certify = async () => {
    setErrorMsg(null)
    try {
      setStep('connecting')
      haptics.select()
      let wallet = account
      if (!wallet) {
        await connect()
        wallet = account
      }
      if (!wallet) throw new Error('Wallet connection cancelled.')

      const pubkey = new PublicKey(wallet.address)

      const state = await loadState()
      const payload = JSON.stringify({
        v: 1,
        app: 'dojo',
        sr: Math.round(state.sr),
        level: getLevel(state.sr),
        rounds: state.history.length,
        ts: Math.floor(Date.now() / 1000),
      })

      setStep('signing')
      haptics.confirm()

      const conn = connection ?? new Connection(RPC_ENDPOINT, 'confirmed')
      const {
        context: { slot: minContextSlot },
        value: latestBlockhash,
      } = await conn.getLatestBlockhashAndContext()

      const message = new TransactionMessage({
        payerKey: pubkey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [buildMemoInstruction(pubkey, payload)],
      }).compileToLegacyMessage()

      const tx = new VersionedTransaction(message)

      setStep('confirming')
      const sig = await signAndSendTransactions(tx, minContextSlot)
      setTxSignature(sig)
      setStep('done')
      haptics.win()
    } catch (err: any) {
      setStep('error')
      setErrorMsg(err?.message ?? 'Unknown error')
      haptics.loss()
    }
  }

  const isInProgress = ['connecting', 'signing', 'confirming'].includes(step)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350).springify()} style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={{ fontSize: 36 }}>⛓️</Text>
          </View>
          <Text variant="display" style={{ fontSize: 30, marginTop: space.md }}>
            Certify on Solana
          </Text>
          <Text variant="body" style={{ color: colors.muted, marginTop: space.xs, lineHeight: 22 }}>
            Write your Skill Rating to the blockchain. Verifiable proof of your edge.
          </Text>
        </Animated.View>

        {/* What gets written */}
        <Animated.View entering={FadeInDown.duration(350).delay(60).springify()}>
          <Card variant="elevated" style={{ gap: space.sm }}>
            <Text variant="label" style={{ letterSpacing: 1 }}>WHAT GETS WRITTEN</Text>
            <View style={styles.payloadRow}>
              <Text variant="caption">Skill Rating</Text>
              <Text variant="numeric" style={{ color: colors.brand, fontSize: 14 }}>SR + Level</Text>
            </View>
            <View style={styles.payloadRow}>
              <Text variant="caption">Round count</Text>
              <Text variant="numeric" style={{ color: colors.brand, fontSize: 14 }}>rounds played</Text>
            </View>
            <View style={styles.payloadRow}>
              <Text variant="caption">Network</Text>
              <Text variant="caption" style={{ color: colors.warn }}>Devnet (free)</Text>
            </View>
          </Card>
        </Animated.View>

        {/* Step tracker */}
        {step !== 'idle' && step !== 'error' && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Card style={{ gap: space.lg }}>
              <Text variant="label" style={{ letterSpacing: 1 }}>PROGRESS</Text>
              {STEPS.map((s) => (
                <StepRow key={s.id} id={s.id} label={s.label} current={step} />
              ))}
            </Card>
          </Animated.View>
        )}

        {/* Done state */}
        {step === 'done' && txSignature && (
          <Animated.View entering={FadeInDown.duration(350).springify()}>
            <Card variant="accent" style={{ gap: space.md }}>
              <View style={styles.doneHeader}>
                <Text style={{ fontSize: 28 }}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text variant="title" style={{ color: colors.gain }}>Certified!</Text>
                  <Text variant="caption" style={{ marginTop: 2 }}>Your rating is on-chain</Text>
                </View>
              </View>
              <View style={styles.txRow}>
                <Text variant="caption">Transaction</Text>
                <Text
                  variant="numeric"
                  style={{ color: colors.brand, fontSize: 12 }}
                  onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
                >
                  {txSignature.slice(0, 12)}…{txSignature.slice(-8)}
                </Text>
              </View>
              <PrimaryButton
                label="View on Explorer →"
                onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
              />
            </Card>
          </Animated.View>
        )}

        {/* Error state */}
        {step === 'error' && (
          <Animated.View entering={FadeInDown.duration(350).springify()}>
            <Card style={{ gap: space.md }}>
              <Text variant="title" style={{ color: colors.loss }}>Failed</Text>
              <Text variant="body" style={{ color: colors.muted, fontSize: 14 }}>{errorMsg}</Text>
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
          <Animated.View entering={FadeInDown.duration(350).delay(120).springify()}>
            <PrimaryButton label="Connect wallet & certify" onPress={certify} />
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
          Educational simulation. Not financial advice.{'\n'}Past performance doesn't predict future results.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: 100 },

  header: { paddingVertical: space.md },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: `${colors.brand}15`,
    borderWidth: 1,
    borderColor: `${colors.brand}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  payloadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  doneHeader: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  disclaimer: { textAlign: 'center', color: colors.muted, lineHeight: 18 },
})
