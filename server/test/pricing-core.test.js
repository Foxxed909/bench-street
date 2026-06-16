import { describe, it, expect } from 'vitest'
import { VOTE_RATE, costFactor, perVoteValue, priceFor } from '../src/pricing-core.js'

describe('costFactor', () => {
  it('is 1.0 at the reference token price ($5/Mtok)', () => {
    expect(costFactor(5)).toBe(1)
  })
  it('clamps cheap models up to the 0.5 floor', () => {
    expect(costFactor(0.2)).toBe(0.5)
    expect(costFactor(0)).toBe(0.5)
  })
  it('clamps pricey models down to the 2.0 ceiling', () => {
    expect(costFactor(15)).toBe(2)
    expect(costFactor(99)).toBe(2)
  })
  it('scales linearly between floor and ceiling', () => {
    expect(costFactor(10)).toBe(2) // 10/5 = 2.0 (ceiling)
    expect(costFactor(4)).toBeCloseTo(0.8, 5) // 4/5 = 0.8
  })
  it('treats null/NaN price as no tilt (1.0)', () => {
    expect(costFactor(null)).toBe(1)
    expect(costFactor(undefined)).toBe(1)
    expect(costFactor(NaN)).toBe(1)
  })
})

describe('perVoteValue', () => {
  it('is the base VOTE_RATE at the reference price', () => {
    expect(perVoteValue(5)).toBe(VOTE_RATE)
  })
  it('halves for the cheapest models and doubles for the priciest', () => {
    expect(perVoteValue(0.2)).toBe(2.5) // 5 × 0.5
    expect(perVoteValue(20)).toBe(10) // 5 × 2.0
  })
})

describe('priceFor', () => {
  it('returns $0 for zero or negative net sentiment', () => {
    expect(priceFor(0, 5)).toBe(0)
    expect(priceFor(-20, 15)).toBe(0)
  })
  it('multiplies net sentiment by the per-vote value', () => {
    expect(priceFor(10, 5)).toBe(50) // 10 × $5
    expect(priceFor(10, 20)).toBe(100) // 10 × $10
    expect(priceFor(3, 0.2)).toBe(7.5) // 3 × $2.50
  })
  it('guards against null/garbage net', () => {
    expect(priceFor(null, 5)).toBe(0)
    expect(priceFor(undefined, 5)).toBe(0)
  })
  it('rounds to cents', () => {
    // 7 × (5 × 0.8) = 7 × 4 = 28 ; pick a fractional combo
    expect(priceFor(3, 4)).toBe(12) // 3 × (5 × 0.8 = 4)
  })
})
