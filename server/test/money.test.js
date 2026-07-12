import { describe, expect, it } from 'vitest'
import {
  allocateParimutuelPayouts,
  calculateTradeTotal,
  parsePositiveMoney,
  parsePositiveShares
} from '../src/money.js'

describe('parsePositiveMoney', () => {
  it('accepts cent-denominated values without hidden rounding', () => {
    expect(parsePositiveMoney('10.12')).toBe(10.12)
    expect(parsePositiveMoney(0.01)).toBe(0.01)
  })

  it('rejects excess precision, dust, non-finite, non-positive, and non-numeric values', () => {
    for (const value of [
      '10.129',
      0.009,
      '',
      'nope',
      0,
      -1,
      Infinity,
      -Infinity,
      NaN,
      true,
      null,
      undefined
    ]) {
      expect(parsePositiveMoney(value)).toBeNull()
    }
  })

  it('rejects values beyond the configured cap', () => {
    expect(parsePositiveMoney(101, { max: 100 })).toBeNull()
  })
})

describe('parsePositiveShares', () => {
  it('supports fractional shares with at most six decimal places', () => {
    expect(parsePositiveShares('1.123456')).toBe(1.123456)
    expect(parsePositiveShares(0.000001)).toBe(0.000001)
  })

  it('rejects excess precision, dust, and non-finite quantities', () => {
    expect(parsePositiveShares('1.1234567')).toBeNull()
    expect(parsePositiveShares(0.0000001)).toBeNull()
    expect(parsePositiveShares(Infinity)).toBeNull()
    expect(parsePositiveShares('')).toBeNull()
  })
})

describe('calculateTradeTotal', () => {
  it('rejects a positive quantity that would settle to zero cents', () => {
    expect(calculateTradeTotal(0.000001, 100)).toBeNull()
  })

  it('returns the exact charged cent amount', () => {
    expect(calculateTradeTotal(0.1, 0.1)).toBe(0.01)
    expect(calculateTradeTotal(3, 12.345)).toBe(37.04)
  })
})

describe('allocateParimutuelPayouts', () => {
  it('distributes rounding pennies deterministically and conserves the target payout', () => {
    const payouts = allocateParimutuelPayouts(10, 3, [
      { id: 'a', stake: 1 },
      { id: 'b', stake: 1 },
      { id: 'c', stake: 1 }
    ])

    expect(payouts.get('a')).toBe(3.34)
    expect(payouts.get('b')).toBe(3.33)
    expect(payouts.get('c')).toBe(3.33)
    expect([...payouts.values()].reduce((sum, value) => sum + value, 0)).toBe(10)
  })

  it('preserves the existing seeded-liquidity payout formula', () => {
    const payouts = allocateParimutuelPayouts(2100, 1100, [{ id: 1, stake: 100 }])
    expect(payouts.get(1)).toBe(190.91)
  })

  it('keeps cent allocation exact near the configured transaction cap', () => {
    const payouts = allocateParimutuelPayouts(1_000_000_000, 500_000_000, [
      { id: 'a', stake: 333_333_333.33 },
      { id: 'b', stake: 166_666_666.67 }
    ])

    expect(payouts.get('a')).toBe(666_666_666.66)
    expect(payouts.get('b')).toBe(333_333_333.34)
    expect(payouts.get('a') + payouts.get('b')).toBe(1_000_000_000)
  })

  it('returns zero payouts when there are no actual winners', () => {
    expect(allocateParimutuelPayouts(100, 50, []).size).toBe(0)
  })
})
