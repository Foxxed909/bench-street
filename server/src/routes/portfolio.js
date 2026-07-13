import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../auth.js'
import { executionPriceFor, perVoteValue } from '../pricing.js'

const router = Router()
const cents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

router.get('/', requireAuth, (req, res) => {
  const holdings = db
    .prepare(
      `SELECT h.shares, h.avg_cost,
              m.id AS model_id, m.slug, m.name, m.ticker, m.color,
              m.price AS public_price, m.prev_close, m.base_votes,
              m.like_count, m.dislike_count,
              s.api_price, COALESCE(v.value, 0) AS my_vote
         FROM holdings h
         JOIN models m ON m.id = h.model_id
         LEFT JOIN model_signals s ON s.id = (
           SELECT id FROM model_signals WHERE model_id = m.id
            ORDER BY captured_at DESC, id DESC LIMIT 1
         )
         LEFT JOIN votes v ON v.model_id = m.id AND v.user_id = h.user_id
        WHERE h.user_id = ? AND h.shares > 0
        ORDER BY (h.shares * m.price) DESC`
    )
    .all(req.user.id)

  const positions = holdings.map((h) => {
    const price = executionPriceFor({
      baseVotes: h.base_votes,
      likes: h.like_count,
      dislikes: h.dislike_count,
      myVote: h.my_vote,
      tokenPrice: h.api_price
    })
    const value = h.shares * price
    const cost = h.shares * h.avg_cost
    return {
      modelId: h.model_id,
      slug: h.slug,
      name: h.name,
      ticker: h.ticker,
      color: h.color,
      shares: h.shares,
      avgCost: h.avg_cost,
      price,
      publicPrice: h.public_price,
      perVoteValue: perVoteValue(h.api_price),
      baseVotes: h.base_votes || 0,
      likes: h.like_count || 0,
      dislikes: h.dislike_count || 0,
      myVote: h.my_vote || 0,
      selfVoteExcluded: h.my_vote !== 0,
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
