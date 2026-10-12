/**
 * Level SBT (Soulbound Token) — Token-2022 with NonTransferable + MetadataPointer + TokenMetadata.
 * Self-reported: SR is stored locally; badge says "Earned in Dojo", never "certified" or "verified".
 * Behind feature flag: flags.levelSbt.
 *
 * Mint flow (2 transactions required due to extension init ordering):
 *   Tx1: createAccount + initNonTransferable + initMetadataPointer + initMint2
 *        → mint keypair partially signs, wallet signs as fee payer
 *   Tx2: initTokenMetadata + updateField×3 + createATA + mintTo + revokeAuthority
 *        → wallet signs only (wallet = mint authority = update authority)
 *
 * Cluster: mainnet-beta (Token-2022 program live on mainnet).
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  ExtensionType,
  createInitializeNonTransferableMintInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getTokenMetadata,
} from '@solana/spl-token'
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
} from '@solana/spl-token-metadata'

// ── Cluster config ────────────────────────────────────────────────────────────
export const SBT_RPC     = 'https://api.mainnet-beta.solana.com'
export const SBT_CLUSTER = 'mainnet-beta' as const

export function sbtExplorerUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=${SBT_CLUSTER}`
}

export function sbtMintExplorerUrl(mint: string): string {
  return `https://explorer.solana.com/address/${mint}?cluster=${SBT_CLUSTER}`
}

// ── Levels ────────────────────────────────────────────────────────────────────
export type SbtLevel = 'Rookie' | 'Analyst' | 'Trader' | 'Sniper' | 'Legend'

export const LEVEL_ORDER: SbtLevel[] = ['Rookie', 'Analyst', 'Trader', 'Sniper', 'Legend']

export const LEVEL_MIN_SR: Record<SbtLevel, number> = {
  Rookie:  0,
  Analyst: 300,
  Trader:  500,
  Sniper:  700,
  Legend:  850,
}

export const SBT_SYMBOL = 'DOJO'

// ── Metadata helpers (pure, unit-tested) ─────────────────────────────────────
export function sbtName(level: SbtLevel): string {
  return `Dojo ${level}`
}

export function sbtMetadataUri(level: SbtLevel): string {
  return `https://raw.githubusercontent.com/Jasekeee/dojo/main/sbt/metadata/${level}.json`
}

export function isEligible(currentSr: number, level: SbtLevel): boolean {
  return currentSr >= LEVEL_MIN_SR[level]
}

export function highestEligibleLevel(currentSr: number): SbtLevel | null {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    if (currentSr >= LEVEL_MIN_SR[LEVEL_ORDER[i]!]) return LEVEL_ORDER[i]!
  }
  return null
}

export function buildAdditionalFields(
  level: SbtLevel,
  srAtMint: number,
  mintedAt: number,
): Array<[string, string]> {
  return [
    ['level',      level],
    ['sr_at_mint', String(Math.round(srAtMint))],
    ['minted_at',  String(mintedAt)],
  ]
}

// Bytes needed for TokenMetadata extension content (TLV payload only, no header).
export function estimateMetadataBytes(level: SbtLevel, srAtMint: number): number {
  const name   = sbtName(level)
  const symbol = SBT_SYMBOL
  const uri    = sbtMetadataUri(level)
  const fields = buildAdditionalFields(level, srAtMint, Math.floor(Date.now() / 1000))

  // Optional<Pubkey> update authority: 1 + 32 = 33 bytes
  // Pubkey mint: 32 bytes
  // Each string: 4-byte LE length prefix + content
  let total = 33 + 32
  total += 4 + name.length
  total += 4 + symbol.length
  total += 4 + uri.length
  total += 4 // vec<(string,string)> count
  for (const [k, v] of fields) {
    total += 4 + k.length + 4 + v.length
  }
  return total + 32 // generous padding for TLV framing
}

// ── Retry helper ─────────────────────────────────────────────────────────────

/** Retries an async call up to maxAttempts with exponential backoff. Handles 429 and timeouts. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 800,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      lastErr = err
      const msg: string = err?.message ?? ''
      const isRetryable =
        msg.includes('429') ||
        msg.includes('Too Many Requests') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('ECONNRESET') ||
        msg.includes('socket hang up') ||
        msg.includes('fetch failed')
      if (!isRetryable || attempt === maxAttempts - 1) throw err
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
    }
  }
  throw lastErr
}

// ── Rent estimation ───────────────────────────────────────────────────────────

/** Fetch real mainnet rent for the mint account size. ATA rent is fixed (165 bytes). */
export async function estimateRealLamports(
  connection: Connection,
  level: SbtLevel,
  srAtMint: number,
): Promise<{ mintLamports: number; ataLamports: number; totalLamports: number }> {
  const baseLen   = getMintLen([ExtensionType.NonTransferable, ExtensionType.MetadataPointer])
  const metaBytes = estimateMetadataBytes(level, srAtMint)
  const totalLen  = baseLen + 8 + metaBytes

  const [mintLamports, ataLamports] = await Promise.all([
    withRetry(() => connection.getMinimumBalanceForRentExemption(totalLen)),
    withRetry(() => connection.getMinimumBalanceForRentExemption(165)),
  ])

  return { mintLamports, ataLamports, totalLamports: mintLamports + ataLamports }
}

// ── Duplicate check ───────────────────────────────────────────────────────────

