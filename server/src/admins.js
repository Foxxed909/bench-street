import db from './db.js'
import { ADMIN_USER_IDS, ADMIN_USERNAMES } from './config.js'

function adminPredicate() {
  const clauses = []
  const params = []

  if (ADMIN_USER_IDS.length) {
    clauses.push(`id IN (${ADMIN_USER_IDS.map(() => '?').join(',')})`)
    params.push(...ADMIN_USER_IDS)
  }
  if (ADMIN_USERNAMES.length) {
    clauses.push(`LOWER(username) IN (${ADMIN_USERNAMES.map(() => '?').join(',')})`)
    params.push(...ADMIN_USERNAMES)
  }

  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : null, params }
}

// Make the database exactly match the configured identities. The older boot logic
// only promoted names and never revoked stale admin flags, so a previously promoted
// account could remain privileged forever after configuration changed.
export function reconcileAdminFlags() {
  let promoted = 0
  let demoted = 0
  const allowed = adminPredicate()

  db.transaction(() => {
    if (!allowed.sql) {
      demoted = db.prepare('UPDATE users SET is_admin = 0 WHERE is_admin != 0').run().changes
      return
    }

    demoted = db
      .prepare(`UPDATE users SET is_admin = 0 WHERE is_admin != 0 AND NOT ${allowed.sql}`)
      .run(...allowed.params).changes
    promoted = db
      .prepare(`UPDATE users SET is_admin = 1 WHERE is_admin = 0 AND ${allowed.sql}`)
      .run(...allowed.params).changes
  })()

  return {
    configuredIds: ADMIN_USER_IDS.length,
    configuredDevNames: ADMIN_USERNAMES.length,
    promoted,
    demoted
  }
}
