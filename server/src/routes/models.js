import { Router } from 'express'
import db from '../db.js'
import { executionPriceFor, VOTE_RATE, perVoteValue, pushModelPrice } from '../pricing.js'
import { signalsStatus } from '../ingest.js'
import { optionalAuth, requireAuth } from '../auth.js'

const router = Router()

function parseBenchmarks(json) {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function decorate(m, myVote = 0) {
  const change = m.price - m.prev_close
  const changePct = m.prev_close ? (change / m.prev_close) * 100 : 0
  const likes = m.like_count || 0
  const dislikes = m.dislike_count || 0
  const total = likes + dislikes
  const executionPrice = executionPriceFor({
    baseVotes: m.base_votes,
    likes,
    dislikes,
    myVote,
    tokenPrice: m.api_price
  })
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    company: m.company,
    ticker: m.ticker,
    openSource: !!m.open_source,
    color: m.color,
    price: m.price,
    executionPrice,
    selfVoteExcluded: myVote !== 0,
    prevClose: m.prev_close,
    tokenPrice: m.api_price ?? null,
    perVoteValue: perVoteValue(m.api_price),
    likes,
    dislikes,
    net: likes - dislikes,
    approval: total ? Math.round((likes / total) * 100) : null,
    myVote, // 1 = liked, -1 = disliked, 0 = none
    status: m.status || 'active',
    statusNote: m.status_note || null,
    releasedAt: m.released_at || null,
    effort: m.effort || null,
    baseVotes: m.base_votes || 0,
    liveSignals: !!(m.openrouter_id || m.hf_id),
    change: +change.toFixed(2),
    changePct: +changePct.toFixed(2),
    benchmarks: parseBenchmarks(m.benchmarks),
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
         m.price, m.prev_close, m.like_count, m.dislike_count, m.benchmarks,
         m.status, m.status_note, m.released_at, m.effort, m.base_votes,
         m.openrouter_id, m.hf_id,
         s.elo, s.usage, s.bench, s.downloads, s.api_price
    FROM models m
    LEFT JOIN model_signals s ON s.id = (
      SELECT id FROM model_signals
       WHERE model_id = m.id ORDER BY captured_at DESC, id DESC LIMIT 1
    )`

const listStmt = db.prepare(`${SELECT} ORDER BY m.price DESC`)

// Map of model_id -> the user's stance (+1 like, -1 dislike).
function stanceMapFor(userId) {
  const map = new Map()
  if (!userId) return map
  for (const r of db.prepare('SELECT model_id, value FROM votes WHERE user_id = ?').all(userId)) {
    map.set(r.model_id, r.value)
  }
  return map
}

router.get('/', optionalAuth, (req, res) => {
  const stance = stanceMapFor(req.user?.id)
  res.json({
    models: listStmt.all().map((m) => decorate(m, stance.get(m.id) || 0)),
    signals: signalsStatus(),
    voteRate: VOTE_RATE
  })
})

router.get('/:slug', optionalAuth, (req, res) => {
  const m = db.prepare(`${SELECT} WHERE m.slug = ?`).get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })

  const myVote = req.user
    ? db.prepare('SELECT value FROM votes WHERE user_id = ? AND model_id = ?').get(req.user.id, m.id)
        ?.value || 0
    : 0

  const candles = db
    .prepare(
      `SELECT t, open, high, low, close
         FROM price_candles WHERE model_id = ?
        ORDER BY t DESC LIMIT 240`
    )
    .all(m.id)
    .reverse()

  res.json({ model: decorate(m, myVote), candles, voteRate: VOTE_RATE })
})

// Recompute and persist a model's like/dislike tallies from the votes table.
function syncTallies(modelId) {
  const c = db
    .prepare(
      `SELECT COALESCE(SUM(value = 1), 0) AS likes, COALESCE(SUM(value = -1), 0) AS dislikes
         FROM votes WHERE model_id = ?`
    )
    .get(modelId)
  db.prepare(
    'UPDATE models SET like_count = ?, dislike_count = ?, vote_count = ? WHERE id = ?'
  ).run(c.likes, c.dislikes, c.likes, modelId)
  return c
}

// Cast a like (+1) or dislike (-1). Re-casting the same stance clears it (toggle);
// casting the opposite stance switches. One stance per user per model.
router.post('/:slug/vote', requireAuth, (req, res) => {
  const m = db.prepare('SELECT id, status FROM models WHERE slug = ?').get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })
  if (m.status && m.status !== 'active') {
    const why = m.status === 'suspended' ? 'access is suspended' : 'has not launched yet'
    return res.status(400).json({ error: `voting is disabled — this model ${why}` })
  }

  const want = Number(req.body?.value)
  if (want !== 1 && want !== -1) {
    return res.status(400).json({ error: 'value must be 1 (like) or -1 (dislike)' })
  }

  let myVote = 0
  db.transaction(() => {
    const existing = db
      .prepare('SELECT value FROM votes WHERE user_id = ? AND model_id = ?')
      .get(req.user.id, m.id)
    if (existing && existing.value === want) {
      db.prepare('DELETE FROM votes WHERE user_id = ? AND model_id = ?').run(req.user.id, m.id)
      myVote = 0
    } else if (existing) {
      db.prepare('UPDATE votes SET value = ?, created_at = ? WHERE user_id = ? AND model_id = ?').run(
        want,
        new Date().toISOString(),
        req.user.id,
        m.id
      )
      myVote = want
    } else {
      db.prepare(
        'INSERT INTO votes (user_id, model_id, value, created_at) VALUES (?, ?, ?, ?)'
      ).run(req.user.id, m.id, want, new Date().toISOString())
      myVote = want
    }
    syncTallies(m.id)
  })()

  const current = db
    .prepare(
      `SELECT m.like_count, m.dislike_count, m.base_votes, s.api_price
         FROM models m
         LEFT JOIN model_signals s ON s.id = (
           SELECT id FROM model_signals WHERE model_id = m.id
            ORDER BY captured_at DESC, id DESC LIMIT 1
         )
        WHERE m.id = ?`
    )
    .get(m.id)
  // Net sentiment is the public price: recompute this model and broadcast it live.
  const price = pushModelPrice(req.app.get('io'), m.id)
  const executionPrice = executionPriceFor({
    baseVotes: current.base_votes,
    likes: current.like_count,
    dislikes: current.dislike_count,
    myVote,
    tokenPrice: current.api_price
  })
  res.json({
    ok: true,
    myVote,
    likes: current.like_count,
    dislikes: current.dislike_count,
    price,
    executionPrice
  })
})

const COMMENT_MAX = 500

function commentRow(c, userId) {
  return {
    id: c.id,
    body: c.body,
    username: c.username,
    createdAt: c.created_at,
    mine: !!userId && c.user_id === userId
  }
}

// List a model's comments, newest first.
router.get('/:slug/comments', optionalAuth, (req, res) => {
  const m = db.prepare('SELECT id FROM models WHERE slug = ?').get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })
  const rows = db
    .prepare(
      `SELECT c.id, c.body, c.user_id, c.created_at, u.username
         FROM comments c JOIN users u ON u.id = c.user_id
        WHERE c.model_id = ? ORDER BY c.created_at DESC, c.id DESC LIMIT 200`
    )
    .all(m.id)
  res.json({ comments: rows.map((c) => commentRow(c, req.user?.id)) })
})

// Post a comment on a model.
router.post('/:slug/comments', requireAuth, (req, res) => {
  const m = db.prepare('SELECT id FROM models WHERE slug = ?').get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })
  const body = String(req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: 'comment cannot be empty' })
  if (body.length > COMMENT_MAX) {
    return res.status(400).json({ error: `comment too long (max ${COMMENT_MAX})` })
  }
  const info = db
    .prepare('INSERT INTO comments (model_id, user_id, body, created_at) VALUES (?, ?, ?, ?)')
    .run(m.id, req.user.id, body, new Date().toISOString())
  const c = db
    .prepare(
      `SELECT c.id, c.body, c.user_id, c.created_at, u.username
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid)
  res.status(201).json({ comment: commentRow(c, req.user.id) })
})

// Delete a comment (author or admin). Scope the resource to the model in the URL.
router.delete('/:slug/comments/:id', requireAuth, (req, res) => {
  const m = db.prepare('SELECT id FROM models WHERE slug = ?').get(req.params.slug)
  if (!m) return res.status(404).json({ error: 'model not found' })

  const c = db
    .prepare('SELECT * FROM comments WHERE id = ? AND model_id = ?')
    .get(req.params.id, m.id)
  if (!c) return res.status(404).json({ error: 'comment not found' })
  if (c.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'not your comment' })
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(c.id)
  res.json({ ok: true })
})

export default router
