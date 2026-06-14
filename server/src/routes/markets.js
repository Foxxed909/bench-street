import { Router } from 'express'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { resolveMarket } from '../resolve.js'

const router = Router()

function effectiveStatus(market) {
  if (market.status === 'resolved') return 'resolved'
  if (market.closes_at && new Date(market.closes_at) <= new Date()) return 'closed'
  return 'open'
}

function withOdds(market) {
  const outcomes = db
    .prepare('SELECT id, label, pool FROM market_outcomes WHERE market_id = ? ORDER BY id')
    .all(market.id)
  const total = outcomes.reduce((a, o) => a + o.pool, 0) || 1
  const winner = market.resolved_outcome_id
    ? outcomes.find((o) => o.id === market.resolved_outcome_id)
    : null
  return {
    id: market.id,
    slug: market.slug,
    question: market.question,
    category: market.category,
    rules: market.rules || null,
    status: effectiveStatus(market),
    resolution: market.resolution,
    autoResolvable: !!market.resolver,
    closesAt: market.closes_at,
    resolvedOutcomeId: market.resolved_outcome_id,
    winnerLabel: winner?.label || null,
    isBinary: outcomes.length === 2 && outcomes[0].label === 'Yes' && outcomes[1].label === 'No',
    volume: +total.toFixed(2),
    pool: +total.toFixed(2),
    outcomes: outcomes.map((o) => ({
      id: o.id,
      label: o.label,
      pool: +o.pool.toFixed(2),
      impliedPct: +((o.pool / total) * 100).toFixed(1),
      payout: +(total / (o.pool || 1)).toFixed(2)
    }))
  }
}

router.get('/', (req, res) => {
  const markets = db.prepare('SELECT * FROM markets ORDER BY created_at DESC').all()
  res.json({ markets: markets.map(withOdds) })
})

router.get('/mine', requireAuth, (req, res) => {
  const positions = db
    .prepare(
      `SELECT p.id, p.stake, p.settled, p.payout, p.created_at, p.outcome_id,
              mk.slug, mk.question, mk.status, mk.resolved_outcome_id,
              o.label AS outcome
         FROM market_positions p
         JOIN markets mk ON mk.id = p.market_id
         JOIN market_outcomes o ON o.id = p.outcome_id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC, p.id DESC`
    )
    .all(req.user.id)
    .map((p) => ({
      ...p,
      won: p.resolved_outcome_id != null && p.outcome_id === p.resolved_outcome_id
    }))
  res.json({ positions })
})

router.post('/:slug/bet', requireAuth, (req, res) => {
  const { outcomeId, stake } = req.body || {}
  const amount = Number(stake)
  if (!(amount > 0)) return res.status(400).json({ error: 'stake must be > 0' })

  const market = db.prepare('SELECT * FROM markets WHERE slug = ?').get(req.params.slug)
  if (!market) return res.status(404).json({ error: 'market not found' })
  if (effectiveStatus(market) !== 'open') {
    return res.status(400).json({ error: 'market is closed' })
  }

  const outcome = db
    .prepare('SELECT * FROM market_outcomes WHERE id = ? AND market_id = ?')
    .get(outcomeId, market.id)
  if (!outcome) return res.status(400).json({ error: 'invalid outcome' })

  try {
    db.transaction(() => {
      const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(req.user.id).cash
      if (cash < amount) throw Object.assign(new Error('insufficient funds'), { code: 400 })
      db.prepare('UPDATE users SET cash = cash - ? WHERE id = ?').run(amount, req.user.id)
      db.prepare('UPDATE market_outcomes SET pool = pool + ? WHERE id = ?').run(amount, outcome.id)
      db.prepare(
        `INSERT INTO market_positions (user_id, market_id, outcome_id, stake, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(req.user.id, market.id, outcome.id, amount, new Date().toISOString())
    })()
  } catch (e) {
    return res.status(e.code || 400).json({ error: e.message || 'bet failed' })
  }

  const fresh = db.prepare('SELECT * FROM markets WHERE id = ?').get(market.id)
  const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(req.user.id).cash
  res.json({ ok: true, market: withOdds(fresh), cash })
})

// Admin: resolve a market to a winning outcome and pay backers pro-rata from the pool.
router.post('/:slug/resolve', requireAdmin, (req, res) => {
  const market = db.prepare('SELECT id FROM markets WHERE slug = ?').get(req.params.slug)
  if (!market) return res.status(404).json({ error: 'market not found' })

  const result = resolveMarket(market.id, (req.body || {}).outcomeId)
  if (!result.ok) return res.status(400).json({ error: result.error })

  const fresh = db.prepare('SELECT * FROM markets WHERE id = ?').get(market.id)
  res.json({ ok: true, market: withOdds(fresh), winner: result.winner, paidOut: result.paidOut })
})

export default router
