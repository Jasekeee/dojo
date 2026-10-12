export const flags = {
  levelSbt: true, // Level SBT badges — devnet test enabled
} as const

export type Flags = typeof flags
