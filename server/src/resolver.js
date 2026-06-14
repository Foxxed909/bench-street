import db from './db.js'
import { resolveMarket } from './resolve.js'

// Auto-resolution engine. Markets with resolution='auto' carry a JSON `resolver`
// spec that is evaluated against LIVE signals. Supported specs:
//   { kind:'elo_threshold', value:1400 }
//        → resolves YES as soon as any model's live ELO ≥ value; at close, NO.
//   { kind:'elo_lead', a:'<slug>', b:'<slug>' }
//        → at close, resolves to whichever model has the higher live ELO.
//   { kind:'open_top' }
//        → at close, YES if the highest-ELO model in our index is open-weights.
//
// Threshold markets can settle EARLY (the moment the condition is true). Lead /
// open_top markets settle at close (when the deadline passes). Anything it can't
// decide is left for an admin.

function liveElo() {
  // latest ELO per model
  return db
    .prepare(
      `SELECT m.id, m.slug, m.open_source, m.name,
              (SELECT elo FROM model_signals WHERE model_id=m.id ORDER BY captured_at DESC, id DESC LIMIT 1) AS elo
         FROM models m`
    )
    .all()
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
  const models = liveElo()
  const haveElo = models.some((m) => m.elo != null)
  if (!haveElo) return null

  if (spec.kind === 'elo_threshold') {
    const max = Math.max(...models.map((m) => m.elo || 0))
    if (max >= spec.value) {
      const yes = outcomeByLabel(market.id, 'Yes')
      return yes ? { outcomeId: yes.id, note: `max ELO ${max.toFixed(0)} ≥ ${spec.value}` } : null
    }
    if (closed) {
      const no = outcomeByLabel(market.id, 'No')
      return no ? { outcomeId: no.id, note: `max ELO never reached ${spec.value}` } : null
    }
    return null
  }

  if (spec.kind === 'elo_lead') {
    if (!closed) return null
    const a = models.find((m) => m.slug === spec.a)
    const b = models.find((m) => m.slug === spec.b)
    if (!a?.elo || !b?.elo) return null
    const winnerName = a.elo >= b.elo ? a.name : b.name
    const o = outcomeByLabel(market.id, winnerName)
    return o ? { outcomeId: o.id, note: `${winnerName} led on ELO` } : null
  }

  if (spec.kind === 'open_top') {
    if (!closed) return null
    const ranked = models.filter((m) => m.elo != null).sort((x, y) => y.elo - x.elo)
    if (!ranked.length) return null
    const topOpen = ranked[0].open_source
    const label = topOpen ? 'Yes' : 'No'
    const o = outcomeByLabel(market.id, label)
    return o ? { outcomeId: o.id, note: `top model ${ranked[0].name} ${topOpen ? 'is' : 'is not'} open` } : null
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
