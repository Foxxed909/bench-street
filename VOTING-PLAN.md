# Plan — Vote-Driven Pricing (next build)

Decided 2026-06-14. Not yet implemented. Replaces the "trades move price" half of the
engine with **votes move price**. Play-money trading stays for profit/portfolios; votes
are what move the price now.

## Decisions (locked)
- **Mechanic:** Price = real-signal **fundamental + (votes × rate)**. Keep buying/selling,
  portfolios, P&L, leaderboard. Votes replace the old trade-demand term as the price mover.
- **Voting style:** **One vote per user per model, toggleable** (star/follow on or off).
  Price reflects total unique supporters. Hard to game.
- **Rate:** **Flat $5 per vote.**
  - Example: Gemini 3 Pro fundamental $720 + 140 votes × $5 = **$1,420**.
  - Example: Phi-4 fundamental $95 + 20 votes × $5 = **$195**.

## Pricing math
- New price target per model: `target = fundamental + (voteCount × 5)`
- Keep the live tick loop: `price += THETA·(target − price) + volatility·noise`, so the
  chart still breathes and glides toward the vote-adjusted target.
- **Remove / retire the demand term** (`models.demand`, `addDemand`) as the price driver —
  votes take its place. (Can keep the column dormant or drop it; decide at build time.)
- Soft band around `target` (not raw fundamental) so votes can genuinely lift price.

## Server work
- **Schema:** `votes` table — `(user_id, model_id, created_at)`, UNIQUE(user_id, model_id).
  Add `models.vote_count` (denormalized, or COUNT on read).
- **Routes:**
  - `POST /api/models/:slug/vote` (requireAuth) → toggle the user's vote, return new count + whether voted.
  - Include `votes` and `votedByMe` in the models list/detail payloads.
- **pricing.js:** target uses `fundamental + votes×RATE` (RATE=5, config). Drop demand from target.
- Broadcast vote-count changes (or let the next price tick carry it).

## Client work
- **Model detail + Floor:** a vote button (filled when voted), live vote count.
  Replace the "Buy pressure / Flow" demand UI with a **vote / supporters** indicator.
- Show "+$X from N votes" in the "Why this price" breakdown on the detail page.
- Keep AnimatedNumber price behavior.

## Open questions for next session
- Do votes decay, or are they permanent accumulated support? (Leaning permanent, since it's
  a toggle = current supporter count.)
- Should the leaderboard surface "most-voted models" alongside the trader net-worth board?
- Keep `demand` column for a possible future hybrid, or remove entirely?

## Status
✅ DONE (2026-06-15). Implemented exactly as specified:
- `votes` table + `models.vote_count`; `POST /api/models/:slug/vote` toggles (one per user).
- pricing target = `fundamental + vote_count × VOTE_RATE` (VOTE_RATE=5); demand retired
  (column kept dormant). Band hugs the vote-adjusted target.
- Floor: vote button + "Most voted" sort; ModelDetail: Community-votes card + vote line in
  "Why this price"; MarketStats: "Most voted" highlight. `optionalAuth` powers `votedByMe`.
- Verified: votes changed the price and the toggle worked in the UI.

Resolved open questions: votes are permanent while present (toggle = current supporter count,
no decay). Leaderboard still trader-net-worth only. `demand` remains dormant.

Admin credentials must be configured and shared out-of-band. Never commit passwords, API keys,
tokens, or production secrets to this repository. Run `npm run dev` for server `:4000` and
client `:5173`.
