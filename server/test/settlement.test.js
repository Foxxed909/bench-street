import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

// Point the SQLite singleton at a throwaway directory BEFORE importing any server module.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'bs-settlement-'))

const { default: db } = await import('../src/db.js')
const { resolveMarket } = await import('../src/resolve.js')
const { settleBattle, ensureOpenBattles } = await import('../src/battles.js')

const now = () => new Date().toISOString()

function makeUser(username, cash = 1000) {
  const info = db
    .prepare('INSERT INTO users (username, password_hash, cash, created_at) VALUES (?, ?, ?, ?)')
    .run(username, 'x', cash, now())
  return info.lastInsertRowid
}

function makeModel(slug, { name = slug, status = 'active', elo = 1300 } = {}) {
  const info = db
    .prepare(
      `INSERT INTO models (slug, name, company, ticker, status, created_at)
       VALUES (?, ?, 'TestLab', ?, ?, ?)`
    )
    .run(slug, name, slug.toUpperCase().slice(0, 6), status, now())
  const id = info.lastInsertRowid
  db.prepare(
    'INSERT INTO model_signals (model_id, elo, captured_at) VALUES (?, ?, ?)'
  ).run(id, elo, now())
  return id
}

function makeMarket(slug, outcomes) {
  const info = db
    .prepare("INSERT INTO markets (slug, question, created_at) VALUES (?, ?, ?)")
    .run(slug, `Q ${slug}?`, now())
  const marketId = info.lastInsertRowid
  const ids = outcomes.map(
    (o) =>
      db
        .prepare('INSERT INTO market_outcomes (market_id, label, pool) VALUES (?, ?, ?)')
        .run(marketId, o.label, o.pool).lastInsertRowid
  )
  return { marketId, outcomeIds: ids }
}

