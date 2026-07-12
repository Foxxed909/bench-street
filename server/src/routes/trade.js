import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../auth.js'
import { calculateTradeTotal, parsePositiveShares } from '../validation.js'

const router = Router()

// Buy/sell a model at the current live price. Trades don't move price — votes do.
router.post('/', requireAuth, (req, res) => {
  const { slug, side, shares } = req.body || {}
  if (side !== 'buy' && side !== 'sell') {
    return res.status(400).json({ error: "side must be 'buy' or 'sell'" })
  }
  const qty = parsePositiveShares(shares)
  if (qty == null) {
    return res.status(400).json({
      error: 'shares must be a positive finite number with at most 6 decimal places'
    })
  }

  const model = db.prepare('SELECT * FROM models WHERE slug = ?').get(slug)
  if (!model) return res.status(404).json({ error: 'model not found' })
  if (model.status && model.status !== 'active') {
    const why = model.status === 'suspended' ? 'suspended' : 'not released yet'
    return res.status(400).json({ error: `this model is ${why} and cannot be traded` })
  }

  const price = model.price
  // A model with no votes has no price yet — block trading until the crowd sets one.
  if (!(price > 0)) {
    return res.status(400).json({ error: 'no price yet — this model needs votes first' })
  }
  const total = calculateTradeTotal(qty, price)
  if (total == null) {
    return res.status(400).json({ error: 'trade value must be at least $0.01' })
  }
  const userId = req.user.id

  try {
    const tx = db.transaction(() => {
      const holding = db
        .prepare('SELECT * FROM holdings WHERE user_id = ? AND model_id = ?')
        .get(userId, model.id)

      if (side === 'buy') {
        const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(userId).cash
        if (cash < total) throw Object.assign(new Error('insufficient funds'), { status: 400 })

        if (holding) {
          const newShares = holding.shares + qty
          const newAvg = (holding.avg_cost * holding.shares + total) / newShares
          db.prepare('UPDATE holdings SET shares = ?, avg_cost = ? WHERE id = ?').run(
            newShares,
            newAvg,
            holding.id
          )
        } else {
          db.prepare(
            'INSERT INTO holdings (user_id, model_id, shares, avg_cost) VALUES (?, ?, ?, ?)'
          ).run(userId, model.id, qty, price)
        }
        db.prepare('UPDATE users SET cash = cash - ? WHERE id = ?').run(total, userId)
      } else {
        if (!holding || holding.shares < qty - 1e-9) {
          throw Object.assign(new Error('not enough shares'), { status: 400 })
        }
        const remaining = holding.shares - qty
        if (remaining <= 1e-6) {
          db.prepare('DELETE FROM holdings WHERE id = ?').run(holding.id)
        } else {
          db.prepare('UPDATE holdings SET shares = ? WHERE id = ?').run(remaining, holding.id)
        }
        db.prepare('UPDATE users SET cash = cash + ? WHERE id = ?').run(total, userId)
      }

      db.prepare(
        `INSERT INTO trades (user_id, model_id, side, shares, price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, model.id, side, qty, price, total, new Date().toISOString())
    })
    tx()
  } catch (e) {
    const status = Number.isInteger(e?.status) ? e.status : 500
    return res.status(status).json({ error: status === 500 ? 'trade failed' : e.message })
  }

  const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(userId).cash
  res.json({ ok: true, executed: { side, shares: qty, price, total }, cash })
})

export default router
