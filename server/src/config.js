// Centralised security-sensitive configuration. Admin identity and JWT handling
// live here so signup, boot reconciliation, and middleware cannot quietly disagree.

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Production admins are pinned to immutable database user IDs. A public username is
// not an identity boundary: anyone can register a desired name before its owner and
// wait for a username allowlist to promote it on the next deploy.
const rawAdminIds = process.env.ADMIN_USER_IDS ?? ''
export const ADMIN_USER_IDS = rawAdminIds
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => Number(s))

if (ADMIN_USER_IDS.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
  throw new Error('ADMIN_USER_IDS must be a comma-separated list of positive integer user IDs.')
}

// Username allowlisting is retained only for local/test convenience and backwards
// compatibility. It is deliberately ignored in production; use ADMIN_USER_IDS there.
const rawAdmins = IS_PRODUCTION
  ? ''
  : process.env.ADMIN_USERNAMES ?? process.env.ADMIN_USERNAME ?? 'admin'

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
if (IS_PRODUCTION && JWT_SECRET === DEV_SECRET) {
  throw new Error(
    'JWT_SECRET must be set to a strong, unique value in production (the dev default is forgeable).'
  )
}

const configuredBalance = Number(process.env.STARTING_BALANCE ?? 100000)
if (!Number.isFinite(configuredBalance) || configuredBalance < 0) {
  throw new Error('STARTING_BALANCE must be a finite, non-negative number.')
}
export const STARTING_BALANCE = Math.round((configuredBalance + Number.EPSILON) * 100) / 100