function stake(userId, marketId, outcomeId, amount) {
  db.prepare(
    `INSERT INTO market_positions (user_id, market_id, outcome_id, stake, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, marketId, outcomeId, amount, now())
}

const cashOf = (id) => db.prepare('SELECT cash FROM users WHERE id = ?').get(id).cash

afterEach(() => vi.restoreAllMocks())

describe('market settlement', () => {
  it('pays winners pro-rata from the combined pool and settles losers at zero', () => {
    const alice = makeUser('m-alice')
    const bob = makeUser('m-bob')
    const { marketId, outcomeIds } = makeMarket('pro-rata', [
      { label: 'Yes', pool: 100 },
      { label: 'No', pool: 200 }
    ])
    stake(alice, marketId, outcomeIds[0], 100)
    stake(bob, marketId, outcomeIds[1], 200)

    const result = resolveMarket(marketId, outcomeIds[0])
    expect(result.ok).toBe(true)
    expect(result.winner).toBe('Yes')
    expect(result.paidOut).toBe(300)
    expect(cashOf(alice)).toBe(1300) // full combined pool
    expect(cashOf(bob)).toBe(1000) // stake already deducted pre-test; loses it

    const positions = db
      .prepare('SELECT settled, payout FROM market_positions WHERE market_id = ? ORDER BY id')
      .all(marketId)
    expect(positions.every((p) => p.settled === 1)).toBe(true)
    expect(positions.map((p) => p.payout)).toEqual([300, 0])
  })

  it('splits a shared winning pool by stake without creating or destroying cents', () => {
    const a = makeUser('m-a')
    const b = makeUser('m-b')
    const c = makeUser('m-c')
    const { marketId, outcomeIds } = makeMarket('split', [
      { label: 'Yes', pool: 100 },
      { label: 'No', pool: 200 }
    ])
    stake(a, marketId, outcomeIds[0], 33.33)
    stake(b, marketId, outcomeIds[0], 66.67)
    stake(c, marketId, outcomeIds[1], 200)

    const result = resolveMarket(marketId, outcomeIds[0])
    expect(result.ok).toBe(true)
    const payouts = db
      .prepare('SELECT payout FROM market_positions WHERE market_id = ? AND payout > 0')
      .all(marketId)
      .map((p) => p.payout)
    const sum = payouts.reduce((s, p) => s + Math.round(p * 100), 0)
    expect(sum).toBe(result.paidOut * 100) // cent-exact conservation
    expect(result.paidOut).toBe(300)
  })

  it('refunds every stake when nobody backed the winning outcome', () => {
    const bob = makeUser('m-refund')
    const { marketId, outcomeIds } = makeMarket('refund', [
      { label: 'Yes', pool: 50 }, // seeded liquidity only, no user positions
      { label: 'No', pool: 200 }
    ])
    stake(bob, marketId, outcomeIds[1], 200)

    const result = resolveMarket(marketId, outcomeIds[0])
    expect(result.ok).toBe(true)
    expect(result.refunded).toBe(true)
    expect(cashOf(bob)).toBe(1200) // stake returned, not burned
  })

  it('refuses to settle the same market twice', () => {
    const { marketId, outcomeIds } = makeMarket('twice', [
      { label: 'Yes', pool: 10 },
      { label: 'No', pool: 10 }
    ])
    expect(resolveMarket(marketId, outcomeIds[0]).ok).toBe(true)
    expect(resolveMarket(marketId, outcomeIds[0])).toEqual({
      ok: false,
      error: 'already resolved'
    })
  })

  it('rejects an outcome that does not belong to the market', () => {
    const { marketId } = makeMarket('bad-outcome', [
      { label: 'Yes', pool: 10 },
      { label: 'No', pool: 10 }
    ])
    expect(resolveMarket(marketId, 999999).ok).toBe(false)
  })
})

describe('battle settlement', () => {
  function makeBattle(aId, bId, { poolA = 0, poolB = 0 } = {}) {
    return db
      .prepare(
        `INSERT INTO battles (model_a_id, model_b_id, category, pool_a, pool_b, closes_at, created_at)
         VALUES (?, ?, 'Test', ?, ?, ?, ?)`
      )
      .run(aId, bId, poolA, poolB, now(), now()).lastInsertRowid
  }

  it('pays the winning side pro-rata and zeroes the losing side', () => {
    const a = makeModel('battle-a')
    const b = makeModel('battle-b')
    const alice = makeUser('b-alice')
    const bob = makeUser('b-bob')
    const battleId = makeBattle(a, b, { poolA: 100, poolB: 300 })
    db.prepare(
      `INSERT INTO battle_bets (user_id, battle_id, side_model_id, stake, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(alice, battleId, a, 100, now())
    db.prepare(
      `INSERT INTO battle_bets (user_id, battle_id, side_model_id, stake, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(bob, battleId, b, 300, now())

    vi.spyOn(Math, 'random').mockReturnValue(0) // forces side A to win
    const settled = settleBattle(battleId)
    expect(settled.status).toBe('settled')
    expect(settled.winner_id).toBe(a)
    expect(cashOf(alice)).toBe(1400) // whole 400 pool
    expect(cashOf(bob)).toBe(1000)
  })

  it('refunds all bets when the winning side had no backers', () => {
    const a = makeModel('battle-c')
    const b = makeModel('battle-d')
    const bob = makeUser('b-refund')
    const battleId = makeBattle(a, b, { poolA: 50, poolB: 200 })
    db.prepare(
      `INSERT INTO battle_bets (user_id, battle_id, side_model_id, stake, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(bob, battleId, b, 200, now())

    vi.spyOn(Math, 'random').mockReturnValue(0) // side A wins; nobody backed it
    const settled = settleBattle(battleId)
    expect(settled.winner_id).toBe(a)
    expect(cashOf(bob)).toBe(1200)
  })

  it('never generates fresh battles that include suspended or upcoming models', () => {
    makeModel('gen-active-1', { elo: 1300 })
    makeModel('gen-active-2', { elo: 1310 })
    const suspended = makeModel('gen-suspended', { status: 'suspended', elo: 1305 })
    const upcoming = makeModel('gen-upcoming', { status: 'upcoming', elo: 1305 })

    ensureOpenBattles({ log: () => {} })

    const offenders = db
      .prepare(
        'SELECT COUNT(*) AS n FROM battles WHERE model_a_id IN (?, ?) OR model_b_id IN (?, ?)'
      )
      .get(suspended, upcoming, suspended, upcoming).n
    expect(offenders).toBe(0)
    const open = db.prepare("SELECT COUNT(*) AS n FROM battles WHERE status = 'open'").get().n
    expect(open).toBeGreaterThan(0)
  })
})
