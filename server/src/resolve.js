import db from './db.js'
import { allocateParimutuelPayouts } from './money.js'

// Settle a prediction market to a winning outcome and pay backers pro-rata from
// the combined pool. Shared by the admin route and the auto-resolver.
// Returns { ok, winner, paidOut, refunded } or { ok:false, error }.
export function resolveMarket(marketId, outcomeId) {
  const market = db.prepare('SELECT * FROM markets WHERE id = ?').get(marketId)
  if (!market) return { ok: false, error: 'market not found' }
  if (market.status === 'resolved') return { ok: false, error: 'already resolved' }

  const outcomes = db.prepare('SELECT * FROM market_outcomes WHERE market_id = ?').all(marketId)
  const winner = outcomes.find((o) => o.id === Number(outcomeId))
  if (!winner) return { ok: false, error: 'invalid outcome' }

  const total = outcomes.reduce((sum, outcome) => sum + Number(outcome.pool || 0), 0)
  const winPool = Number(winner.pool || 0)
  let paidCents = 0
  let refunded = false

  db.transaction(() => {
    const positions = db
      .prepare('SELECT * FROM market_positions WHERE market_id = ? AND settled = 0')
      .all(marketId)
    const winningPositions = positions.filter((position) => position.outcome_id === winner.id)

    // Seeded pools act as opening liquidity. If the result lands on a side with no
    // actual user backer, refund unsettled user stakes instead of silently burning them.
    const refundAll = positions.length > 0 && winningPositions.length === 0
    const payouts = allocateParimutuelPayouts(total, winPool, winningPositions)
    refunded = refundAll

    for (const position of positions) {
      let payout = 0
      if (refundAll) {
        const stake = Number(position.stake)
        payout = Number.isFinite(stake) && stake > 0 ? Math.round((stake + Number.EPSILON) * 100) / 100 : 0
      } else {
        payout = payouts.get(position.id) || 0
      }

      if (payout > 0) {
        db.prepare('UPDATE users SET cash = ROUND(cash + ?, 2) WHERE id = ?').run(
          payout,
          position.user_id
        )
        paidCents += Math.round(payout * 100)
      }
      db.prepare('UPDATE market_positions SET settled = 1, payout = ? WHERE id = ?').run(
        payout,
        position.id
      )
    }
    db.prepare('UPDATE markets SET status = ?, resolved_outcome_id = ? WHERE id = ?').run(
      'resolved',
      winner.id,
      marketId
    )
  })()

  return { ok: true, winner: winner.label, paidOut: paidCents / 100, refunded }
}
