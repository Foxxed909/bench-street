import { describe, it, expect } from 'vitest'
import { eloWinProb } from '../src/battles.js'

describe('eloWinProb', () => {
  it('is 50% for evenly-rated models', () => {
    expect(eloWinProb(1200, 1200)).toBeCloseTo(0.5, 5)
  })
  it('favours the higher-rated model', () => {
    expect(eloWinProb(1400, 1200)).toBeGreaterThan(0.5)
    expect(eloWinProb(1200, 1400)).toBeLessThan(0.5)
  })
  it('is the standard ~76% at a 200-point edge', () => {
    expect(eloWinProb(1400, 1200)).toBeCloseTo(0.76, 2)
  })
  it('is symmetric — the two sides sum to 1', () => {
    const p = eloWinProb(1372, 1301)
    const q = eloWinProb(1301, 1372)
    expect(p + q).toBeCloseTo(1, 5)
  })
})
