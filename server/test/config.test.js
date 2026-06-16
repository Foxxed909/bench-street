import { describe, it, expect } from 'vitest'
import { isAdminUsername, ADMIN_USERNAMES } from '../src/config.js'

// These assert the security fix: admin is decided ONLY by the allowlist, never by
// signup order. Default allowlist is ['sylvie'] when no env var is set.
describe('isAdminUsername', () => {
  it('defaults to the sylvie allowlist', () => {
    expect(ADMIN_USERNAMES).toContain('sylvie')
  })
  it('matches an allowlisted name case-insensitively', () => {
    expect(isAdminUsername('sylvie')).toBe(true)
    expect(isAdminUsername('Sylvie')).toBe(true)
    expect(isAdminUsername('  SYLVIE  '.trim())).toBe(true)
  })
  it('rejects everyone not on the list', () => {
    expect(isAdminUsername('admin')).toBe(false)
    expect(isAdminUsername('nifemi')).toBe(false)
    expect(isAdminUsername('')).toBe(false)
    expect(isAdminUsername(null)).toBe(false)
    expect(isAdminUsername(undefined)).toBe(false)
  })
})
