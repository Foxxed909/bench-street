import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../auth.js'
import { parsePositiveShares } from '../money.js'

const router = Router()

// Buy/sell a model at the current live price. Trades don't move price — votes do.
router.post('/', requireAuth, (req, res) => {
  const { slug, side, shares } = req.body || {}
  if (typeof slug !== 'string' || !slug.trim()) {
    return res.status(400).json({ error: 'model slug is required' })
  }
  if (side !== 'buy' && side !== 'sell') {
    return res.status(400).json({ error: "side must be 'buy' or 'sell'" })
  }
  const qty = parsePositiveShares(shares)
  if (qty == null) {
    return res.status(400).json({ error: 'shares must be a finite amount greater than 0 (up to 6 decimals)' })
  }

  const model = db.prepare('SELECT * FROM models WHERE slug = ?').get(slug.trim())
  if (!model) return res.status(404).json({ error: 'model not found' })
  if (model.status && model.status !== 'active') {
    const why = model.status === 'suspended' ? 'suspended' : 'not released yet'
    return res.status(400).json({ error: `this model is ${why} and cannot be traded` })
  }

  const price = Number(model.price)
  // A model with no votes has no price yet — block trading until the crowd sets one.
  if (!Number.isFinite(price) || !(price > 0)) {
    return res.status(400).json({ error: 'no valid price yet — this model needs votes first' })
  }
  const total = Math.round((qty * price + Number.EPSILON) * 100) / 100
  if (!Number.isFinite(total) || !(total > 0)) {
    return res.status(400).json({ error: 'trade value is invalid' })
  }
  const userId = req.user.id

  try {
    const tx = db.transaction(() => {
      const holding = db
        .prepare('SELECT * FROM holdings WHERE user_id = ? AND model_id = ?')
        .get(userId, model.id)

      if (side === 'buy') {
        const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(userId).cash
        if (cash + 1e-9 < total) throw Object.assign(new Error('insufficient funds'), { code: 400 })

        if (holding) {
          const newShares = Number((holding.shares + qty).toFixed(6))
          const newAvg = (holding.avg_cost * holding.shares + total) / newShares
          if (!Number.isFinite(newShares) || !Number.isFinite(newAvg)) {
            throw Object.assign(new Error('trade would create an invalid holding'), { code: 400 })
          }
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
        db.prepare('UPDATE users SET cash = ROUND(cash - ?, 2) WHERE id = ?').run(total, userId)
      } else {
        if (!holding || holding.shares < qty - 1e-9) {
          throw Object.assign(new Error('not enough shares'), { code: 400 })
        }
        const remaining = Number((holding.shares - qty).toFixed(6))
        if (remaining <= 1e-6) {
          db.prepare('DELETE FROM holdings WHERE id = ?').run(holding.id)
        } else {
          db.prepare('UPDATE holdings SET shares = ? WHERE id = ?').run(remaining, holding.id)
        }
        db.prepare('UPDATE users SET cash = ROUND(cash + ?, 2) WHERE id = ?').run(total, userId)
      }

      db.prepare(
        `INSERT INTO trades (user_id, model_id, side, shares, price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, model.id, side, qty, price, total, new Date().toISOString())
    })
    tx()
  } catch (e) {
    return res.status(e.code || 400).json({ error: e.message || 'trade failed' })
  }

  const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(userId).cash
  res.json({ ok: true, executed: { side, shares: qty, price, total }, cash })
})

export default router
