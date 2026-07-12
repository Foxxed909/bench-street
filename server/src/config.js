// Centralised security-sensitive configuration. Admin identity and JWT handling
// live here so signup, boot reconciliation, and middleware cannot quietly disagree.

// Admins must be explicitly configured in production. Development keeps the old
// `sylvie` convenience account, but a public deployment never gets a guessable
// administrator merely because an environment variable was forgotten.
//
// Use ADMIN_USERNAMES as a comma-separated allowlist. ADMIN_USERNAME (singular)
// remains supported for backwards compatibility. An explicitly empty value means
// "no admins".
const rawAdmins =
  process.env.ADMIN_USERNAMES ??
  process.env.ADMIN_USERNAME ??
  (process.env.NODE_ENV === 'production' ? '' : 'sylvie')

export const ADMIN_USERNAMES = rawAdmins
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export function isAdminUsername(name) {
  return ADMIN_USERNAMES.includes(String(name || '').trim().toLowerCase())
}

// JWT secret. In production a real secret is mandatory. Trimming first also rejects
// an accidentally blank/whitespace-only secret rather than signing forgeable tokens.
const DEV_SECRET = 'dev-secret-change-me'
const configuredSecret = process.env.JWT_SECRET?.trim()
export const JWT_SECRET = configuredSecret || DEV_SECRET
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_SECRET) {
  throw new Error(
    'JWT_SECRET must be set to a strong, unique value in production (the dev default is forgeable).'
  )
}

const configuredBalance = Number(process.env.STARTING_BALANCE ?? 100000)
if (!Number.isFinite(configuredBalance) || configuredBalance < 0) {
  throw new Error('STARTING_BALANCE must be a finite, non-negative number.')
}
export const STARTING_BALANCE = Math.round((configuredBalance + Number.EPSILON) * 100) / 100
