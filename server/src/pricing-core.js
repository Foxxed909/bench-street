// Pure pricing math — no DB, no I/O — so it's trivially unit-testable and reusable.
//
//   price        = max(0, net) × perVoteValue
//   perVoteValue = VOTE_RATE × costFactor(blended $/Mtok)
//   costFactor   = clamp(0.5, 2.0, tokenPrice ÷ COST_REF)
//
// `net` is the model's (opening line + likes − dislikes). A vote on a pricey
// frontier model moves it more than a vote on a cheap one.
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

// Internet-sentiment multiplier: score in [-1, 1] tilts price by at most ±15%.
// The crowd's votes stay the wheel; the internet is the tide.
export const SENTIMENT_MAX_TILT = 0.15
export function sentimentBoost(score) {
  if (score == null || Number.isNaN(score)) return 1
  const s = Math.max(-1, Math.min(1, score))
  return 1 + s * SENTIMENT_MAX_TILT
}

// The price for a given net sentiment + token price. Net ≤ 0 → $0.
export function priceFor(net, tokenPrice, sentiment = 0) {
  return +(Math.max(0, net || 0) * perVoteValue(tokenPrice) * sentimentBoost(sentiment)).toFixed(2)
}
