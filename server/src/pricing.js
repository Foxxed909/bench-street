import db from './db.js'

// --- Price model -----------------------------------------------------------
// A model's price is how much the community values it: it launches at $0 and
// moves only as people vote. Net sentiment (likes − dislikes) sets it, and each
// vote is worth a base amount scaled by the model's real token economics — so a
// vote on a pricey frontier model moves it more than a vote on a cheap one.
//
//   price        = max(0, likes − dislikes) × perVoteValue
//   perVoteValue = VOTE_RATE × costFactor(blended $/Mtok)
//   costFactor   = clamp(0.5, 2.0, tokenPrice ÷ COST_REF)
//
// No simulation, no random walk — price only changes when a real vote lands.
export const VOTE_RATE = 5 // base $ per vote
const COST_REF = 5 // $/Mtok reference where costFactor === 1.0
const COST_MIN = 0.5
const COST_MAX = 2.0

// How much each vote is worth on a model, scaled by its blended token price.
// A null/unknown price means no economic tilt → factor 1.0.
export function costFactor(tokenPrice) {
  if (tokenPrice == null || Number.isNaN(tokenPrice)) return 1
  return Math.max(COST_MIN, Math.min(COST_MAX, tokenPrice / COST_REF))
}

export function perVoteValue(tokenPrice) {
  return +(VOTE_RATE * costFactor(tokenPrice)).toFixed(2)
}

// The price for a given net sentiment + token price. Net ≤ 0 → $0.
export function priceFor(net, tokenPrice) {
  return +(Math.max(0, net || 0) * perVoteValue(tokenPrice)).toFixed(2)
}

// Latest token price + current like/dislike tallies for every model.
function priceInputs() {
  return db
    .prepare(
      `SELECT m.id, m.like_count, m.dislike_count, m.base_votes, s.api_price
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

function epochMinute() {
  return Math.floor(Date.now() / 60000) * 60
}

const upCandle = db.prepare(`
  INSERT INTO price_candles (model_id, t, open, high, low, close)
  VALUES (@model_id, @t, @price, @price, @price, @price)
  ON CONFLICT(model_id, t) DO UPDATE SET
    high  = MAX(high, @price),
    low   = MIN(low, @price),
    close = @price
`)

// Recompute every model's price from its votes + token price. Returns
// Map(modelId -> price). Writes a candle per model so charts have a point.
export function recomputePrices() {
  const rows = priceInputs()
  const update = db.prepare('UPDATE models SET price = ? WHERE id = ?')
  const result = new Map()
  const t = epochMinute()
  const apply = db.transaction(() => {
    for (const r of rows) {
      const net = (r.base_votes || 0) + (r.like_count || 0) - (r.dislike_count || 0)
      const price = priceFor(net, r.api_price)
      update.run(price, r.id)
      upCandle.run({ model_id: r.id, t, price })
      result.set(r.id, price)
    }
  })
  apply()
  return result
}

// Recompute a single model's price after its votes change, persist a candle,
// and broadcast it live. Called by the vote route. Returns the new price.
export function pushModelPrice(io, modelId) {
  const r = db
    .prepare(
      `SELECT m.id, m.like_count, m.dislike_count, m.base_votes, s.api_price
         FROM models m
         LEFT JOIN model_signals s ON s.id = (
           SELECT id FROM model_signals WHERE model_id = m.id
            ORDER BY captured_at DESC, id DESC LIMIT 1
         )
        WHERE m.id = ?`
    )
    .get(modelId)
  if (!r) return null

  const likes = r.like_count || 0
  const dislikes = r.dislike_count || 0
  const price = priceFor((r.base_votes || 0) + likes - dislikes, r.api_price)
  db.prepare('UPDATE models SET price = ? WHERE id = ?').run(price, r.id)
  upCandle.run({ model_id: r.id, t: epochMinute(), price })
  if (io) {
    io.emit('prices', {
      t: Date.now(),
      models: [{ id: r.id, price, likes, dislikes }]
    })
  }
  return price
}

let rollTimer = null

export function startPricing(io) {
  // Price = votes × per-vote value. On a fresh launch that's $0 across the board.
  recomputePrices()
  // Seed the 24h reference once, so day-one change reads 0% until prices move.
  db.prepare('UPDATE models SET prev_close = price WHERE prev_close = 0').run()

  // Roll the 24h reference once a day so the "24h" column stays meaningful.
  rollTimer = setInterval(
    () => db.prepare('UPDATE models SET prev_close = price').run(),
    24 * 60 * 60 * 1000
  )

  // Broadcast the opening board.
  const models = db
    .prepare('SELECT id, price, like_count AS likes, dislike_count AS dislikes FROM models')
    .all()
  if (io) io.emit('prices', { t: Date.now(), models })

  return () => clearInterval(rollTimer)
}

export function stopPricing() {
  if (rollTimer) clearInterval(rollTimer)
}
