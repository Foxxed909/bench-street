import { Router } from 'express'
import db from '../db.js'
import { VOTE_RATE, perVoteValue, pushModelPrice } from '../pricing.js'
import { signalsStatus } from '../ingest.js'
import { optionalAuth, requireAuth } from '../auth.js'

const router = Router()

function decorate(m, votedByMe) {
  const change = m.price - m.prev_close
  const changePct = m.prev_close ? (change / m.prev_close) * 100 : 0
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    company: m.company,
    ticker: m.ticker,
    openSource: !!m.open_source,
    color: m.color,
    price: m.price,
    prevClose: m.prev_close,
    tokenPrice: m.api_price ?? null,
    perVoteValue: perVoteValue(m.api_price),
    votes: m.vote_count || 0,
    votedByMe: !!votedByMe,
    liveSignals: !!(m.openrouter_id || m.hf_id),
    change: +change.toFixed(2),
    changePct: +changePct.toFixed(2),
    signals: {
      elo: m.elo,
      usage: m.usage,
      bench: m.bench,
      downloads: m.downloads,
      apiPrice: m.api_price
    }
  }
}

const SELECT = `
  SELECT m.id, m.slug, m.name, m.company, m.ticker, m.open_source, m.color,
         m.price, m.prev_close, m.vote_count, m.openrouter_id, m.hf_id,
         s.elo, s.usage, s.bench, s.downloads, s.api_price
    FROM models m
    LEFT JOIN model_signals s ON s.id = (
      SELECT id FROM model_signals
       WHERE model_id = m.id ORDER BY captured_at DESC, id DESC LIMIT 1
    )`

const listStmt = db.prepare(`${SELECT} ORDER BY m.price DESC`)

function votedSetFor(userId) {
  if (!userId) return new Set()
  return new Set(
    db.prepare('SELECT model_id FROM votes WHERE user_id = ?').all(userId).map((r) => r.model_id)
  )
}

router.get('/', optionalAuth, (req, res) => {
  const voted = votedSetFor(req.user?.id)
  res.json({
    models: listStmt.all().map((m) => decorate(m, voted.has(m.id))),
    signals: signalsStatus(),
    voteRate: VOTE_RATE
  })
})

router.get('/:slug', optionalAuth, (req, res) => {
  const m = db.prepare(`${SELECT} WHERE m.slug = ?`).get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })

  const votedByMe = req.user
    ? !!db.prepare('SELECT 1 FROM votes WHERE user_id = ? AND model_id = ?').get(req.user.id, m.id)
    : false

  const candles = db
    .prepare(
      `SELECT t, open, high, low, close
         FROM price_candles WHERE model_id = ?
        ORDER BY t DESC LIMIT 240`
    )
    .all(m.id)
    .reverse()

  res.json({ model: decorate(m, votedByMe), candles, voteRate: VOTE_RATE })
})

// Toggle the signed-in user's vote for a model. One vote per user per model.
router.post('/:slug/vote', requireAuth, (req, res) => {
  const m = db.prepare('SELECT id FROM models WHERE slug = ?').get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })

  let voted
  db.transaction(() => {
    const existing = db
      .prepare('SELECT 1 FROM votes WHERE user_id = ? AND model_id = ?')
      .get(req.user.id, m.id)
    if (existing) {
      db.prepare('DELETE FROM votes WHERE user_id = ? AND model_id = ?').run(req.user.id, m.id)
      db.prepare('UPDATE models SET vote_count = MAX(0, vote_count - 1) WHERE id = ?').run(m.id)
      voted = false
    } else {
      db.prepare('INSERT INTO votes (user_id, model_id, created_at) VALUES (?, ?, ?)').run(
        req.user.id,
        m.id,
        new Date().toISOString()
      )
      db.prepare('UPDATE models SET vote_count = vote_count + 1 WHERE id = ?').run(m.id)
      voted = true
    }
  })()

  const votes = db.prepare('SELECT vote_count FROM models WHERE id = ?').get(m.id).vote_count
  // Votes are the price: recompute this model and broadcast the new price live.
  const price = pushModelPrice(req.app.get('io'), m.id)
  res.json({ ok: true, voted, votes, price })
})

export default router
