# Bench Street — Internal Notes

## Comments (v0.8.0)
- `comments` table (id, model_id→models, user_id→users, body, created_at) + `idx_comments_model`.
  Created via `CREATE TABLE IF NOT EXISTS` in db.js (no reseed needed on existing DBs).
- Routes in `routes/models.js`: `GET /:slug/comments` (optionalAuth → adds `mine`), `POST /:slug/comments`
  (requireAuth, trims, 1–500 chars), `DELETE /:slug/comments/:id` (author or admin). Newest first, LIMIT 200.
- Client: `components/Comments.jsx` (textarea + char counter, optimistic add/remove, avatar + `ago()`),
  mounted in ModelDetail's left column under "Why this price". `api.del()` added to lib/api.js.

## Pricing (current — v0.7.0, live from zero / votes set price)
- **`price = vote_count × perVoteValue`**, `perVoteValue = VOTE_RATE($5) × costFactor`,
  `costFactor = clamp(0.5, 2.0, api_price ÷ 5)`. Zero votes → **$0** for every model. See
  `priceFor()` / `perVoteValue()` / `costFactor()` in `pricing.js`. `api_price` is the live
  blended OpenRouter $/Mtok (0.75·prompt + 0.25·completion).
- **No simulation.** Removed the random-walk tick (gaussian/THETA/volatility), the cost×quality
  fundamental (`recomputeFundamentals`, `eloFactor`, `PRICE_MULTIPLIER`, `PRICE_FLOOR/CEIL`), and
  the old signal index. Price changes ONLY when votes change or token prices refresh.
- **Event-driven price:** `pushModelPrice(io, modelId)` recomputes one model after a vote, writes
  a candle, and `io.emit('prices', {models:[{id,price,votes}]})`. Wired via `app.set('io', io)`
  in `index.js`; the vote route calls `req.app.get('io')`. `ingest.js` also calls
  `recomputePrices()` + broadcasts on each 10-min signal refresh (token price feeds per-vote value).
- **24h:** `prev_close` seeded = price at boot (0 on fresh), rolled daily by a 24h `setInterval`.
  changePct is /0-guarded, so day-one reads 0% until prices have a prior baseline. Honest, not faked.
- **Trading:** blocked when `price <= 0` (trade route + disabled Buy/Sell in `ModelDetail`) so you
  can't buy free shares before the crowd sets a price.
- `decorate()` exposes `tokenPrice` + `perVoteValue`; detail returns `voteRate`. ModelDetail
  "Why this price" = *votes × per-vote value* chips; chart guards empty data (shows a placeholder).
- usage/bench/downloads/ELO are context-only signals now (still ingested + shown). `models.fundamental`
  + `models.demand` columns are dormant.

## Architecture decisions (historical — superseded by the section above)
- **Index mode, not order book.** Player trades don't set price directly; they feed a
  *demand* term that bends the price target. Keeps the market un-manipulable by a single
  whale while still letting flow move prices. (User asked for "voting moves worth" → this.)
- **Pricing = fundamental + demand + noise.** `target = fundamental·(1+demand)`; each tick
  `price += THETA·(target−price) + volatility·price·gaussian()`, clamped to
  `[0.4·fund, 1.85·fund]`. THETA=0.08, tick=4s. See `pricing.js`.
- **Demand:** per-trade impulse `min(0.12, notional/(fund·220))`, signed by side, decays
  `×0.985`/tick (~45s half-life), clamped `±0.6`. Persisted in `models.demand`.
- **Fundamentals** recomputed by min-max normalizing each signal across the universe, then
  weighting `ELO .40 · usage .30 · bench .20 · (downloads/price) .10`. Closed models put the
  whole last leg on (inverted) price; open models blend downloads 0.6 / price 0.4.
- **Candles** upserted every tick keyed by epoch-minute (OHLC). Cheap at ~22 models.
- **SQLite (better-sqlite3)** synchronous, single process. Prebuilt binaries worked on
  Node 24 — no native compile needed.

## v0.2.0 additions (live data, markets, arena)
- **Signal ingestion** (`ingest.js`): maps each model to a real OpenRouter id (live blended
  $/Mtok = 0.75·prompt + 0.25·completion, ×1e6) and open models to a HuggingFace repo (live
  downloads). ELO/usage/benchmarks carried forward (no free real-time source). Runs 4s after
  boot + every 10min + admin `POST /api/admin/refresh-signals`. Any fetch failure degrades to
  the prior snapshot (12s timeout, AbortController). Verified live: 22 prices + 8 downloads.
