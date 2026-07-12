import { execFileSync } from 'node:child_process'
import { describe, it, expect } from 'vitest'
import { isAdminUsername, ADMIN_USER_IDS, ADMIN_USERNAMES } from '../src/config.js'

// Local/test development keeps a convenient username allowlist. Production uses
// immutable user IDs so a squatted public username can never become an administrator.
describe('admin identity configuration', () => {
  it('keeps the sylvie development fallback', () => {
    expect(ADMIN_USERNAMES).toContain('sylvie')
    expect(ADMIN_USER_IDS).toEqual([])
    expect(isAdminUsername('sylvie')).toBe(true)
    expect(isAdminUsername('Sylvie')).toBe(true)
    expect(isAdminUsername('  SYLVIE  '.trim())).toBe(true)
  })

  it('rejects everyone not on the development name list', () => {
    expect(isAdminUsername('admin')).toBe(false)
    expect(isAdminUsername('nifemi')).toBe(false)
    expect(isAdminUsername('')).toBe(false)
    expect(isAdminUsername(null)).toBe(false)
    expect(isAdminUsername(undefined)).toBe(false)
  })

  it('uses numeric IDs and ignores username allowlists in production', () => {
    const configUrl = new URL('../src/config.js', import.meta.url).href
    const script = `
      import { ADMIN_USER_IDS, ADMIN_USERNAMES } from ${JSON.stringify(configUrl)};
      console.log(JSON.stringify({ ids: ADMIN_USER_IDS, names: ADMIN_USERNAMES }));
    `
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: 'test-only-strong-secret',
        ADMIN_USER_IDS: '7,42',
        ADMIN_USERNAMES: 'sylvie'
      }
    })
    expect(JSON.parse(output.trim())).toEqual({ ids: [7, 42], names: [] })
  })
})
