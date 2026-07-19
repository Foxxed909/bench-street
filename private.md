# Bench Street — Internal Notes

## v1.6.0 — Integrity merge + review fixes (2026-07-19)
Merged the remote hardening PR (#1, was only on origin/main — local main was stale) into the
sentiment branch, then fixed the two bugs an in-depth review confirmed on this branch:
- **Outcome-label drift (regression, this branch).** The July roster commit renamed
  `gpt-5-6-pro` → "GPT-5.6 Sol Pro" but `bridgebench-top-2026` / `most-valued-2026` outcome
  labels still said "GPT-5.6 Pro". resolver.js maps winners BY display name → those markets
  could never auto-resolve if Sol Pro won (it was the BridgeBench favourite). Fixed the MARKETS
  labels + added a positional label-sync backfill in seed.js for unresolved markets on existing
  DBs. Regression-locked in `test/seed.test.js`.
- **Sentiment prefix leak (regression, this branch).** `sentiment.js` spread scores to effort
  variants with `name LIKE ? || '%'`; variants share the EXACT name, so the prefix hit distinct
  models ("Grok 4" → Grok 4.5/4.3/mini; "GPT-5.5" → GPT-5.5 Pro). Now exact-name via
  `applySentiment()`. Local DB contamination zeroed one-off (prod never ran sentiment).
  Regression-locked in `test/sentiment.test.js`.
- **Merge seam:** the PR's `executionPriceFor` predated sentiment — execution/portfolio/
  leaderboard quotes ignored the tilt while the board included it. Sentiment now threads
  through all five call sites; asserted in `test/votes-trades.test.js`.
- The PR already fixed the review's other two findings: Arena battles on suspended/upcoming
  models (status filter) and curated-Elo-as-live auto-resolution (`hasLiveArenaSignal`).
- **Tests 18 → 61** (8 files): DB-harness suites (temp `DATA_DIR` per file) for settlement
  (pro-rata, cent conservation, refunds, double-settle), seed invariants (idempotency,
  label sync), sentiment isolation, and HTTP-level vote/trade flows.
- **Depersonalized:** dev admin default 'sylvie' → 'admin' (prod already ID-based via
  `ADMIN_USER_IDS`; boot demotes stale admins — local dev must re-set ADMIN_USERNAMES or
  sign up as 'admin'). Personal names scrubbed from docs; capture artifacts gitignored.

## Roster + market-clarity pass (v1.5.0) — 2026-06-20
Triggered by an external blind product audit (public-surface only — couldn't log in, so it
guessed the backend and ~half its P0s were already shipped). See `TODO.md` "External product
audit" section for the full triage. Fixed the genuinely-valid, fixable items:
- **Roster (A1)** — added Gemini Omni, Muse Spark (Meta), GLM-5.2 (Zhipu), Command A+ + North
  Mini Code (Cohere) to `seed.js` VARIANTS. Single-tier (not in REASONING set → no low/med/high
  expansion). Not in PROVIDER_IDS, so they sit on curated seed prices (same as other VARIANTS —
  see open TODO #11). Roster already had Fable 5/Mythos 5 (suspended) + Grok 4.3.
- **Arena empty-pool (A2)** — root cause: auto-created battles open at `pool_a/pool_b = 0,0`
  (`battles.js:74`), and `shape()` did `pool_a+pool_b || 1`, leaking a fake `$1` pool → UI showed
  `0% · 1.00×`. Fix: `shape()` returns real `pool` (0 when empty) + `hasBets` + `traders` (distinct
  bettors). Arena.jsx Fighter shows `eloProb% est` + "No bets yet" until `hasBets`, then live pool +
  backer count.
- **Top-mover dead state (A3)** — MarketStats.jsx: pick biggest ABS mover, but null it if `|cp| <=
  0.01`; render a "Flat — no movement yet" tile instead of crowning `+0.00%`.
- **Predictions liquidity (A4)** — markets.js `withOdds` returns `traders` (distinct bettors) and
  real `volume`/`pool` (was `|| 1`). Predictions.jsx shows pool + trader count per card + exact UTC
  close on hover.
- **DEFERRED:** A10 (separate fundamentals from price via AMM/LMSR) is a real rearchitecture —
  flagged as a product decision for the owner, NOT started. Plus mobile/a11y/news-tape/indices.

### TODO #5 — PERSISTENT VOLUME — FIXED 2026-06-20 (was the real landmine)
`railway volume list` → **"No volumes found"**: prod SQLite was on ephemeral fs, wiped every deploy.
Fix (all from `server/`, service had to be linked first — project was linked but "Service: None"):
1. `db.js` now reads `process.env.DATA_DIR || <../data>` for the SQLite dir (so the path doesn't
   depend on where Railpack lands the code; `rootDirectory` is null on this service).
2. `railway link --project 189feb6b… --environment production --service bench-street-api` (link service).
3. `railway volume add --mount-path /data` → volume `bench-street-api-volume` (id e91f2161…).
   **GOTCHA:** run volume/var commands from **PowerShell**, not Git Bash — MSYS mangles `/data` into
   a Windows path (`C:/Program Files/Git/data`) → "Mount path must start with a /".
4. `railway variables set DATA_DIR=/data --skip-deploys`.
5. Deploy new code (reads DATA_DIR) → DB now lives on the volume at `/data/bench-street.db`, persists
   across deploys. NOTE: this deploy resets the DB ONE last time (ephemeral → volume); fine pre-launch.

## Hardening pass + live charts (v1.4.0) — SHIPPED 2026-06-16
Driven by an in-depth code review (see `TODO.md` — 54 items, prioritized). First sprint = P0 security
landmines + the felt bugs + a starter test net. Commits f86bb8b + 8996cdb (lock fix). Deployed:
Railway (server, deploy 2ccfb873, verified new code live via socket request-snapshot probe) + Vercel
(client, benchstreet.vercel.app, 200). API: 66 models, max $340, voteRate 5.
- **DEPLOY GOTCHA (for next time):** adding a dep on Windows (`npm i -D vitest`) wrote a lock file that
  was internally inconsistent (missing @emnapi/* wasm transitive deps) → Railway's `npm ci` failed the
  BUILD (deploy showed FAILED with 0 instances, old code kept serving, no runtime logs). Fix: clean
  regen — `rm -rf node_modules package-lock.json && npm install`, then verify with `npm ci` LOCALLY
  before pushing. Always run `npm ci` locally after touching server deps.
- **New `server/src/config.js`** — single source of truth for the admin allowlist + JWT secret +
  STARTING_BALANCE. `ADMIN_USERNAMES` (csv) || `ADMIN_USERNAME` || dev default. `isAdminUsername()` is
  case-insensitive. JWT_SECRET **throws on boot** in production if it's unset/the dev default.
- **#1 admin (security)** — removed `userCount===0` first-signup auto-admin from auth.js `createUser`;
  now `isAdminUsername(username)` only. db.js boot block reconciles ALL allowlisted names (idempotent),
  imports ADMIN_USERNAMES from config (no circular — config imports nothing). auth.js imports
  JWT_SECRET/STARTING_BALANCE/isAdminUsername from config.
- **#2 JWT** — fail-fast in config.js (covered above).
- **#3 rate limiting** — new dependency-free `server/src/ratelimit.js` (fixed-window, in-memory, keyed
  by `req.ip`; `.unref()`'d sweep). index.js: `app.set('trust proxy', 1)` (Railway proxy → real IP),
  global `/api` 300/min, `/api/auth` 60/15min. Per-instance only — note for any multi-dyno future.
- **#4 validation** — routes/auth.js `validateSignup()`: username 3–20 + `/^[A-Za-z0-9_-]+$/`, password
  6–200, optional email regex+len. Signup uniqueness now `LOWER(username)` (case-insensitive).
- **#6 refresh broadcast** — admin.js passes `{ io: req.app.get('io') }` into ingestSignals.
- **#7 snapshot race** — index.js extracts `snapshotStmt` + `sendSnapshot`, handles `request-snapshot`;
  prices.jsx emits `request-snapshot` on `connect` and immediately if `socket.connected` on mount.
- **#8 candles** — pricing.js `writeCandles` tx + `candleTimer` setInterval 60s (carries close forward).
- **#9 prev_close** — pricing.js: `msUntilNextUtcMidnight()` setTimeout→setInterval(24h); stopPricing
  clears all three timers (rollTimeout/rollInterval/candleTimer).
- **Pricing refactor** — pure math extracted to `server/src/pricing-core.js` (VOTE_RATE/costFactor/
  perVoteValue/priceFor, zero imports); pricing.js re-exports them so existing importers are unchanged.
- **#45 body limit** — `express.json({ limit: '100kb' })`.
- **Tests (#17/#18)** — added vitest (server devDep). `server/test/`: pricing-core (clamps, per-vote,
  priceFor net≤0→$0), config (isAdminUsername allowlist = the security assertion), battles (eloWinProb
  symmetry/edge). **18 tests green.** `npm test` / `npm run test:watch`.
- **Verified locally**: server boots (seed idempotent, 66 models, max $340, /api/health ok), client
  builds (bundle 676kb — pre-existing Recharts warning, TODO P3). NOT deployed.
- **Still open from review**: #5 (confirm Railway persistent volume — CRITICAL, needs user/Railway),
  #19–21 (settlement/vote-toggle/seed integration tests need a DB harness), plus all P2/P3.

## Quality opening line + design overhaul (v1.3.0) — SHIPPED 2026-06-15
Driven by a hands-on tester pass (Playwright: signup→vote→trade→all tabs→mobile). Top finding was the
all-$0 dead board; user chose "seed a quality opening line" via AskUserQuestion.
- **Opening line (#1).** New `models.base_votes` col (db.js). seed.js: `baseVotes = active ? max(0,
  round(bench−62)) : 0`, upserted idempotently. pricing.js: net = `base_votes + likes − dislikes` in
  recomputePrices + pushModelPrice (+ priceInputs SELECT). routes/models.js exposes `baseVotes`.
  Verified: Opus-high $330 → Phi-4 $22.50, **0 active models at $0**, avg ~$129. Narrative updated
  (Floor intro, footer, ModelDetail "Why this price" → "opening + votes" chips). This REVERSES the old
  "every model starts at $0" rule — deliberate, user's call.
- **#2 index** — MarketStats BSI averages priced (price>0) tradeable models only.
- **#3 effort order** — Floor SORTS.new tiebreak: releasedAt desc → name asc → EFFORT_ORDER (low<med<high).
- **#4 Grok ticker** — grok-4-3-heavy `GRK43H`→`GRK43HV` (collided with grok-4-3-high `GROK43H`).
- **#6 Arena** — Arena.jsx splits open (lead) vs settled (capped 6 under "Recent results"); battles.js
  TARGET_OPEN 4→6, gen durations 5–14→20–50 min; seed battles bumped to 25–65 min.
- **#7 24h%** — resolved by opening line (prev_close>0 now, so intraday moves show).
- **#8 plural** — Floor sector chip "model"/"models".
- **#9 mobile nav** — Nav.jsx hamburger + dropdown (`md:hidden`), shared LINKS array; wallet stays in bar.
- **#10 admin** — db.js only auto-promotes `ADMIN_USERNAME` (dev default), never a random first signup.
- **Design overhaul (user req: kill void-black, fix vibe-coded borders, add skeuomorphism, bento grid).**
  tailwind: `ink` #07080c→#0a0b16 (indigo), panel/panel2/edge bluer, `shadow-raise`/`shadow-sunken`,
  `bg-panel-raise`. index.css: body indigo + violet/blue/gold radial auroras; `.card` skeuomorphic
  (translucent white edge instead of hard border, top-lit gradient, layered shadow); `.input` recessed
  (inset shadow); `.lift` deeper hover. MarketStats rebuilt as a bento (BSI hero spans 2×2 + 4 equal
  tiles: Top mover, Top rated, Advancing, Declining). Predictions/Arena inherit the theme; betting
  layout untouched ("not bets").

## Effort-tier models + terminal design pass (v1.2.0) — SHIPPED 2026-06-15
- **Effort tiers.** `seed.js`: `REASONING` set (17 base slugs) + `EFFORTS` [low ×0.6 / −22 elo / −5 bench,
  medium ×1.0, high ×1.9 / +12 / +3] → `expandEfforts()` builds ROSTER (32 base → **66**). `medium` KEEPS
  the base slug (preserves votes/prices/markets/battles + inherits the live OpenRouter price); low/high get
  `-low`/`-high` slugs + `L`/`H` ticker suffix, curated price (no provider id → no "live" badge).
  Pro/Heavy/suspended/upcoming are NOT expanded (single fixed compute tier). New `models.effort` col
  (db.js ensureColumn) seeded via insModel; exposed in routes/models.js SELECT + decorate. Prod migrated
  32→66 on a plain `railway up` (idempotent seed + reconcile-delete). Verified: gpt-5-2 low/med/high =
  $5.40 / $9 / $17.10 per Mtok, bench 86/91/94.
- **Terminal Floor.** Floor.jsx: lab `sections` (grouped when `company==='All'`, flattened when a single
  lab is filtered), section header rows, `labs` sector-chip strip (click → `setCompany` toggle), effort
  badge in row, "By lab" toggle. format.js `effortLabel()` / `EFFORT_ORDER`.
- **design-scout findings (design-discipline pass, all routes).** `--live` cyan `#22d3ee` (live-dot +
  pulseRing) deliberately distinct from up-green so "feed live" ≠ "price up". New `LiveClock.jsx` (ticking
  HH:MM:SS + cyan dot, optional `prefix`) in Nav (every URL) + ModelDetail ("as of" quote stamp).
  Single-accent: effort/open badges → neutral `bg-white/[0.06] text-slate-400`, "live" badge → cyan.
  `font-variant-numeric: tabular-nums` on `body`. Login signup-only reassurance footnote. (Predictions/Arena
  inherit the global layer; betting layout untouched per the user's "not bets".)
- Studied via the new user-scoped **design-scout** agent (`~/.claude/agents/design-scout.md`) — studies a
  design, extracts reusable patterns, never implements.
- Commit `df16206`. Both ends deployed + Playwright-verified (0 console errors; the first benchstreet load
  hit a transient sandbox network blip — clean on reload, API returned 66 every curl).

## Coming-soon, watchlist, filters, payout previews (v1.1.0)
- **`upcoming` lifecycle (3rd status).** GPT-5.6 & 5.6 Pro reseeded `status:'upcoming'`, `released_at:null`.
  Generalized the guards: vote route (models.js) + trade.js now reject any `status !== 'active'`
  (suspended OR upcoming) with a tailored message. Floor `StatusBadge` + ModelDetail render suspended
  (amber)/upcoming (sky "soon")/new. ModelDetail has a blue "Coming soon" banner; `inactive =
  suspended||upcoming` gates trade+vote. Floor `new` sort floats `upcoming` to the very top, then by
  `releasedAt` desc. NOTE the bet markets still list `gpt-5-6-pro` as a year-end candidate — fine,
  it'll be released by close.
- **Watchlist (client-only).** `lib/watchlist.js` = localStorage set (`bs_watchlist`) + module-level
  pub/sub + `useWatchlist()` hook + `toggleWatch()`. `components/WatchStar.jsx` (stops propagation so
  it works inside row links — star is OUTSIDE the `<Link>` to avoid button-in-anchor). Floor has a
  star per row + a "Watchlist" filter toggle.
- **Floor filters.** Company `<select>` (derived from roster), "/" focuses search + Esc clears
  (window keydown, skips when typing), "Showing X of Y" count, empty-state message (watchlist vs
  filters). Intro banner (`bs_intro_dismissed`) adapts: logged-out gets a $100k signup CTA.
- **Payout previews.** Predictions MarketCard + Arena BattleCard show `stake × payout` ("to win ≈")
  live as you type. ModelDetail "Share" button = `navigator.clipboard.writeText(location.href)` with
  an inline "Copied!" (1.6s), plus a header WatchStar.
- **Index correctness (MarketStats).** BSI/base/gainers/losers/topMover/topRated now computed over
  `tradeable = live.filter(m => !m.status || m.status==='active')`; "listed" count stays total.
- Verified live via Playwright: GPT-5.6/Pro "soon" at top + coming-soon page + disabled trade;
  watchlist star→filter→"Showing 1 of 32"; company filter/intro/CTA/count all present; 0 console errors.

## Real lineups, suspended models, research bets (v1.0.0)
- **Roster 52 → 32.** Deleted `TIER_BASES`/`TIERS`/`TIER_MODELS` from seed.js. New `VARIANTS` array
  (10 real models: gpt-5-5(+pro), gpt-5-6(+pro), grok-4-3(+heavy), gemini-3-5-pro, gemini-3-5-flash,
  claude-fable-5, claude-mythos-5) appended to `BASE_ROSTER` (22). The old fictional `mythos-5`
  (company 'Mythos') is gone; `claude-mythos-5` (Anthropic) replaces it.
- **Idempotent seed + reconcile.** The model upsert now runs on EVERY boot (moved out of the
  `modelCount===0||force` guard), so a plain redeploy migrates prod. Baseline signal rows seed only
  when a model has zero `model_signals` (guarded by a count) — the live feed appends the rest.
  A reconcile pass deletes any model whose slug isn't in `ROSTER` (cascades clear its votes/holdings/
  comments/candles). This is how prod dropped from 52 → 32 on redeploy with no force-reseed.
- **Lifecycle columns.** `models.status` ('active'|'suspended', default active), `status_note`,
  `released_at` (additive `ensureColumn` migrations). Fable/Mythos seed as `status:'suspended'` with
  the export-directive note. decorate() exposes `status`/`statusNote`/`releasedAt`. Vote route 400s on
  suspended; trade.js 400s on suspended (belt-and-suspenders with the price>0 guard).
- **Research bets.** Two new auto-resolver kinds in resolver.js, handled BEFORE the live-ELO guard
  (they don't need ELO): `bench_top` (highest `benchmarks[key]` among candidate slugs, at close) and
  `price_top` (highest `models.price` among candidates, at close; returns null if all $0 → admin).
  Outcome labels MUST equal model display names so `outcomeByLabel` maps the winner. Seed markets:
  `bridgebench-top-2026` (Benchmarks/auto), `most-valued-2026` (Price action/auto),
  `fable-restored-2026` (News/admin binary). All close 2026-12-31.
- **Newest-on-top.** `released_at` on all models (BASE_ROSTER got plausible 2025-08…2026-02 dates).
  format.js: removed `splitTier`/`TIER_WORDS`, added `isNew(releasedAt)` (<45d) + `releaseLabel()`.
  Floor: new `new` sort (default), "Newest" tab first, `new`/`suspended` pills, `disabled` on
  suspended rows' LikeDislike. ModelDetail: suspended banner + disabled trade/vote + release date.
  LikeDislike.jsx gained a `disabled` prop. Predictions needed no structural change — new category
  chips appear automatically.
- **Verified live (2026-06-15):** API serves 32 models / 0 tier slugs / Fable+Mythos suspended;
  benchstreet.vercel.app renders Newest-default Floor, suspended badges+banner, disabled Buy/Sell,
  all 3 bet markets with chips, 0 console errors (one transient WS blip, not code).

## Likes/dislikes, models, benchmarks (v0.9.0)
- **Net sentiment drives price:** `price = max(0, likes − dislikes) × perVoteValue`. `votes` table
  gained a `value` column (+1 like / −1 dislike, one row per user/model). `models.like_count` +
  `dislike_count` columns; `vote_count` kept = like_count for back-compat. `syncTallies(modelId)`
  recomputes both from the votes table after each cast. `priceFor(net, tokenPrice)` floors at 0.
- **Vote route** `POST /:slug/vote` now takes `{value: 1|-1}`: same stance toggles off, opposite
  switches. Returns `{myVote, likes, dislikes, price}`. decorate() exposes likes/dislikes/net/
  approval/myVote. Socket payloads carry `{likes, dislikes}` (was `votes`).
- **Roster x-panded to 52:** `BASE_ROSTER` (original 22) + `TIER_MODELS` = `TIER_BASES` (gpt-5-5,
  gpt-5-6, claude-fable-5, mythos-5, gemini-3-5-pro, grok-4-3) × `TIERS` (low/medium/high/xhigh/max).
  Each tier scales apiPrice (×0.45…×2.4), elo, bench. Slugs like `gpt-5-5-max`. NOTE: tier models
  have no PROVIDER_IDS mapping → curated apiPrice (no live OpenRouter price); only the original 22
  show the "live" badge. Adding real OpenRouter ids later would make them live.
- **Benchmarks:** `models.benchmarks` TEXT column = JSON `{BridgeBench, SWE-bench, GPQA, AIME, MMLU}`.
  Seeded by `benchmarksFor()` (derives from each model's `bench` + per-bench offset + deterministic
  `hashJitter(slug+key)` so varied but stable). BridgeBench is a real vibe-coding board (bridgebench.ai).
  Client `Benchmarks.jsx` renders bars; ModelDetail passes `model.benchmarks`.
- **Client:** `LikeDislike.jsx` (replaces VoteButton, now deleted), `Benchmarks.jsx`, prices store
  carries `likes`/`dislikes` maps. `splitTier()` in format.js → tier badges. Floor sort `rated`,
  MarketStats "Top rated" by net. `/auth/me` now optionalAuth → `{user:null}` 200 (no 401 spam).
- **Icon/identity:** `client/public/icon.svg` (candlestick), `site.webmanifest`, favicon + OG tags
  in index.html.

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
  + refresh routes. NOTE: in this dev DB the admin is the dev account (id 1), not
  trader_demo — it predates trader_demo.
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
  there are NO users (incl. the old dev/trader_demo/voter_* test accounts), votes, trades,
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