/** Check on-chain: scan wallet's Token-2022 accounts for a Dojo badge of this level. */
export async function findExistingBadge(
  connection: Connection,
  walletPublicKey: PublicKey,
  level: SbtLevel,
): Promise<string | null> {
  try {
    const accounts = await withRetry(() =>
      connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_2022_PROGRAM_ID },
      )
    )
    for (const { account } of accounts.value) {
      const mintStr: string | undefined = account.data.parsed?.info?.mint
      if (!mintStr) continue
      try {
        const meta = await withRetry(() =>
          getTokenMetadata(connection, new PublicKey(mintStr))
        )
        if (!meta) continue
        if (meta.symbol !== SBT_SYMBOL) continue
        const levelField = meta.additionalMetadata.find(([k]) => k === 'level')
        if (levelField?.[1] === level) return mintStr
      } catch {
        // not a Token-2022 metadata token — skip
      }
    }
    return null
  } catch {
    return null
  }
}

// ── Transaction builder ───────────────────────────────────────────────────────

export interface SbtTxPair {
  /** Tx1: createAccount + extension inits + initMint. mintKeypair already partially signed. */
  setupTx:          Transaction
  /** Tx2: initMetadata + fields + createATA + mintTo + revokeAuthority. Wallet signs only. */
  mintTx:           Transaction
  /** Ephemeral — only needed to partially sign setupTx. Never store or transmit. */
  mintKeypair:      Keypair
  mintPublicKey:    PublicKey
  ataAddress:       PublicKey
  estimatedLamports: number
}

export async function buildSbtTransactions(
  connection: Connection,
  walletPublicKey: PublicKey,
  level: SbtLevel,
  srAtMint: number,
): Promise<SbtTxPair> {
  const mintKeypair = Keypair.generate()
  const mint        = mintKeypair.publicKey

  // Space for NonTransferable + MetadataPointer extensions only.
  // TokenMetadata data is allocated in-place by initTokenMetadata (account realloc).
  const baseLen     = getMintLen([ExtensionType.NonTransferable, ExtensionType.MetadataPointer])
  const metaBytes   = estimateMetadataBytes(level, srAtMint)
  // +8 for TokenMetadata TLV type+length header
  const totalLen    = baseLen + 8 + metaBytes
  const lamports    = await withRetry(() => connection.getMinimumBalanceForRentExemption(totalLen))

  const { blockhash: bh1 } = await withRetry(() => connection.getLatestBlockhash())
  const { blockhash: bh2 } = await withRetry(() => connection.getLatestBlockhash())

  const mintedAt = Math.floor(Date.now() / 1000)
  const name     = sbtName(level)
  const uri      = sbtMetadataUri(level)
  const fields   = buildAdditionalFields(level, srAtMint, mintedAt)
  const ata      = getAssociatedTokenAddressSync(mint, walletPublicKey, false, TOKEN_2022_PROGRAM_ID)

  // ── Tx1: mint account setup ─────────────────────────────────────────────────
  // Extension order matters: NonTransferable → MetadataPointer → then initMint2.
  const setupTx = new Transaction({ recentBlockhash: bh1, feePayer: walletPublicKey })
  setupTx.add(
    SystemProgram.createAccount({
      fromPubkey:      walletPublicKey,
      newAccountPubkey: mint,
      space:            baseLen, // just base; metadata space added at init time
      lamports,
      programId:       TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeNonTransferableMintInstruction(mint, TOKEN_2022_PROGRAM_ID),
    createInitializeMetadataPointerInstruction(
      mint,
      walletPublicKey, // update authority for the pointer
      mint,            // metadata lives at the mint itself
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMint2Instruction(
      mint,
      0,               // decimals
      walletPublicKey, // mint authority = wallet (revoked later)
      null,            // no freeze authority
      TOKEN_2022_PROGRAM_ID,
    ),
  )
  // Mint keypair partially signs for createAccount (it's the new account)
  setupTx.partialSign(mintKeypair)

  // ── Tx2: metadata init, mint, revoke ────────────────────────────────────────
  // Must run after Tx1 is confirmed.  Wallet = fee payer = mintAuthority = updateAuthority.
  const mintTx = new Transaction({ recentBlockhash: bh2, feePayer: walletPublicKey })
  mintTx.add(
    createInitializeInstruction({
      programId:       TOKEN_2022_PROGRAM_ID,
      metadata:        mint,
      updateAuthority: walletPublicKey,
      mint,
      mintAuthority:   walletPublicKey,
      name,
      symbol:          SBT_SYMBOL,
      uri,
    }),
    ...fields.map(([field, value]) =>
      createUpdateFieldInstruction({
        programId:       TOKEN_2022_PROGRAM_ID,
        metadata:        mint,
        updateAuthority: walletPublicKey,
        field,
        value,
      }),
    ),
    createAssociatedTokenAccountInstruction(
      walletPublicKey,
      ata,
      walletPublicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createMintToInstruction(mint, ata, walletPublicKey, 1, [], TOKEN_2022_PROGRAM_ID),
    createSetAuthorityInstruction(
      mint,
      walletPublicKey,
      AuthorityType.MintTokens,
      null, // new authority = null → revoke
      [],
      TOKEN_2022_PROGRAM_ID,
    ),
  )

  return { setupTx, mintTx, mintKeypair, mintPublicKey: mint, ataAddress: ata, estimatedLamports: lamports }
}
