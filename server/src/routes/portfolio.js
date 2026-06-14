import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

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
      value: +value.toFixed(2),
      cost: +cost.toFixed(2),
      pnl: +(value - cost).toFixed(2),
      pnlPct: cost ? +(((value - cost) / cost) * 100).toFixed(2) : 0
    }
  })

  const holdingsValue = +positions.reduce((a, p) => a + p.value, 0).toFixed(2)
  const cash = +req.user.cash.toFixed(2)
  res.json({
    cash,
    holdingsValue,
    netWorth: +(cash + holdingsValue).toFixed(2),
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
