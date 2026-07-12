import { describe, expect, it } from 'vitest'
import {
  calculateTradeTotal,
  parsePositiveMoney,
  parsePositiveShares
} from '../src/validation.js'

describe('parsePositiveMoney', () => {
  it('accepts normal cent-denominated stakes', () => {
    expect(parsePositiveMoney(50)).toBe(50)
    expect(parsePositiveMoney('12.34')).toBe(12.34)
    expect(parsePositiveMoney(0.01)).toBe(0.01)
  })

  it('rejects non-finite, non-positive, sub-cent, and over-precise values', () => {
    for (const value of [NaN, Infinity, -1, 0, 0.001, 1.001, 'nope']) {
      expect(parsePositiveMoney(value)).toBeNull()
    }
  })
})

describe('parsePositiveShares', () => {
  it('accepts whole and six-decimal fractional shares', () => {
    expect(parsePositiveShares(1)).toBe(1)
    expect(parsePositiveShares('0.125')).toBe(0.125)
    expect(parsePositiveShares(0.000001)).toBe(0.000001)
  })

  it('rejects dust, over-precision, and non-finite quantities', () => {
    for (const value of [0, -1, 0.0000001, 1.0000001, Infinity, 'nope']) {
      expect(parsePositiveShares(value)).toBeNull()
    }
  })
})

describe('calculateTradeTotal', () => {
  it('rounds normal trades to cents', () => {
    expect(calculateTradeTotal(3, 4.25)).toBe(12.75)
    expect(calculateTradeTotal(0.125, 10)).toBe(1.25)
  })

  it('rejects trades that round to zero instead of minting free shares', () => {
    expect(calculateTradeTotal(0.001, 2.5)).toBeNull()
  })
})
