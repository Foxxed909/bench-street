import { describe, expect, it } from 'vitest'
import { parsePositiveMoney, parsePositiveShares } from '../src/money.js'

describe('parsePositiveMoney', () => {
  it('rounds valid values to cents', () => {
    expect(parsePositiveMoney('10.129')).toBe(10.13)
    expect(parsePositiveMoney(0.01)).toBe(0.01)
  })

  it('rejects empty, non-finite, non-positive, and non-numeric values', () => {
    for (const value of ['', 'nope', 0, -1, Infinity, -Infinity, NaN, true, null, undefined]) {
      expect(parsePositiveMoney(value)).toBeNull()
    }
  })

  it('rejects values beyond the configured cap', () => {
    expect(parsePositiveMoney(101, { max: 100 })).toBeNull()
  })
})

describe('parsePositiveShares', () => {
  it('supports fractional shares with six-decimal normalization', () => {
    expect(parsePositiveShares('1.1234567')).toBe(1.123457)
    expect(parsePositiveShares(0.000001)).toBe(0.000001)
  })

  it('rejects dust and non-finite quantities', () => {
    expect(parsePositiveShares(0.0000001)).toBeNull()
    expect(parsePositiveShares(Infinity)).toBeNull()
    expect(parsePositiveShares('')).toBeNull()
  })
})
