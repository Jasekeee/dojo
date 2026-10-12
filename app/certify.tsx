import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Linking, ScrollView, StyleSheet, View } from 'react-native'
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

// SPL Memo program — verified address from Solana docs.
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

// Devnet endpoint — switch to mainnet before final submission per SPEC.md section 8.2.
const RPC_ENDPOINT = 'https://api.devnet.solana.com'

function buildMemoInstruction(signer: PublicKey, memo: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(memo, 'utf8'),
  })
}

type Step = 'idle' | 'connecting' | 'signing' | 'confirming' | 'done' | 'error'

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
      // Step 1: Connect wallet
      setStep('connecting')
      haptics.select()
      let wallet = account
      if (!wallet) {
        await connect()
        wallet = account
      }
      if (!wallet) {
        throw new Error('Wallet connection cancelled.')
      }

      const pubkey = new PublicKey(wallet.address)

      // Step 2: Build memo payload
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

      // Step 3: Build transaction
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

      // Step 4: Sign & send via MWA
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="label" style={{ color: colors.brand }}>Certify</Text>
          <Text variant="display" style={{ fontSize: 28 }}>Write your rating{'\n'}to Solana</Text>
        </View>

        <Card style={{ gap: space.md }}>
          <Text variant="title">What gets written</Text>
          <Text variant="body" style={{ color: colors.muted }}>
            A Memo transaction is sent to Solana with your Skill Rating, level, and round count. The
            transaction signature is verifiable proof — it links your wallet address to your Dojo record.
          </Text>
          <Text variant="body" style={{ color: colors.muted }}>
            This uses devnet SOL (free). No real money is spent.
          </Text>
        </Card>

        {step === 'idle' && (
          <PrimaryButton label="Connect wallet & certify" onPress={certify} />
        )}

        {step === 'connecting' && (
          <Card style={{ alignItems: 'center', gap: space.sm }}>
            <Text variant="label">Opening your wallet…</Text>
          </Card>
        )}

        {step === 'signing' && (
          <Card style={{ alignItems: 'center', gap: space.sm }}>
            <Text variant="label">Building transaction…</Text>
          </Card>
        )}

        {step === 'confirming' && (
          <Card style={{ alignItems: 'center', gap: space.sm }}>
            <Text variant="label">Waiting for confirmation…</Text>
          </Card>
        )}

        {step === 'done' && txSignature && (
          <Card style={{ gap: space.md }}>
            <Text variant="title" style={{ color: colors.gain }}>Certified ✓</Text>
            <Text variant="body" style={{ color: colors.muted }}>
              Your rating is on-chain. Transaction:
            </Text>
            <Text
              variant="label"
              style={{ color: colors.brand }}
              onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
            >
              {txSignature.slice(0, 16)}…{txSignature.slice(-8)}
            </Text>
            <PrimaryButton
              label="View on Explorer"
              onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
            />
          </Card>
        )}

        {step === 'error' && (
          <Card style={{ gap: space.md }}>
            <Text variant="title" style={{ color: colors.loss }}>Failed</Text>
            <Text variant="body" style={{ color: colors.muted }}>{errorMsg}</Text>
            <PrimaryButton label="Try again" onPress={() => { setStep('idle'); setErrorMsg(null) }} />
          </Card>
        )}

        <Text variant="label" style={styles.disclaimer}>
          Educational simulation. Not financial advice.
        </Text>

        <Text
          variant="label"
          style={{ color: colors.muted, textAlign: 'center', marginTop: space.sm }}
          onPress={() => router.back()}
        >
          ← Back to Profile
        </Text>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { gap: space.xs, paddingVertical: space.md },
  disclaimer: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: space.md },
})
