import { Router } from 'express'
import db from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { eloWinProb, settleBattle } from '../battles.js'
import { parsePositiveMoney } from '../money.js'

const router = Router()

const modelStmt = db.prepare(`
  SELECT m.id, m.slug, m.name, m.ticker, m.color, m.price, m.status,
         (SELECT elo FROM model_signals WHERE model_id = m.id ORDER BY captured_at DESC, id DESC LIMIT 1) AS elo
    FROM models m WHERE m.id = ?
`)
const battleTraderStmt = db.prepare(
  'SELECT COUNT(DISTINCT user_id) AS n FROM battle_bets WHERE battle_id = ?'
)

function effectiveStatus(battle) {
  if (battle.status === 'settled') return 'settled'
  const closesAt = battle.closes_at ? Date.parse(battle.closes_at) : NaN
  return Number.isFinite(closesAt) && closesAt <= Date.now() ? 'closing' : 'open'
}

function shape(battle) {
  const a = modelStmt.get(battle.model_a_id)
  const b = modelStmt.get(battle.model_b_id)
  const realPool = battle.pool_a + battle.pool_b
  const total = realPool || 1
  return {
    id: battle.id,
    category: battle.category,
    status: effectiveStatus(battle),
    closesAt: battle.closes_at,
    pool: +realPool.toFixed(2),
    hasBets: realPool > 0,
    traders: battleTraderStmt.get(battle.id).n,
    winnerId: battle.winner_id,
    sides: [
      {
        key: 'a',
        ...a,
        pool: +battle.pool_a.toFixed(2),
        impliedPct: +((battle.pool_a / total) * 100).toFixed(1),
        payout: +(total / (battle.pool_a || 1)).toFixed(2),
        eloProb: +(eloWinProb(a.elo ?? 1200, b.elo ?? 1200) * 100).toFixed(1),
        won: battle.winner_id === a.id
      },
      {
        key: 'b',
        ...b,
        pool: +battle.pool_b.toFixed(2),
        impliedPct: +((battle.pool_b / total) * 100).toFixed(1),
        payout: +(total / (battle.pool_b || 1)).toFixed(2),
        eloProb: +(eloWinProb(b.elo ?? 1200, a.elo ?? 1200) * 100).toFixed(1),
        won: battle.winner_id === b.id
      }
    ]
  }
}

router.get('/', (req, res) => {
  const battles = db
    .prepare("SELECT * FROM battles ORDER BY (status='settled'), created_at DESC")
    .all()
  res.json({ battles: battles.map(shape) })
})

router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT bb.id, bb.stake, bb.settled, bb.payout, bb.created_at, bb.side_model_id,
              b.id AS battle_id, b.status, b.closes_at, b.winner_id, b.category,
              m.ticker AS side_ticker, m.name AS side_name
         FROM battle_bets bb
         JOIN battles b ON b.id = bb.battle_id
         JOIN models m ON m.id = bb.side_model_id
        WHERE bb.user_id = ?
        ORDER BY bb.created_at DESC, bb.id DESC`
    )
    .all(req.user.id)
    .map((row) => ({
      ...row,
      status: effectiveStatus(row),
      won: row.winner_id != null && row.winner_id === row.side_model_id
    }))
  res.json({ positions: rows })
})

router.post('/:id/bet', requireAuth, (req, res) => {
  const { side, stake } = req.body || {}
  const amount = parsePositiveMoney(stake)
  if (amount == null) {
    return res.status(400).json({
      error: 'stake must be finite, at least $0.01, and use at most 2 decimal places'
    })
  }
  if (side !== 'a' && side !== 'b') {
    return res.status(400).json({ error: "side must be 'a' or 'b'" })
  }

  const battle = db.prepare('SELECT * FROM battles WHERE id = ?').get(req.params.id)
  if (!battle) return res.status(404).json({ error: 'battle not found' })
  if (effectiveStatus(battle) !== 'open') {
    return res.status(400).json({ error: 'battle is closed' })
  }

  // An existing battle can outlive a model lifecycle change. Do not accept new
  // stakes when either side has since become suspended or unreleased.
  const a = modelStmt.get(battle.model_a_id)
  const b = modelStmt.get(battle.model_b_id)
  const active = (model) => model && (!model.status || model.status === 'active')
  if (!active(a) || !active(b)) {
    return res.status(400).json({ error: 'battle is unavailable because a model is not active' })
  }

  const sideModelId = side === 'a' ? battle.model_a_id : battle.model_b_id
  const poolCol = side === 'a' ? 'pool_a' : 'pool_b'

  try {
    db.transaction(() => {
      const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(req.user.id).cash
      if (cash + 1e-9 < amount) {
        throw Object.assign(new Error('insufficient funds'), { status: 400 })
      }
      db.prepare('UPDATE users SET cash = ROUND(cash - ?, 2) WHERE id = ?').run(amount, req.user.id)
      db.prepare(`UPDATE battles SET ${poolCol} = ROUND(${poolCol} + ?, 2) WHERE id = ?`).run(
        amount,
        battle.id
      )
      db.prepare(
        `INSERT INTO battle_bets (user_id, battle_id, side_model_id, stake, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(req.user.id, battle.id, sideModelId, amount, new Date().toISOString())
    })()
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    if (status === 500) console.error('[battle bet] failed:', error)
    return res.status(status).json({ error: status === 500 ? 'bet failed' : error.message })
  }

  const fresh = db.prepare('SELECT * FROM battles WHERE id = ?').get(battle.id)
  const shaped = shape(fresh)
  const cash = db.prepare('SELECT cash FROM users WHERE id = ?').get(req.user.id).cash
  req.app.get('io')?.emit('battle:updated', { id: battle.id, battle: shaped })
  res.json({ ok: true, battle: shaped, cash })
})

// Admin: force-settle a battle immediately (otherwise the auto-settler handles it).
router.post('/:id/settle', requireAdmin, (req, res) => {
  const settled = settleBattle(Number(req.params.id))
  if (!settled) return res.status(400).json({ error: 'could not settle (already settled?)' })
  req.app.get('io')?.emit('battle:settled', { id: settled.id, winnerId: settled.winner_id })
  res.json({ ok: true, battle: shape(settled) })
})

export default router
