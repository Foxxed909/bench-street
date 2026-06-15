import db from './db.js'

// Standard Elo expected score: P(A beats B).
export function eloWinProb(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
}

function currentElo(modelId) {
  const row = db
    .prepare(
      'SELECT elo FROM model_signals WHERE model_id = ? ORDER BY captured_at DESC, id DESC LIMIT 1'
    )
    .get(modelId)
  return row?.elo ?? 1200
}

// Settle a battle: roll the winner by Elo win-probability, pay backers of the winning
// side pro-rata from the combined pool. Returns the settled battle or null.
export function settleBattle(battleId) {
  const battle = db.prepare('SELECT * FROM battles WHERE id = ?').get(battleId)
  if (!battle || battle.status === 'settled') return null

  const eloA = currentElo(battle.model_a_id)
  const eloB = currentElo(battle.model_b_id)
  const pA = eloWinProb(eloA, eloB)
  const winnerId = Math.random() < pA ? battle.model_a_id : battle.model_b_id

  const total = battle.pool_a + battle.pool_b
  const winPool = winnerId === battle.model_a_id ? battle.pool_a : battle.pool_b
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    const bets = db
      .prepare('SELECT * FROM battle_bets WHERE battle_id = ? AND settled = 0')
      .all(battleId)
    for (const bet of bets) {
      let payout = 0
      if (bet.side_model_id === winnerId && winPool > 0) {
        payout = +((bet.stake / winPool) * total).toFixed(2)
        db.prepare('UPDATE users SET cash = cash + ? WHERE id = ?').run(payout, bet.user_id)
      }
      db.prepare('UPDATE battle_bets SET settled = 1, payout = ? WHERE id = ?').run(payout, bet.id)
    }
    db.prepare(
      'UPDATE battles SET status = ?, winner_id = ?, win_prob_a = ?, settled_at = ? WHERE id = ?'
    ).run('settled', winnerId, +pA.toFixed(4), now, battleId)
  })
  run()

  return db.prepare('SELECT * FROM battles WHERE id = ?').get(battleId)
}

const CATEGORIES = ['Reasoning', 'Coding', 'Math', 'Creative writing', 'Agentic', 'General knowledge']
const TARGET_OPEN = 6

// Keep the Arena alive: top up to TARGET_OPEN open battles with fresh random
// matchups (weighted toward closely-rated models so fights are competitive).
export function ensureOpenBattles({ log = console.log } = {}) {
  const open = db
    .prepare("SELECT COUNT(*) AS n FROM battles WHERE status = 'open'")
    .get().n
  if (open >= TARGET_OPEN) return

  const models = db
    .prepare(
      `SELECT m.id, (SELECT elo FROM model_signals WHERE model_id=m.id ORDER BY captured_at DESC, id DESC LIMIT 1) AS elo
         FROM models m`
    )
    .all()
  if (models.length < 2) return

  const ins = db.prepare(`
    INSERT INTO battles (model_a_id, model_b_id, category, pool_a, pool_b, closes_at, created_at)
    VALUES (?, ?, ?, 0, 0, ?, ?)
  `)
  const now = new Date().toISOString()

  for (let need = open; need < TARGET_OPEN; need++) {
    const a = models[Math.floor(Math.random() * models.length)]
    // Prefer an opponent within ~80 Elo for a competitive matchup.
    const near = models.filter((m) => m.id !== a.id && Math.abs((m.elo ?? 1200) - (a.elo ?? 1200)) <= 80)
    const pool = near.length ? near : models.filter((m) => m.id !== a.id)
    const b = pool[Math.floor(Math.random() * pool.length)]
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    // Stagger closes so they don't all settle at once, and keep them open long
    // enough that the Arena always shows live matchups: 20–50 min out.
    const mins = 20 + Math.floor(Math.random() * 30)
    const closesAt = new Date(Date.now() + mins * 60000).toISOString()
    ins.run(a.id, b.id, cat, closesAt, now)
  }
  log(`[arena] topped up to ${TARGET_OPEN} open battles`)
}

// Periodically settle any open battle past its close time, then refill.
export function startBattleSettler({ io = null, log = console.log } = {}) {
  const tick = () => {
    const due = db
      .prepare("SELECT id FROM battles WHERE status = 'open' AND closes_at IS NOT NULL AND closes_at <= ?")
      .all(new Date().toISOString())
    for (const b of due) {
      const settled = settleBattle(b.id)
      if (settled) {
        log(`[arena] settled battle #${b.id} → winner model ${settled.winner_id}`)
        if (io) io.emit('battle:settled', { id: b.id, winnerId: settled.winner_id })
      }
    }
    ensureOpenBattles({ log })
    if (due.length && io) io.emit('battle:new')
  }
  ensureOpenBattles({ log })
  const timer = setInterval(tick, 15000)
  return () => clearInterval(timer)
}
