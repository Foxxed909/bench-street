import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
const cents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

router.get('/', requireAuth, (req, res) => {
  const holdings = db
    .prepare(
      `SELECT h.shares, h.avg_cost, m.id AS model_id, m.slug, m.name, m.ticker, m.color, m.price, m.prev_close
         FROM holdings h JOIN models m ON m.id = h.model_id
        WHERE h.user_id = ? AND h.shares > 0
        ORDER BY (h.shares * m.price) DESC`
    )
    .all(req.user.id)

  const positions = holdings.map((h) => {
    const value = h.shares * h.price
    const cost = h.shares * h.avg_cost
    return {
      modelId: h.model_id,
      slug: h.slug,
      name: h.name,
      ticker: h.ticker,
      color: h.color,
      shares: h.shares,
      avgCost: h.avg_cost,
      price: h.price,
      value: cents(value),
      cost: cents(cost),
      pnl: cents(value - cost),
      pnlPct: cost ? +(((value - cost) / cost) * 100).toFixed(2) : 0
    }
  })

  const locked = db
    .prepare(
      `SELECT
         COALESCE((SELECT SUM(stake) FROM market_positions WHERE user_id = ? AND settled = 0), 0) +
         COALESCE((SELECT SUM(stake) FROM battle_bets WHERE user_id = ? AND settled = 0), 0)
         AS total`
    )
    .get(req.user.id, req.user.id).total

  const holdingsValue = cents(positions.reduce((a, p) => a + p.value, 0))
  const lockedStake = cents(locked)
  const cash = cents(req.user.cash)
  res.json({
    cash,
    holdingsValue,
    lockedStake,
    netWorth: cents(cash + holdingsValue + lockedStake),
    positions
  })
})

router.get('/trades', requireAuth, (req, res) => {
  const trades = db
    .prepare(
      `SELECT t.side, t.shares, t.price, t.total, t.created_at,
              m.slug, m.ticker, m.name
         FROM trades t JOIN models m ON m.id = t.model_id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC, t.id DESC LIMIT 100`
    )
    .all(req.user.id)
  res.json({ trades })
})

export default router
