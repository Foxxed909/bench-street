// Match the server's self-dealing guard: public prices show every vote, while the
// signed-in user's own stance is removed from that user's executable/portfolio quote.
export function executionPriceFor({
  baseVotes = 0,
  likes = 0,
  dislikes = 0,
  myVote = 0,
  perVoteValue = 0
}) {
  const stance = myVote === 1 || myVote === -1 ? myVote : 0
  const net = Number(baseVotes || 0) + Number(likes || 0) - Number(dislikes || 0) - stance
  const unit = Number(perVoteValue || 0)
  if (!Number.isFinite(net) || !Number.isFinite(unit) || unit < 0) return 0
  return Math.round(Math.max(0, net) * unit * 100) / 100
}
