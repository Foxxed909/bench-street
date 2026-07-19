import { Router } from 'express'
import db from '../db.js'
import { executionPriceFor } from '../pricing.js'

const router = Router()

const cents = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

// Rank users by net worth = cash + self-neutralized model holdings + stakes still
// locked in open prediction/battle positions. A user's own vote cannot inflate their
// leaderboard value, while every other account's sentiment still affects the quote.
router.get('/', (req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.username, u.cash,
              COALESCE((
                SELECT SUM(mp.stake) FROM market_positions mp
                 WHERE mp.user_id = u.id AND mp.settled = 0
              ), 0) AS market_stake,
              COALESCE((
                SELECT SUM(bb.stake) FROM battle_bets bb
                 WHERE bb.user_id = u.id AND bb.settled = 0
              ), 0) AS battle_stake
         FROM users u`
    )
    .all()

  const holdingsByUser = new Map()
  const holdings = db
    .prepare(
      `SELECT h.user_id, h.shares,
              m.base_votes, m.like_count, m.dislike_count, m.sentiment,
              s.api_price, COALESCE(v.value, 0) AS my_vote
         FROM holdings h
         JOIN models m ON m.id = h.model_id
         LEFT JOIN model_signals s ON s.id = (
           SELECT id FROM model_signals WHERE model_id = m.id
            ORDER BY captured_at DESC, id DESC LIMIT 1
         )
         LEFT JOIN votes v ON v.model_id = m.id AND v.user_id = h.user_id
        WHERE h.shares > 0`
    )
    .all()

  for (const holding of holdings) {
    const price = executionPriceFor({
      baseVotes: holding.base_votes,
      likes: holding.like_count,
      dislikes: holding.dislike_count,
      myVote: holding.my_vote,
      tokenPrice: holding.api_price,
      sentiment: holding.sentiment
    })
    const value = Number(holding.shares) * price
    holdingsByUser.set(holding.user_id, (holdingsByUser.get(holding.user_id) || 0) + value)
  }

  const rows = users
    .map((u) => {
      const cash = cents(u.cash)
      const holdingsValue = cents(holdingsByUser.get(u.id) || 0)
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
