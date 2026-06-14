import db from './db.js'

// --- Index configuration ---------------------------------------------------
// A model's "fundamental value" is a weighted blend of normalized real signals,
// mapped onto a price band. These weights are the game's physics — tune freely.
export const WEIGHTS = { elo: 0.40, usage: 0.30, bench: 0.20, dlprice: 0.10 }
export const PRICE_FLOOR = 10
export const PRICE_CEIL = 1000

const TICK_MS = 4000      // price tick cadence
const THETA = 0.10        // mean-reversion strength per tick (pull toward target)

// --- Votes drive price -----------------------------------------------------
// Each community vote adds a flat amount to a model's target price, on top of its
// signal-derived fundamental. Price target = fundamental + (votes × VOTE_RATE).
export const VOTE_RATE = 5

// Min-max normalize a list of {id, v} to 0..1. Nulls map to the series minimum.
function normalize(rows, pick, { invert = false } = {}) {
  const vals = rows.map(pick).filter((v) => v != null && !Number.isNaN(v))
  if (vals.length === 0) return new Map(rows.map((r) => [r.id, 0.5]))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const out = new Map()
  for (const r of rows) {
    const raw = pick(r)
    let n = raw == null || Number.isNaN(raw) ? 0 : (raw - min) / span
    if (invert) n = 1 - n
    out.set(r.id, n)
  }
  return out
}

// Pull the latest signal snapshot for every model.
function latestSignals() {
  return db
    .prepare(
      `SELECT m.id, m.open_source, s.elo, s.usage, s.bench, s.downloads, s.api_price
         FROM models m
         LEFT JOIN model_signals s ON s.id = (
           SELECT id FROM model_signals
            WHERE model_id = m.id
            ORDER BY captured_at DESC, id DESC
            LIMIT 1
         )`
    )
    .all()
}

// Recompute every model's fundamental value from its latest signals.
// Returns a Map(modelId -> fundamental).
export function recomputeFundamentals() {
  const rows = latestSignals()
  if (rows.length === 0) return new Map()

  const eloN = normalize(rows, (r) => r.elo)
  const usageN = normalize(rows, (r) => r.usage)
  const benchN = normalize(rows, (r) => r.bench)
  // Downloads on a log scale (huge range); only meaningful for open models.
  const dlN = normalize(
    rows,
    (r) => (r.downloads ? Math.log10(r.downloads + 1) : null)
  )
  // Cheaper API price is "better", so invert.
  const priceN = normalize(rows, (r) => r.api_price, { invert: true })

  const update = db.prepare('UPDATE models SET fundamental = ? WHERE id = ?')
  const result = new Map()

  const apply = db.transaction(() => {
    for (const r of rows) {
      // The dl/price leg blends accessibility: open models weight downloads,
      // closed models lean entirely on price.
      const dlprice = r.open_source
        ? 0.6 * dlN.get(r.id) + 0.4 * priceN.get(r.id)
        : priceN.get(r.id)

      const score =
        WEIGHTS.elo * eloN.get(r.id) +
        WEIGHTS.usage * usageN.get(r.id) +
        WEIGHTS.bench * benchN.get(r.id) +
        WEIGHTS.dlprice * dlprice

      const fundamental = +(PRICE_FLOOR + score * (PRICE_CEIL - PRICE_FLOOR)).toFixed(2)
      update.run(fundamental, r.id)
      result.set(r.id, fundamental)
    }
  })
  apply()
  return result
}

// Box-Muller standard normal.
function gaussian() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function epochMinute() {
  return Math.floor(Date.now() / 60000) * 60
}

// One simulated tick: drift toward (fundamental + votes×rate) + a volatility shock.
function tickOnce(io) {
  const models = db
    .prepare('SELECT id, price, fundamental, volatility, vote_count FROM models')
    .all()

  const upModel = db.prepare('UPDATE models SET price = ? WHERE id = ?')
  const upCandle = db.prepare(`
    INSERT INTO price_candles (model_id, t, open, high, low, close)
    VALUES (@model_id, @t, @price, @price, @price, @price)
    ON CONFLICT(model_id, t) DO UPDATE SET
      high  = MAX(high, @price),
      low   = MIN(low, @price),
      close = @price
  `)

  const t = epochMinute()
  const payload = []

  const run = db.transaction(() => {
    for (const m of models) {
      const fundamental = m.fundamental || m.price || PRICE_FLOOR
      const votes = m.vote_count || 0
      // Votes lift the target a flat amount above the signal-derived fair value.
      const target = fundamental + votes * VOTE_RATE
      const price = m.price || target
      const drift = THETA * (target - price)
      const shock = m.volatility * price * gaussian()
      // Soft band hugs the (vote-adjusted) target so the chart breathes but tracks it.
      const lo = target * 0.8
      const hi = target * 1.2
      let next = price + drift + shock
      next = Math.min(hi, Math.max(lo, next))
      next = +Math.max(1, next).toFixed(2)

      upModel.run(next, m.id)
      upCandle.run({ model_id: m.id, t, price: next })
      payload.push({ id: m.id, price: next, votes })
    }
  })
  run()

  if (io) io.emit('prices', { t: Date.now(), models: payload })
}

let timer = null

export function startPricing(io) {
  recomputeFundamentals()
  // Seed prices at fundamental on first boot, and set the day's reference close.
  db.prepare(
    'UPDATE models SET price = fundamental WHERE price IS NULL OR price = 0'
  ).run()
  db.prepare('UPDATE models SET prev_close = price').run()

  tickOnce(io)
  timer = setInterval(() => tickOnce(io), TICK_MS)
  return () => clearInterval(timer)
}

export function stopPricing() {
  if (timer) clearInterval(timer)
}
