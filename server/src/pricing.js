import db from './db.js'
import {
  VOTE_RATE,
  costFactor,
  executionPriceFor,
  perVoteValue,
  priceFor
} from './pricing-core.js'

// --- Price model -----------------------------------------------------------
// The pure math (priceFor/perVoteValue/costFactor/executionPriceFor) lives in
// pricing-core.js so it can be unit-tested without a DB. This module wires it to
// storage + sockets: recompute prices from votes, persist candles, and broadcast
// changes live. No simulation, no random walk — price only changes when a real vote lands.
export { VOTE_RATE, costFactor, executionPriceFor, perVoteValue, priceFor }

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

let rollTimeout = null
let rollInterval = null
let candleTimer = null

function msUntilNextUtcMidnight() {
  const now = new Date()
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  return next - now.getTime()
}

function rollPrevClose() {
  db.prepare('UPDATE models SET prev_close = price').run()
}

// Write a candle per model carrying the current close forward, so charts have a
// point every minute even when nobody votes (prices persist between votes).
const writeCandles = db.transaction((t) => {
  for (const r of db.prepare('SELECT id, price FROM models').all()) {
    upCandle.run({ model_id: r.id, t, price: r.price })
  }
})

export function startPricing(io) {
  // Price = (opening line + net votes) × per-vote value. Recompute from the votes.
  recomputePrices()
  // Seed the 24h reference once, so day-one change reads 0% until prices move.
  db.prepare('UPDATE models SET prev_close = price WHERE prev_close = 0').run()

  // Roll the 24h reference at UTC midnight (not at an arbitrary boot-anchored time),
  // then every 24h after, so the "24h" column means a real calendar day.
  rollTimeout = setTimeout(() => {
    rollPrevClose()
    rollInterval = setInterval(rollPrevClose, 24 * 60 * 60 * 1000)
  }, msUntilNextUtcMidnight())

  // Keep candles flowing once a minute so the charts fill in over time.
  candleTimer = setInterval(() => writeCandles(epochMinute()), 60_000)

  // Broadcast the opening board.
  const models = db
    .prepare('SELECT id, price, like_count AS likes, dislike_count AS dislikes FROM models')
    .all()
  if (io) io.emit('prices', { t: Date.now(), models })

  return stopPricing
}

export function stopPricing() {
  if (rollTimeout) clearTimeout(rollTimeout)
  if (rollInterval) clearInterval(rollInterval)
  if (candleTimer) clearInterval(candleTimer)
  rollTimeout = rollInterval = candleTimer = null
}
