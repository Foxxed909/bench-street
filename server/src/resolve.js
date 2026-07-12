import db from './db.js'

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

  const total = outcomes.reduce((a, o) => a + o.pool, 0)
  const winPool = winner.pool
  let paid = 0
  let refunded = false

  db.transaction(() => {
    const positions = db
      .prepare('SELECT * FROM market_positions WHERE market_id = ? AND settled = 0')
      .all(marketId)
    const winningPositions = positions.filter((p) => p.outcome_id === winner.id)

    // Seeded pools act as opening liquidity. If the result lands on a side with no
    // actual user backer, the old code silently burned every real user's stake because
    // there was nobody to receive a payout. Refund the unsettled user stakes instead.
    const refundAll = positions.length > 0 && winningPositions.length === 0
    refunded = refundAll

    for (const p of positions) {
      let payout = 0
      if (refundAll) {
        payout = +Number(p.stake).toFixed(2)
      } else if (p.outcome_id === winner.id && winPool > 0) {
        payout = +((p.stake / winPool) * total).toFixed(2)
      }

      if (payout > 0) {
        db.prepare('UPDATE users SET cash = ROUND(cash + ?, 2) WHERE id = ?').run(payout, p.user_id)
        paid += payout
      }
      db.prepare('UPDATE market_positions SET settled = 1, payout = ? WHERE id = ?').run(payout, p.id)
    }
    db.prepare('UPDATE markets SET status = ?, resolved_outcome_id = ? WHERE id = ?').run(
      'resolved',
      winner.id,
      marketId
    )
  })()

  return { ok: true, winner: winner.label, paidOut: +paid.toFixed(2), refunded }
}
