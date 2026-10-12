import { describe, it, expect } from 'vitest'
import {
  isEligible,
  highestEligibleLevel,
  buildAdditionalFields,
  estimateMetadataBytes,
  sbtName,
  sbtMetadataUri,
  LEVEL_MIN_SR,
  LEVEL_ORDER,
  SBT_SYMBOL,
  type SbtLevel,
} from './sbt'

describe('isEligible', () => {
  it('Rookie is always eligible (SR 0)', () => {
    expect(isEligible(0,   'Rookie')).toBe(true)
    expect(isEligible(500, 'Rookie')).toBe(true)
  })
  it('requires exact threshold', () => {
    expect(isEligible(299, 'Analyst')).toBe(false)
    expect(isEligible(300, 'Analyst')).toBe(true)
    expect(isEligible(499, 'Trader')).toBe(false)
    expect(isEligible(500, 'Trader')).toBe(true)
    expect(isEligible(699, 'Sniper')).toBe(false)
    expect(isEligible(700, 'Sniper')).toBe(true)
  })
  it('Legend needs 850', () => {
    expect(isEligible(849, 'Legend')).toBe(false)
    expect(isEligible(850, 'Legend')).toBe(true)
    expect(isEligible(1000, 'Legend')).toBe(true)
  })
  it('all LEVEL_MIN_SR thresholds are covered', () => {
    for (const level of LEVEL_ORDER) {
      const min = LEVEL_MIN_SR[level]
      if (min > 0) expect(isEligible(min - 1, level)).toBe(false)
      expect(isEligible(min, level)).toBe(true)
    }
  })
})

describe('highestEligibleLevel', () => {
  it('returns null below Rookie threshold (impossible, Rookie=0)', () => {
    expect(highestEligibleLevel(0)).toBe('Rookie')
  })
  it('returns correct highest level', () => {
    expect(highestEligibleLevel(250)).toBe('Rookie')
    expect(highestEligibleLevel(300)).toBe('Analyst')
    expect(highestEligibleLevel(499)).toBe('Analyst')
    expect(highestEligibleLevel(500)).toBe('Trader')
    expect(highestEligibleLevel(700)).toBe('Sniper')
    expect(highestEligibleLevel(850)).toBe('Legend')
    expect(highestEligibleLevel(1000)).toBe('Legend')
  })
})

describe('buildAdditionalFields', () => {
  it('returns 3 fields with correct keys', () => {
    const fields = buildAdditionalFields('Trader', 507, 1700000000)
    expect(fields).toHaveLength(3)
    expect(fields[0]).toEqual(['level', 'Trader'])
    expect(fields[1]).toEqual(['sr_at_mint', '507'])
    expect(fields[2]).toEqual(['minted_at', '1700000000'])
  })
  it('rounds SR to integer', () => {
    const fields = buildAdditionalFields('Analyst', 312.7, 0)
    expect(fields[1]).toEqual(['sr_at_mint', '313'])
  })
})

describe('sbtName / sbtMetadataUri', () => {
  it('produces correct names', () => {
    const levels: SbtLevel[] = ['Rookie', 'Analyst', 'Trader', 'Sniper', 'Legend']
    for (const level of levels) {
      expect(sbtName(level)).toBe(`Dojo ${level}`)
      expect(sbtMetadataUri(level)).toContain(level)
      expect(sbtMetadataUri(level)).toContain('raw.githubusercontent.com')
      expect(sbtMetadataUri(level)).toContain('.json')
    }
  })
  it('symbol is DOJO', () => {
    expect(SBT_SYMBOL).toBe('DOJO')
  })
})

describe('estimateMetadataBytes', () => {
  it('returns a positive number for all levels', () => {
    for (const level of LEVEL_ORDER) {
      const bytes = estimateMetadataBytes(level, 500)
      expect(bytes).toBeGreaterThan(100)
      expect(bytes).toBeLessThan(1000)
    }
  })
  it('is consistent across calls for same inputs', () => {
    const a = estimateMetadataBytes('Legend', 900)
    const b = estimateMetadataBytes('Legend', 900)
    expect(a).toBe(b)
  })
})
