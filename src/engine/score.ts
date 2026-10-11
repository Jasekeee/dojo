// Episode scoring. SPEC.md section 3.5. Zero UI/chain imports.

export const SCORE_TANH_SCALE = 0.15

export function computeEdge(userReturn: number, botReturn: number): number {
  return userReturn - botReturn
}

export function computeScore(userReturn: number, botReturn: number): number {
  return Math.tanh(computeEdge(userReturn, botReturn) / SCORE_TANH_SCALE)
}
