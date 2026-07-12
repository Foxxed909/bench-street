import { Router } from 'express'
import db from '../db.js'

const router = Router()

const cents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

// Rank users by net worth = cash + model holdings + stakes still locked in open
// prediction/battle positions. The previous N+1 implementation omitted locked stakes,
// so placing a bet made a trader look instantly poorer before the result even existed.
router.get('/', (req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.cash,
              COALESCE(SUM(h.shares * m.price), 0) AS holdings_value,
              COALESCE((
                SELECT SUM(mp.stake) FROM market_positions mp
                 WHERE mp.user_id = u.id AND mp.settled = 0
              ), 0) AS market_stake,
              COALESCE((
                SELECT SUM(bb.stake) FROM battle_bets bb
                 WHERE bb.user_id = u.id AND bb.settled = 0
              ), 0) AS battle_stake
         FROM users u
         LEFT JOIN holdings h ON h.user_id = u.id AND h.shares > 0
         LEFT JOIN models m ON m.id = h.model_id
        GROUP BY u.id, u.username, u.cash`
    )
    .all()

  const rows = users
    .map((u) => {
      const cash = cents(u.cash)
      const holdingsValue = cents(u.holdings_value)
      const lockedStake = cents(u.market_stake + u.battle_stake)
      return {
        username: u.username,
        cash,
        holdingsValue,
        lockedStake,
        netWorth: cents(cash + holdingsValue + lockedStake)
      }
    })
    .sort((a, b) => b.netWorth - a.netWorth || a.username.localeCompare(b.username))
    .slice(0, 50)

  res.json({ leaderboard: rows })
})

export default router
