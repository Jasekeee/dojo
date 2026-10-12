// Seeker Genesis Token (SGT) check. SPEC.md section 8.3.
// [VERIFY] The official SGT mint address must be confirmed from Solana Mobile docs before mainnet.
// This module is intentionally behind a feature flag until verified.

import { Connection, PublicKey } from '@solana/web3.js'

// [VERIFY] — confirm from https://docs.solanamobile.com before enabling on mainnet.
// Placeholder: replace with the official SGT mint once verified.
const SGT_MINT_PLACEHOLDER = 'VERIFY_SGT_MINT_FROM_SOLANA_MOBILE_DOCS'

const RPC_ENDPOINT = 'https://api.devnet.solana.com'

export async function hasSeekerGenesisToken(walletAddress: string): Promise<boolean> {
  if (SGT_MINT_PLACEHOLDER.startsWith('VERIFY')) {
    // Mint address not yet verified — return false (no false positives).
    return false
  }

  try {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed')
    const pubkey = new PublicKey(walletAddress)
    const mintPubkey = new PublicKey(SGT_MINT_PLACEHOLDER)

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      mint: mintPubkey,
    })

    // SPEC: holder semantics — zero balances ignored (burned tokens don't count).
    return tokenAccounts.value.some(
      (acc) => Number(acc.account.data.parsed?.info?.tokenAmount?.amount ?? 0) > 0,
    )
  } catch {
    return false
  }
}
