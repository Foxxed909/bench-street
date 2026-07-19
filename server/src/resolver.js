import db from './db.js'
import { resolveMarket } from './resolve.js'
import { hasLiveArenaSignal } from './ingest.js'

// Auto-resolution engine. Markets with resolution='auto' carry a JSON `resolver`
// spec that is evaluated against LIVE signals. Supported specs:
//   { kind:'elo_threshold', value:1400 }
//        → resolves YES as soon as any model's live ELO ≥ value; at close, NO.
//   { kind:'elo_lead', a:'<slug>', b:'<slug>' }
//        → at close, resolves to whichever model has the higher live ELO.
//   { kind:'open_top' }
//        → at close, YES if the highest-ELO model in our index is open-weights.
//   { kind:'bench_top', key:'BridgeBench', candidates:[slugs] }
//        → at close, resolves to the candidate with the highest benchmark `key`.
//   { kind:'price_top', candidates:[slugs] }
//        → at close, resolves to the candidate with the highest share price.
//
// Threshold markets can settle EARLY (the moment the condition is true). Lead /
// open_top markets settle at close (when the deadline passes). Anything it can't
// decide — including ties or stale/non-live Elo — is left for an admin.

function liveElo() {
  // Latest ELO per active model, but only when ingest matched that slug in the most
  // recent live Arena scrape. Curated seed values are useful display fallbacks; they
  // are not evidence strong enough to settle a market.
  return db
    .prepare(
      `SELECT m.id, m.slug, m.open_source, m.name,
              (SELECT elo FROM model_signals WHERE model_id=m.id ORDER BY captured_at DESC, id DESC LIMIT 1) AS elo
         FROM models m
        WHERE COALESCE(m.status, 'active') = 'active'`
    )
    .all()
    .filter((m) => hasLiveArenaSignal(m.slug))
}

function outcomeByLabel(marketId, label) {
  return db
    .prepare('SELECT id FROM market_outcomes WHERE market_id = ? AND label = ?')
    .get(marketId, label)
}

// Decide a single market. Returns { outcomeId } if it can be settled now, else null.
function decide(market) {
  let spec
  try {
    spec = JSON.parse(market.resolver)
  } catch {
    return null
  }
  const closed = market.closes_at && new Date(market.closes_at) <= new Date()

  // Data-driven bets that settle at close on Bench Street's own model data —
  // no ELO needed, so they're handled before the live-ELO guard below.
  if (spec.kind === 'bench_top') {
    if (!closed || !spec.candidates?.length) return null
    const ph = spec.candidates.map(() => '?').join(',')
    const rows = db
      .prepare(`SELECT name, benchmarks FROM models WHERE slug IN (${ph})`)
      .all(...spec.candidates)
    let bestScore = -Infinity
    let leaders = []
    for (const r of rows) {
      let score = null
      try {
        score = JSON.parse(r.benchmarks)?.[spec.key]
      } catch {
        score = null
      }
      if (!Number.isFinite(Number(score))) continue
      score = Number(score)
      if (score > bestScore) {
        bestScore = score
        leaders = [r]
      } else if (score === bestScore) {
        leaders.push(r)
      }
    }
    if (leaders.length !== 1) return null
    const best = leaders[0]
    const o = outcomeByLabel(market.id, best.name)
    return o ? { outcomeId: o.id, note: `${best.name} led ${spec.key} (${bestScore})` } : null
  }

  if (spec.kind === 'price_top') {
    if (!closed || !spec.candidates?.length) return null
    const ph = spec.candidates.map(() => '?').join(',')
    const rows = db
      .prepare(`SELECT name, price FROM models WHERE slug IN (${ph})`)
      .all(...spec.candidates)
      .filter((r) => Number.isFinite(Number(r.price)) && Number(r.price) > 0)
    if (!rows.length) return null
    const bestPrice = Math.max(...rows.map((r) => Number(r.price)))
    const leaders = rows.filter((r) => Number(r.price) === bestPrice)
    if (leaders.length !== 1) return null
    const best = leaders[0]
    const o = outcomeByLabel(market.id, best.name)
    return o ? { outcomeId: o.id, note: `${best.name} most valued ($${bestPrice.toFixed(0)})` } : null
  }

  const models = liveElo()
  const haveElo = models.some((m) => m.elo != null)
  if (!haveElo) return null

  if (spec.kind === 'elo_threshold') {
    const max = Math.max(...models.filter((m) => m.elo != null).map((m) => Number(m.elo)))
    if (max >= spec.value) {
      const yes = outcomeByLabel(market.id, 'Yes')
      return yes ? { outcomeId: yes.id, note: `max live ELO ${max.toFixed(0)} ≥ ${spec.value}` } : null
    }
    if (closed) {
      const no = outcomeByLabel(market.id, 'No')
      return no ? { outcomeId: no.id, note: `live ELO never reached ${spec.value}` } : null
    }
    return null
  }

  if (spec.kind === 'elo_lead') {
    if (!closed) return null
    const a = models.find((m) => m.slug === spec.a)
    const b = models.find((m) => m.slug === spec.b)
    if (a?.elo == null || b?.elo == null) return null
    if (Number(a.elo) === Number(b.elo)) return null
    const winnerName = Number(a.elo) > Number(b.elo) ? a.name : b.name
    const o = outcomeByLabel(market.id, winnerName)
    return o ? { outcomeId: o.id, note: `${winnerName} led on live ELO` } : null
  }

  if (spec.kind === 'open_top') {
    if (!closed) return null
    const ranked = models.filter((m) => m.elo != null).sort((x, y) => Number(y.elo) - Number(x.elo))
    if (!ranked.length) return null
    const topElo = Number(ranked[0].elo)
    const leaders = ranked.filter((m) => Number(m.elo) === topElo)
    const openness = new Set(leaders.map((m) => !!m.open_source))
    if (openness.size !== 1) return null
    const topOpen = openness.values().next().value
    const label = topOpen ? 'Yes' : 'No'
    const o = outcomeByLabel(market.id, label)
    const names = leaders.map((m) => m.name).join(', ')
    return o
      ? { outcomeId: o.id, note: `top live model${leaders.length > 1 ? 's' : ''} ${names} ${topOpen ? 'is/are' : 'is/are not'} open` }
      : null
  }

  return null
}

export function runAutoResolver({ io = null, log = console.log } = {}) {
  const markets = db
    .prepare("SELECT * FROM markets WHERE resolution = 'auto' AND status != 'resolved' AND resolver IS NOT NULL")
    .all()
  for (const market of markets) {
    const verdict = decide(market)
    if (!verdict) continue
    const res = resolveMarket(market.id, verdict.outcomeId)
    if (res.ok) {
      log(`[auto-resolve] ${market.slug} → ${res.winner} (${verdict.note}) · paid ${res.paidOut}`)
      if (io) io.emit('market:resolved', { slug: market.slug, winner: res.winner })
    }
  }
}

export function startAutoResolver({ io = null, log = console.log } = {}) {
  const timer = setInterval(() => {
    try {
      runAutoResolver({ io, log })
    } catch (e) {
      log('[auto-resolve] error: ' + e.message)
    }
  }, 30000)
  return () => clearInterval(timer)
}
