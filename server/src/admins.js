import db from './db.js'
import { ADMIN_USERNAMES } from './config.js'

// Make the database exactly match the deployment allowlist. The older boot logic only
// promoted names and never revoked stale admin flags, so a previously promoted account
// could remain privileged forever after configuration changed.
export function reconcileAdminFlags() {
  let promoted = 0
  let demoted = 0

  db.transaction(() => {
    if (ADMIN_USERNAMES.length === 0) {
      demoted = db.prepare('UPDATE users SET is_admin = 0 WHERE is_admin != 0').run().changes
      return
    }

    const placeholders = ADMIN_USERNAMES.map(() => '?').join(',')
    demoted = db
      .prepare(`UPDATE users SET is_admin = 0 WHERE is_admin != 0 AND LOWER(username) NOT IN (${placeholders})`)
      .run(...ADMIN_USERNAMES).changes

    const promote = db.prepare('UPDATE users SET is_admin = 1 WHERE LOWER(username) = ? AND is_admin = 0')
    for (const username of ADMIN_USERNAMES) promoted += promote.run(username).changes
  })()

  return { configured: ADMIN_USERNAMES.length, promoted, demoted }
}
