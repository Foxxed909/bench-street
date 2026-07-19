import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'bs-seed-'))

const { default: db } = await import('../src/db.js')
const { seedDatabase, ROSTER, MARKETS } = await import('../src/seed.js')

beforeAll(() => {
  seedDatabase()
})

describe('seed data invariants', () => {
  it('is idempotent — a second run changes no counts', () => {
    const before = {
      models: db.prepare('SELECT COUNT(*) AS n FROM models').get().n,
      markets: db.prepare('SELECT COUNT(*) AS n FROM markets').get().n,
      outcomes: db.prepare('SELECT COUNT(*) AS n FROM market_outcomes').get().n
    }
    seedDatabase()
    const after = {
      models: db.prepare('SELECT COUNT(*) AS n FROM models').get().n,
      markets: db.prepare('SELECT COUNT(*) AS n FROM markets').get().n,
      outcomes: db.prepare('SELECT COUNT(*) AS n FROM market_outcomes').get().n
    }
    expect(after).toEqual(before)
    expect(after.models).toBe(ROSTER.length)
  })

  it('gives every active model a positive opening price', () => {
    const flat = db
      .prepare("SELECT COUNT(*) AS n FROM models WHERE status = 'active' AND price <= 0")
      .get().n
    expect(flat).toBe(0)
  })

  // Regression: the auto-resolver maps a winning model to a market outcome BY display
  // name. A model rename that skips the market labels leaves the market permanently
  // unresolvable (this bit us when "GPT-5.6 Pro" became "GPT-5.6 Sol Pro").
  it('keeps candidate-market outcome labels equal to model display names', () => {
    const nameBySlug = new Map(ROSTER.map((m) => [m.slug, m.name]))
    for (const market of MARKETS) {
      const candidates = market.resolver?.candidates
      if (!candidates?.length) continue
      const labels = market.outcomes.map((o) => o.label)
      for (const slug of candidates) {
        const name = nameBySlug.get(slug)
        expect(name, `market ${market.slug}: unknown candidate slug ${slug}`).toBeDefined()
        expect(labels, `market ${market.slug}: no outcome labeled "${name}"`).toContain(name)
      }
    }
  })

  it('repairs stale outcome labels on unresolved markets at boot', () => {
    const market = db.prepare("SELECT id FROM markets WHERE slug = 'bridgebench-top-2026'").get()
    const outcome = db
      .prepare('SELECT id, label FROM market_outcomes WHERE market_id = ? ORDER BY id LIMIT 1')
      .get(market.id)
    db.prepare('UPDATE market_outcomes SET label = ? WHERE id = ?').run('Stale Old Name', outcome.id)

    seedDatabase()

    const repaired = db.prepare('SELECT label FROM market_outcomes WHERE id = ?').get(outcome.id)
    expect(repaired.label).toBe(outcome.label)
  })

  it('leaves resolved markets untouched by the label sync', () => {
    const market = db.prepare("SELECT id FROM markets WHERE slug = 'most-valued-2026'").get()
    const outcome = db
      .prepare('SELECT id, label FROM market_outcomes WHERE market_id = ? ORDER BY id LIMIT 1')
      .get(market.id)
    db.prepare("UPDATE markets SET status = 'resolved', resolved_outcome_id = ? WHERE id = ?").run(
      outcome.id,
      market.id
    )
    db.prepare('UPDATE market_outcomes SET label = ? WHERE id = ?').run('Historic Label', outcome.id)

    seedDatabase()

    const kept = db.prepare('SELECT label FROM market_outcomes WHERE id = ?').get(outcome.id)
    expect(kept.label).toBe('Historic Label')

    // restore for any later assertions
    db.prepare("UPDATE markets SET status = 'open', resolved_outcome_id = NULL WHERE id = ?").run(market.id)
    db.prepare('UPDATE market_outcomes SET label = ? WHERE id = ?').run(outcome.label, outcome.id)
    seedDatabase()
  })

  it('keeps suspended and upcoming models out of the opening line', () => {
    const rows = db
      .prepare("SELECT base_votes, price FROM models WHERE status != 'active'")
      .all()
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.base_votes).toBe(0)
      expect(r.price).toBe(0)
    }
  })
})
