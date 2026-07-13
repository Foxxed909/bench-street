import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../auth.js'
import { calculateTradeTotal, parsePositiveShares } from '../money.js'
import { executionPriceFor } from '../pricing.js'

const router = Router()

// Buy/sell a model at the current quote. The public board reflects every vote, but
// this account's own stance is removed from its executable price to prevent self-dealing.
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
    return res.status(400).json({
      error: 'shares must be finite, greater than 0, and use at most 6 decimal places'
    })
  }

  const userId = req.user.id
  const model = db
    .prepare(
      `SELECT m.*, s.api_price, COALESCE(v.value, 0) AS my_vote
         FROM models m
         LEFT JOIN model_signals s ON s.id = (
           SELECT id FROM model_signals WHERE model_id = m.id
            ORDER BY captured_at DESC, id DESC LIMIT 1
         )
         LEFT JOIN votes v ON v.model_id = m.id AND v.user_id = ?
        WHERE m.slug = ?`
    )
    .get(userId, slug.trim())
  if (!model) return res.status(404).json({ error: 'model not found' })
  if (model.status && model.status !== 'active') {
    const why = model.status === 'suspended' ? 'suspended' : 'not released yet'
    return res.status(400).json({ error: `this model is ${why} and cannot be traded` })
  }

  const publicPrice = Number(model.price)
  const price = executionPriceFor({
    baseVotes: model.base_votes,
    likes: model.like_count,
    dislikes: model.dislike_count,
    myVote: model.my_vote,
    tokenPrice: model.api_price
  })
  if (!Number.isFinite(price) || !(price > 0)) {
    return res.status(400).json({
      error: 'no valid executable price yet — this model needs more independent support'
    })
  }
  const total = calculateTradeTotal(qty, price)
  if (total == null) {
    return res.status(400).json({ error: 'trade value must settle to at least $0.01' })
  }

  try {
    const tx = db.transaction(() => {
      const holding = db
        .prepare('SELECT * FROM holdings WHERE user_id = ? AND model_id = ?')
        .get(userId, model.id)

      if (side === 'buy') {
        const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(userId).cash
        if (cash + 1e-9 < total) {
          throw Object.assign(new Error('insufficient funds'), { status: 400 })
        }

        if (holding) {
          const newShares = Number((holding.shares + qty).toFixed(6))
          const newAvg = (holding.avg_cost * holding.shares + total) / newShares
          if (!Number.isFinite(newShares) || !Number.isFinite(newAvg)) {
            throw Object.assign(new Error('trade would create an invalid holding'), { status: 400 })
          }
          db.prepare('UPDATE holdings SET shares = ?, avg_cost = ? WHERE id = ?').run(
            newShares,
            newAvg,
            holding.id
          )
        } else {
          // Cost basis must reflect the cents actually charged. For a fractional trade,
          // the rounded execution total can differ slightly from quote × quantity.
          const avgCost = total / qty
          if (!Number.isFinite(avgCost)) {
            throw Object.assign(new Error('trade would create an invalid holding'), { status: 400 })
          }
          db.prepare(
            'INSERT INTO holdings (user_id, model_id, shares, avg_cost) VALUES (?, ?, ?, ?)'
          ).run(userId, model.id, qty, avgCost)
        }
        db.prepare('UPDATE users SET cash = ROUND(cash - ?, 2) WHERE id = ?').run(total, userId)
      } else {
        if (!holding || holding.shares < qty - 1e-9) {
          throw Object.assign(new Error('not enough shares'), { status: 400 })
        }
        const remaining = Number((holding.shares - qty).toFixed(6))
        // One millionth of a share is valid, so only delete a genuinely empty holding.
        if (remaining <= 0) {
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
    const status = Number.isInteger(e?.status) ? e.status : 500
    if (status === 500) console.error('[trade] failed:', e)
    return res.status(status).json({ error: status === 500 ? 'trade failed' : e.message })
  }

  const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(userId).cash
  res.json({
    ok: true,
    executed: {
      side,
      shares: qty,
      price,
      publicPrice,
      selfVoteExcluded: model.my_vote !== 0,
      total
    },
    cash
  })
})

export default router