- **Admin model**: first-registered user (or names in ADMIN_USERNAMES) becomes admin; a db
  migration also promotes the earliest user if none is admin. `requireAdmin` guards resolve
  + refresh routes. NOTE: in this dev DB the admin is **sylvie** (id 1, pw secret123), not
  trader_demo — sylvie predates trader_demo.
- **Resolution/payout** (`routes/markets.js`): `effectiveStatus` derives open/closed/resolved
  from closes_at; `POST /:slug/resolve` (admin) pays winners pro-rata `stake/winPool·total`,
  marks positions settled, credits cash. Verified exact: $2000 on a 6200/12000 pool → $3870.97.
- **Arena** (`battles.js` + `routes/battles.js`): parimutuel two-sided battles, Elo win-prob
  settlement (`1/(1+10^((eloB-eloA)/400))`), auto-settler every 15s past closes_at, and
  `ensureOpenBattles()` keeps 4 competitive (±80 Elo) matchups alive so the Arena never empties.
  Battles seeded with short close timers — they WILL auto-settle within minutes of boot, then
  refill (this is expected, not a bug).
- **Polymarket-style markets**: 11 seeded markets with `rules` (resolution criteria) text,
  binary Yes/No detection for the big-% UI, idempotent seed-by-slug. Legacy markets
  (gpt-6-by-2027, top-elo-2026-q3) linger only in pre-existing dev DBs and are skipped from
  deletion if they have bets.
- **UI/motion**: `AnimatedNumber` (rAF easing + flash), `FlowBar` gradient transitions,
  glass `.card`, `.lift` hover, `fade-up` staggered entrances, terminal grid bg, live-dot pulse.
- **Gotcha fixed**: better-sqlite3 upsert `lastInsertRowid` is unreliable on conflict — resolve
  ids by slug after upsert, never trust it.

## v0.3.0 additions (live ELO/usage + auto-resolution)
- **LMArena scrape** (`ingest.js` `parseArena`): the leaderboard page embeds the board as
  escaped JSON in the Next.js RSC stream. We unescape (`\"`→`"`), SLICE to the first
  `"category":"overall"` block (the page has multiple category boards — coding/vision/agent —
  and matching across all of them grabbed weak cross-board entries; this was the bug behind
  GPT/Grok showing ~1170), then regex
  `"modelDisplayName":"…","rating":N,"ratingUpper":…,"ratingLower":…,"votes":N`.
  Each model maps via the `ARENA` slug→token table (token(s) must all appear in the
  normalized display name; ties broken by higher rating). ~14/22 match; the rest keep curated
  ELO. Verified live: GEM3P 1485.9, OPUS 1477.4, SON46 1470.7, GROK4 1459.6, GPT52 1434.8.
- **Live usage** = a matched model's share of total arena votes (%), replacing curated
  OpenRouter share. UI label changed "OpenRouter use" → "Usage share".
- **Auto-resolution** (`resolver.js` + shared `resolve.js`): markets carry a JSON `resolver`
  spec. Kinds: `elo_threshold` (YES when max live ELO ≥ value, early; else NO at close),
  `elo_lead {a,b}` (at close, higher live ELO wins; outcomes labeled with model names),
  `open_top` (at close, YES if top-ELO index model is open). Cron every 30s; emits
  `market:resolved` over Socket.io. `resolve.js` holds the shared pro-rata payout used by both
  the admin route and the resolver.
- **AUTO badge** is driven by `autoResolvable = !!market.resolver`, NOT `resolution==='auto'`
  — a legacy market (top-elo-2026-q3) was `resolution:'auto'` since v1 but had no resolver, so
  it falsely badged as auto and would never self-resolve. Badge on resolver presence instead.
- Seed gained a market backfill (resolution/resolver/rules) because `ON CONFLICT DO NOTHING`
  skips updates on pre-existing markets.

## v0.4.0 (redesign + coverage)
- **Design language** lives in `tailwind.config.js` (palette: ink #07080c, panel, edge, up
  #27d18b, down #fb5a6a, accent/gold #f0c04e; fonts display=Space Grotesk, sans=Inter,
  mono=JetBrains) + `index.css` component classes (`.card` with inner-highlight gradient,
  `.btn-primary/buy/sell` gradients, `.lift` hover, `.num` mono-tabular, `.label`, `.live-dot`).
  Page-level changes just use these — recoloring/​restyling propagates from the tokens.
