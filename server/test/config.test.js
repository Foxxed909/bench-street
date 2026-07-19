import { execFileSync } from 'node:child_process'
import { describe, it, expect } from 'vitest'
import { isAdminUsername, ADMIN_USER_IDS, ADMIN_USERNAMES } from '../src/config.js'

// Local/test development keeps a convenient username allowlist. Production uses
// immutable user IDs so a squatted public username can never become an administrator.
describe('admin identity configuration', () => {
  it('keeps the development fallback allowlist', () => {
    expect(ADMIN_USERNAMES).toContain('admin')
    expect(ADMIN_USER_IDS).toEqual([])
    expect(isAdminUsername('admin')).toBe(true)
    expect(isAdminUsername('Admin')).toBe(true)
    expect(isAdminUsername('  ADMIN  '.trim())).toBe(true)
  })

  it('rejects everyone not on the development name list', () => {
    expect(isAdminUsername('root')).toBe(false)
    expect(isAdminUsername('someone-else')).toBe(false)
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
        ADMIN_USERNAMES: 'admin'
      }
    })
    expect(JSON.parse(output.trim())).toEqual({ ids: [7, 42], names: [] })
  })
})
