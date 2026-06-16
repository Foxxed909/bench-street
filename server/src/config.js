// Centralised config + admin allowlist — the single source of truth for who is an
// admin and for the JWT secret. Both auth.js (signup-time promotion) and db.js
// (boot-time reconciliation) import from here so they can never disagree.
//
// Admin is decided ONLY by an explicit allowlist — never by signup order. Set
// ADMIN_USERNAMES (comma-separated) in the environment; ADMIN_USERNAME (singular)
// is accepted for back-compat. Defaults to 'sylvie'.
const rawAdmins = process.env.ADMIN_USERNAMES || process.env.ADMIN_USERNAME || 'sylvie'
export const ADMIN_USERNAMES = rawAdmins
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export function isAdminUsername(name) {
  return ADMIN_USERNAMES.includes(String(name || '').toLowerCase())
}

// JWT secret. In production a real secret is mandatory — a forgeable default token
// is account-takeover for every user, so we refuse to boot rather than run insecure.
const DEV_SECRET = 'dev-secret-change-me'
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_SECRET) {
  throw new Error(
    'JWT_SECRET must be set to a strong, unique value in production (the dev default is forgeable).'
  )
}

export const STARTING_BALANCE = Number(process.env.STARTING_BALANCE || 100000)