- **TAILWIND CONFIG CHANGES NEED A DEV-SERVER RESTART** (Vite caches it; `vite build` always
  picks it up). Hit this every redesign — restart after editing tailwind.config.js.
- **BSI hero** = `MarketStats.jsx`, rebuilt: big index number + own sparkline (sampled ~1/s
  into local state) + breadth + two highlight cards.
- **Hooks gotcha fixed**: MarketStats had `if(!models.length) return null` BEFORE a useEffect →
  "rendered more hooks" crash when models loaded. Rule: all hooks above any early return.
- **ELO coverage 14→16**: mapped `deepseek-r2`→`deepseek-r1` and `nova-pro`→`nova` (the live
  board entries). Genuinely-absent (off the top-200 overall board): grok-4-mini, llama-4
  maverick/scout, mixtral, phi-4, and o4 (o4-mini exists but match is flaky) — keep curated.
- **Benchmark stays curated** — confirmed the LMArena page only embeds the `overall` board
  (no coding/hard sub-board in the payload), so there's no free benchmark feed to scrape.

## v0.5.0 (vote-driven pricing)
- **Mechanic swap:** retired the trade-demand price driver; price target is now
  `fundamental + vote_count × VOTE_RATE` (VOTE_RATE=5 in `pricing.js`). Tick band hugs the
  vote-adjusted target (`target×0.8 … target×1.2`), THETA bumped to 0.10. The `demand`
  column is kept dormant (not dropped); `addDemand` removed; trade route no longer calls it.
- **Schema:** `votes(user_id, model_id, created_at)` PK(user_id,model_id) + `models.vote_count`.
- **Routes:** `POST /api/models/:slug/vote` (requireAuth) toggles + updates vote_count.
  Models list/detail use `optionalAuth` so `votedByMe` is per-user without forcing login.
  Tick payload + Socket snapshot now carry `votes` (was `demand`).
- **Client:** `VoteButton.jsx` (new); prices store tracks `votes` map; Floor "Votes" column +
  "Most voted" sort + `patchVote`; ModelDetail "Community votes" card + "+$X from N votes" in
  Why-this-price; MarketStats "Most voted" highlight. `FlowBar.jsx` deleted (dead).
- **Verified:** 15 votes → Phi-4 +34% to target $293.15; toggle 1↔0 works; in-UI click 15→16.
- **Clean slate (2026-06-15):** wiped all dummy data — deleted the dev DB and re-seeded, so
  there are NO users (incl. the old sylvie/trader_demo/voter_* test accounts), votes, trades,
  or bets; only seeded content (22 models, 13 markets, 4 battles) remains. First new signup
  becomes admin (createUser makes user #1 admin). To reset again: stop server, delete
  `server/data/bench-street.db*`, `npm run seed`, restart.

## Known issues / TODO
- **"24h" change is since server boot** — `prev_close` is set once at startup, not a true
  rolling 24h. Add a daily rollover job (cron) to snapshot prev_close.
- **Only benchmarks remain curated** — ELO + usage (LMArena), price (OpenRouter), downloads
  (HF) are all live now. ~8 smaller/older models don't appear on the LMArena overall board so
  keep curated ELO. No free real-time benchmark feed; that's the last curated leg.
- **LMArena scrape is brittle** — it parses an embedded RSC payload, not an API. If LMArena
  changes its leaderboard page markup the regex/slice may need updating (degrades gracefully:
  keeps prior ELO). The `ARENA` token map needs maintenance as model names drift.
- **Auto-resolution covers ELO-derived markets only** — release/IPO/benchmark-claim markets
  still need an admin (no programmatic feed). Arena battles settle automatically by Elo.
- **No shorting** in v1 (by design).
- **recharts bundle >500kB** — fine for now; code-split later if needed.
- **Tailwind config edits need a dev-server restart** — the running Vite/PostCSS caches the
  config; `vite build` always picks it up. (Hit this during the redesign.)
- **Demand has no cross-user fairness cap beyond the per-trade/decay clamps** — fine for
  play money; revisit if leaderboards get gamed.

## Next ideas (v2+)
- Companies as a second asset class; AMM/order-book mode once there's a real player base.
- Real ELO/usage feed (LMArena scrape) + benchmark dataset to make ALL signals live.
- Auto-resolve prediction markets from feeds where possible (hybrid resolution).
- Real head-to-head output battles (actually run both models on a prompt + judge) vs the
  current Elo-roll settlement.
- Daily prev_close rollover, news ticker, options/shorting.
