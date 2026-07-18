import db from './db.js'
import { recomputePrices } from './pricing.js'

// Pull live signals from real sources and write a fresh model_signals snapshot:
//   - LMArena    → live ELO (rating) + usage (share of arena votes)
//   - OpenRouter → blended API $/Mtok
//   - HuggingFace→ downloads (open models)
// Benchmarks are carried forward (no free real-time source). Any fetch failure
// degrades gracefully to the prior value.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models'
const HF_URL = (id) => `https://huggingface.co/api/models/${id}`
const LMARENA_URL = 'https://lmarena.ai/leaderboard'

// Roster slug → LMArena matcher. Value is one token or an array of tokens that
// must ALL appear in the normalized display name. Among matches we take the entry
// with the most votes (the most-established variant). Unmatched models keep their
// curated ELO/usage.
const ARENA = {
  'gpt-5-2': 'gpt5.2',
  'gpt-5-mini': ['gpt5', 'mini'],
  'claude-opus-4-8': 'claudeopus4.8',
  'claude-sonnet-4-6': 'claudesonnet4.6',
  'claude-haiku-4-5': 'claudehaiku4.5',
  'gemini-3-pro': 'gemini3pro',
  'gemini-3-flash': 'gemini3flash',
  'gemma-3-27b': ['gemma', '27'],
  'grok-4': 'grok4.1',
  'grok-4-mini': ['grok4', 'mini'],
  'llama-4-maverick': 'maverick',
  'llama-4-scout': 'scout',
  'mistral-large-3': ['mistral', 'large'],
  'mixtral-8x22': 'mixtral',
  'deepseek-v4': 'deepseekv4',
  'deepseek-r2': 'deepseek-r1', // R2 is ahead of this timeline's board; track latest R-series
  'qwen3-max': ['qwen', 'max'],
  'qwen3-235b': ['qwen', '235'],
  'nova-pro': 'nova', // matches Amazon's live Nova arena entry
  'command-a': 'command-a',
  'phi-4': 'phi4'
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

let lastRun = null
export function signalsStatus() {
  const row = db.prepare('SELECT MAX(captured_at) AS at FROM model_signals').get()
  return { updatedAt: row?.at || null, lastRun }
}

async function fetchText(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
async function fetchJson(url) {
  const t = await fetchText(url)
  if (t == null) return null
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

// Parse the LMArena "overall" leaderboard out of the embedded RSC payload.
// The page embeds several category boards (overall, coding, vision, …); we slice
// to the FIRST overall block so a model isn't confused with a weaker sub-board
// entry. Returns Map(normalizedName -> { rating, votes, name }).
export function parseArena(html) {
  let text = html.replaceAll('\\"', '"')

  // Isolate the overall category block: from its marker to the next category block.
  const start = text.indexOf('"category":"overall"')
  if (start >= 0) {
    let slice = text.slice(start)
    const next = slice.indexOf('"params":{"category":"', 30)
    if (next > 0) slice = slice.slice(0, next)
    text = slice
  }

  const re =
    /"modelDisplayName":"([^"]+)","rating":([\d.]+),"ratingUpper":[\d.]+,"ratingLower":[\d.]+,"votes":(\d+)/g
  const out = new Map()
  let m
  while ((m = re.exec(text))) {
    const name = m[1]
    const key = norm(name)
    const rating = +m[2]
    const votes = +m[3]
    const prev = out.get(key)
    // Within the overall board each model appears once; if not, keep higher rating.
    if (!prev || rating > prev.rating) out.set(key, { rating, votes, name })
  }
  return out
}

function matchArena(entries, matcher) {
  const tokens = Array.isArray(matcher) ? matcher.map(norm) : [norm(matcher)]
  let best = null
  for (const e of entries.values()) {
    if (tokens.every((t) => e.key.includes(t))) {
      if (!best || e.votes > best.votes) best = e
    }
  }
  return best
}

function blendedPrice(pricing) {
  if (!pricing) return null
  const p = parseFloat(pricing.prompt) || 0
  const c = parseFloat(pricing.completion) || 0
  const blended = (0.75 * p + 0.25 * c) * 1e6
  return blended > 0 ? +blended.toFixed(2) : null
}

export async function ingestSignals({ log = console.log, io = null } = {}) {
  const models = db.prepare('SELECT id, slug, openrouter_id, hf_id FROM models').all()

  // --- LMArena (ELO + votes) ---
  const arenaHtml = await fetchText(LMARENA_URL)
  const arena = arenaHtml ? parseArena(arenaHtml) : new Map()
  // attach normalized key for matching
  for (const [key, v] of arena) v.key = key
  if (!arenaHtml) log('[ingest] LMArena unreachable — keeping prior ELO/usage')

  // --- OpenRouter (price) ---
  const orData = await fetchJson(OPENROUTER_URL)
  const orMap = {}
  if (orData?.data) for (const m of orData.data) orMap[m.id] = m
  if (!orData) log('[ingest] OpenRouter unreachable — keeping prior prices')

  // --- HuggingFace (downloads) — fetched in one parallel batch, not per-model ---
  const hfModels = models.filter((m) => m.hf_id)
  const hfResults = await Promise.all(hfModels.map((m) => fetchJson(HF_URL(m.hf_id))))
  const hfMap = new Map()
  hfModels.forEach((m, i) => {
    const hf = hfResults[i]
    if (hf && typeof hf.downloads === 'number') hfMap.set(m.id, hf.downloads)
  })

  const lastStmt = db.prepare(
    'SELECT * FROM model_signals WHERE model_id = ? ORDER BY captured_at DESC, id DESC LIMIT 1'
  )
  const now = new Date().toISOString()
  const staged = []
  let elos = 0
  let priced = 0
  let downloaded = 0

  for (const m of models) {
    const last = lastStmt.get(m.id) || {}
    let elo = last.elo
    let votes = null
    let apiPrice = last.api_price
    let downloads = last.downloads

    // ELO + votes from LMArena
    const a = ARENA[m.slug] ? matchArena(arena, ARENA[m.slug]) : null
    if (a) {
      elo = +a.rating.toFixed(2)
      votes = a.votes
      elos++
    }

    // Price from OpenRouter
    const or = m.openrouter_id ? orMap[m.openrouter_id] : null
    const livePrice = or ? blendedPrice(or.pricing) : null
    if (livePrice != null) {
      apiPrice = livePrice
      priced++
    }

    // Downloads from HuggingFace (open models) — from the batched fetch above
    if (hfMap.has(m.id)) {
      downloads = hfMap.get(m.id)
      downloaded++
    }

    staged.push({ id: m.id, elo, votes, usage: last.usage, bench: last.bench, downloads, apiPrice })
  }

  // Usage = share of arena votes among models we matched (kept as a %). Models
  // without a live vote count keep their curated usage figure.
  const totalVotes = staged.reduce((s, r) => s + (r.votes || 0), 0)
  if (totalVotes > 0) {
    for (const r of staged) {
      if (r.votes != null) r.usage = +((r.votes / totalVotes) * 100).toFixed(2)
    }
  }

  const insSignal = db.prepare(`
    INSERT INTO model_signals (model_id, elo, usage, bench, downloads, api_price, captured_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const r of staged) {
      insSignal.run(r.id, r.elo, r.usage, r.bench, r.downloads, r.apiPrice, now)
    }
  })()

  // Token prices feed each vote's value, so refresh prices and broadcast them.
  const prices = recomputePrices()
  if (io && prices.size) {
    const models = db
      .prepare('SELECT id, price, like_count AS likes, dislike_count AS dislikes FROM models')
      .all()
    io.emit('prices', { t: Date.now(), models })
  }
  lastRun = {
    at: now,
    elos,
    priced,
    downloaded,
    source: arenaHtml ? 'live' : orData ? 'partial' : 'cached'
  }
  log(`[ingest] ${elos} live ELO · ${priced} live prices · ${downloaded} live downloads (${lastRun.source})`)
  return lastRun
}

export function startSignalCron({ intervalMin = 10, log = console.log, io = null } = {}) {
  setTimeout(() => ingestSignals({ log, io }).catch((e) => log('[ingest] error: ' + e.message)), 4000)
  const timer = setInterval(
    () => ingestSignals({ log, io }).catch((e) => log('[ingest] error: ' + e.message)),
    intervalMin * 60 * 1000
  )
  return () => clearInterval(timer)
}
