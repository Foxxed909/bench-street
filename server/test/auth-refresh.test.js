import { describe, expect, it } from 'vitest'
import {
  hashRefreshToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyRefreshTokenHash
} from '../src/auth.js'

describe('refresh-token lifecycle', () => {
  it('issues a verifiable signed refresh token for the expected user', () => {
    const token = signRefreshToken(42)
    const payload = verifyRefreshToken(token)

    expect(payload?.userId).toBe(42)
  })

  it('matches the stored refresh-token digest and rejects tampering', () => {
    const token = signRefreshToken(7)
    const hash = hashRefreshToken(token)

    expect(verifyRefreshTokenHash(token, hash)).toBe(true)
    expect(verifyRefreshTokenHash(token + 'tampered', hash)).toBe(false)
  })
})
