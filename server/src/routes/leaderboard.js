import { Router } from 'express'
import db from '../db.js'

const router = Router()

// Rank users by net worth = cash + market value of holdings.
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, cash FROM users').all()
  const hvStmt = db.prepare(
    `SELECT COALESCE(SUM(h.shares * m.price), 0) AS v
       FROM holdings h JOIN models m ON m.id = h.model_id
      WHERE h.user_id = ?`
  )
  const rows = users
    .map((u) => {
      const holdingsValue = hvStmt.get(u.id).v
      return {
        username: u.username,
        cash: +u.cash.toFixed(2),
        holdingsValue: +holdingsValue.toFixed(2),
        netWorth: +(u.cash + holdingsValue).toFixed(2)
      }
    })
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 50)
  res.json({ leaderboard: rows })
})

export default router
