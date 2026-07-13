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

// The price for a given net sentiment + token price. Net ≤ 0 → $0.
export function priceFor(net, tokenPrice) {
  return +(Math.max(0, net || 0) * perVoteValue(tokenPrice)).toFixed(2)
}

// A user's own stance is excluded from the quote used to execute and value that
// user's holdings. The public board still reflects every vote, but one account cannot
// buy, move the quote with its own vote, and sell at the price it manufactured.
//
// This closes the single-account self-dealing loop. It does not pretend to solve
// coordinated/Sybil identities, which needs verification and reputation controls.
export function executionPriceFor({ baseVotes = 0, likes = 0, dislikes = 0, myVote = 0, tokenPrice }) {
  const stance = myVote === 1 || myVote === -1 ? myVote : 0
  const selfNeutralNet = Number(baseVotes || 0) + Number(likes || 0) - Number(dislikes || 0) - stance
  return priceFor(selfNeutralNet, tokenPrice)
}
