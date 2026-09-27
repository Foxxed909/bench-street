import { describe, expect, it } from 'vitest'
import {
  hashPassword,
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

  it('matches the stored bcrypt hash without re-hashing and comparing strings', () => {
    const token = signRefreshToken(7)
    const hash = hashPassword(token)

    expect(verifyRefreshTokenHash(token, hash)).toBe(true)
    expect(verifyRefreshTokenHash(token + 'tampered', hash)).toBe(false)
  })
})
