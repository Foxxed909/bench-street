import db from './db.js'
import { recomputePrices } from './pricing.js'

// Internet sentiment: search Hacker News (Algolia, free/no-auth) and Reddit
// (public .json) for each model's name, score titles with a small lexicon, and
// store a -1..1 score on models.sentiment. Pricing tilts price by ±15% max.
// Deliberately slow-moving (hourly) and clamped — the tide, not the wheel.

const POS = ['amazing','great','impressive','best','love','incredible','beats','wins','sota','fast','excellent','breakthrough','crushed','insane','underrated','good','strong','top']
const NEG = ['bad','worse','worst','terrible','disappointing','overrated','slow','fails','broken','hate','awful','useless','benchmaxxed','regression','nerfed','lobotomized','scam','buggy']

export function scoreText(text) {
  const words = String(text).toLowerCase().split(/[^a-z]+/)
  let s = 0
  for (const w of words) {
    if (POS.includes(w)) s++
    else if (NEG.includes(w)) s--
  }
  return s === 0 ? 0 : s > 0 ? 1 : -1 // each title votes pos/neg/neutral
}

// Aggregate title votes → -1..1 (tanh-ish squash so a few hits don't peg it).
export function aggregate(votes) {
  if (!votes.length) return 0
  const net = votes.reduce((a, b) => a + b, 0)
  return +Math.tanh(net / Math.max(6, votes.length)).toFixed(3)
}

async function fetchJson(url, headers = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'bench-street/1.0', ...headers } })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function titlesFor(name) {
  const q = encodeURIComponent(`"${name}"`)
  const titles = []
  const hn = await fetchJson(
    `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=(story,comment)&hitsPerPage=30&numericFilters=created_at_i>${Math.floor(Date.now() / 1000) - 14 * 86400}`
  )
  for (const h of hn?.hits || []) titles.push(h.title || h.comment_text?.slice(0, 200) || '')
  const rd = await fetchJson(`https://www.reddit.com/search.json?q=${q}&sort=new&t=month&limit=25`)
  for (const c of rd?.data?.children || []) titles.push(c.data?.title || '')
  return titles.filter(Boolean)
}

// Refresh sentiment for all ACTIVE models (sequential + gentle: these are
// unauthenticated public endpoints). Returns count updated.
export async function refreshSentiment({ log = console.log, io = null } = {}) {
  const models = db
    .prepare("SELECT id, name FROM models WHERE status = 'active' AND effort IS NOT 'low' AND effort IS NOT 'high'")
    .all()
  const upd = db.prepare('UPDATE models SET sentiment = ? WHERE id = ?')
  const spread = db.prepare("UPDATE models SET sentiment = ? WHERE name LIKE ? || '%'")
  let n = 0
  for (const m of models) {
    const titles = await titlesFor(m.name)
    if (!titles.length) continue
    const score = aggregate(titles.map(scoreText))
    upd.run(score, m.id)
    // Effort variants (low/high) share the base model's public perception.
    spread.run(score, m.name)
    n++
    await new Promise((r) => setTimeout(r, 1500)) // be polite to free endpoints
  }
  recomputePrices()
  if (io) {
    const rows = db
      .prepare('SELECT id, price, like_count AS likes, dislike_count AS dislikes FROM models')
      .all()
    io.emit('prices', { t: Date.now(), models: rows })
  }
  log(`[sentiment] refreshed ${n}/${models.length} models from HN+Reddit`)
  return n
}

export function startSentimentCron({ intervalMin = 60, log = console.log, io = null } = {}) {
  setTimeout(() => refreshSentiment({ log, io }).catch((e) => log('[sentiment] error: ' + e.message)), 20_000)
  const timer = setInterval(
    () => refreshSentiment({ log, io }).catch((e) => log('[sentiment] error: ' + e.message)),
    intervalMin * 60 * 1000
  )
  return () => clearInterval(timer)
}
