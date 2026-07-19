# Bench Street — Code Review & Backlog

> In-depth review of the codebase as of `39af3b3` (v1.3.0). 54 tasks, prioritized
> P0 (correctness/security, do first) → P3 (polish/nice-to-have). Each item notes
> the file(s) and the *why*. This is a working doc — check items off as we go.

Stack reviewed: server (Express 4 + better-sqlite3 + Socket.io + JWT), client
(React 18 + Vite + Tailwind + Recharts). ~5,100 LOC, 43 source files, **0 tests**.

---

## Sentiment pricing + Benchtest — 2026-07-18

**Shipped (this branch):** internet-sentiment pricing. `sentiment.js` searches HN
(Algolia) + Reddit (public .json) for each active model's name every hour, scores
titles with a small lexicon, stores −1..1 on `models.sentiment`, and `priceFor`
tilts price by at most ±15% (`sentimentBoost`, pricing-core.js). Votes stay the
wheel; the internet is the tide. Live test: 26/39 models scored in ~165s
(GPT-5.5 Pro +0.30, Grok 4 +0.26). Also shipped: Benchtest scores merged into
Bench Street benchmarks via `server/data/benchtest.json` (gpt-5-6: 97,
claude-fable-5: 96), July 2026 roster (Sol/Terra/Luna, Kimi K3, Grok 4.5).

**Sentiment follow-ups:**
- [ ] **S1. LLM classification instead of lexicon** — lexicon misses sarcasm/context; a cheap free-tier model could label titles pos/neg/neutral.
- [ ] **S2. More sources** — X needs a paid API; consider lobste.rs, YouTube titles, product review sites. Per-source weighting.
- [x] **S3. Show sentiment in the client** — a tide gauge on ModelDetail + Floor column; today it's server-only and invisible.
- [ ] **S4. Sentiment history** — store per-refresh snapshots so we can chart perception over time (and detect launch-hype decay).
- [ ] **S5. Name-collision queries** — "Sol"/"Luna" pull crypto noise; quote full names, maybe require a lab keyword in the hit.

**Benchtest discussion agenda (the "benchmarks and stuffs" talk):**
- [ ] **B1. Suite difficulty saturation** — Sol vs Fable both near-max everything except the villanelle. Need harder tiers: multi-step debugging on real repos, adversarial reasoning, longer creative constraints.
- [ ] **B2. Answer-key review process** — three wrong keys slipped in (bird 225, father 24, 7^100 mod 5 = 1). Rule: every key verified against a worked reference before a suite ships (suite-check.mjs exists; make it mandatory).
- [ ] **B3. Physics + Bullshit rerun** — the Sol-vs-Fable background run was killed mid-flight; rerun when ready.
- [ ] **B4. Chess series** — Sol leads 1–0 (game 1 was a forfeit — Fable's CLI broke during /login, not a real loss). Game 2 abandoned. Play a clean best-of-N; tournament mode is built.
- [ ] **B5. Judge quality** — 2-judge CLI panel; add position-bias control (swap answer order), a third judge for tiebreaks, and calibration tasks with known scores.
- [ ] **B6. Objective/judge blend** — 50/50 is arbitrary; consider per-category weights (coding mostly objective, creative mostly judged).
- [ ] **B7. Auto-feed loop** — `benchtest export --benchstreet` is manual; cron it or hook it post-run so Bench Street stays current.

---

## External product audit — 2026-06-20 (blind, public-surface only)

An outside agent reviewed the live site without logging in. Useful as a fresh set of
eyes, but ~half its P0s were already shipped (it couldn't see the backend). Triage:

**Already done (audit didn't know):** zero-price trading is blocked (`trade.js:18-27`);
market/battle deadlines are server-side (`markets.js:8-12,79`, `battles.js:18,81`);
Fable 5 / Mythos 5 seeded as `suspended`, GPT-5.6 as `upcoming`, status system exists;
money moves inside `db.transaction()` with the balance check inside (and better-sqlite3
is synchronous single-threaded, so the "two concurrent orders both pass" TOCTOU can't
happen). Model detail pages already exist (`ModelDetail.jsx`).

**Fixed this pass (v1.5.0):**
- [x] **A1. Roster gaps.** Added Gemini Omni, Muse Spark, GLM-5.2, Command A+, North Mini Code. (`server/src/seed.js`)
- [x] **A2. Arena "0% · 1.00×" on empty pools.** Auto-created battles open at `pool 0,0` (`battles.js:74`); the UI now shows the Elo estimate + "No bets yet" until real bets land. (`client/src/pages/Arena.jsx`, `server/src/routes/battles.js` `hasBets`/`traders`)
- [x] **A3. Dead "Top mover +0.00%".** Shows "Flat — no movement yet" when nothing moved. (`client/src/components/MarketStats.jsx`)
- [x] **A4. Predictions liquidity.** Pool size + trader count on every card; exact UTC close on hover. (`client/src/pages/Predictions.jsx`, `server/src/routes/markets.js` `traders`)

**Valid, deferred (genuine work, not a quick fix):**
- [ ] **A5. Mobile redesign** — overlaps #32. Bottom nav + card collapse.
- [ ] **A6. Contrast / a11y** — muted text on dark, focus states, reduced-motion, ticker pause.
- [ ] **A7. Leaderboard empty-state** — seed labelled demo bots, "season begins at N traders."
- [ ] **A8. News/event tape** — verified events attached to affected models ("Trade this event").
- [ ] **A9. Capability indices** (coding/agent/reasoning/etc.) and lab ETFs.
- [ ] **A10. Separate fundamentals from price (AMM/LMSR).** Today price moves on likes−dislikes anchored to bench. The audit wants an order-flow market maker with sentiment kept separate. This is a deliberate rearchitecture — an owner decision, not a bug. **Discuss before building.**

---

## P0 — Security & correctness (do first)

- [x] **1. Admin promotion is contradictory and unsafe.** `auth.js:createUser` promotes the *first* signup (`userCount === 0`) and anyone whose name is in `ADMIN_USERNAMES` (default `'admin'`). But `db.js:205` claims it "never silently promote a random first signup" and uses a *different* env var (`ADMIN_USERNAME`, dev default). On a fresh prod DB, whoever signs up first becomes admin, and anyone registering as `admin` becomes admin. Pick ONE source of truth: an env allowlist, never signup order. (`server/src/auth.js:18-36`, `server/src/db.js:204-212`)
- [x] **2. JWT_SECRET silently defaults to `'dev-secret-change-me'`.** If the env var is unset in prod, every token is forgeable — full account takeover. Refuse to boot in production when `JWT_SECRET` is missing/default. (`server/src/auth.js:5`)
- [x] **3. No rate limiting anywhere.** Login/signup are brute-forceable; vote/trade/comment are spammable. Add `express-rate-limit` (tight on `/auth`, looser elsewhere). (`server/src/index.js`)
- [x] **4. No input validation on usernames/email.** No length cap, charset rules, or email-format check — garbage/huge values get stored and rendered (comments, leaderboard). Add a small validator (zod or hand-rolled). (`server/src/routes/auth.js:13-26`)
- [x] **5. Persistent volume for SQLite.** DONE 2026-06-20. `railway volume list` was EMPTY → prod DB was ephemeral, wiped every deploy. Fixed: `db.js` reads `DATA_DIR`; created volume `bench-street-api-volume` mounted at `/data`; set `DATA_DIR=/data`. Verified live: volume Ready, `currentSizeMB ≈ 49` (the DB is on the volume). See `private.md` for the full runbook + the Git-Bash `/data` path-mangling gotcha. (`server/src/db.js`)
- [x] **6. Admin `refresh-signals` doesn't broadcast.** `ingestSignals()` is called without `io`, so a manual admin refresh updates prices in the DB but never pushes them to connected clients — they look stale until the next cron tick. Pass `io`. (`server/src/routes/admin.js:13`)

## P1 — Real bugs & gaps

- [x] **7. Socket snapshot race.** `socket` auto-connects at import; the `snapshot` handler is attached later in `PricesProvider`'s effect. If the handshake finishes before mount, the opening snapshot is dropped and the board stays empty until the first price event. Emit a `request-snapshot` on connect, or have the client ask for one. (`client/src/lib/socket.js`, `client/src/store/prices.jsx:13-47`, `server/src/index.js:52-61`)
- [x] **8. Charts are nearly empty.** Candles are only written on votes, ingest (every 10 min), and boot — so price history is sparse and most sparklines/area charts are flat. Add a 1-minute candle writer that carries the last close forward. (`server/src/pricing.js:55-82`)
- [x] **9. `prev_close` 24h roll is anchored to server boot, not midnight.** The "24h" column resets at an arbitrary time and re-resets on every redeploy. Anchor the roll to a real daily boundary (e.g. UTC midnight). (`server/src/pricing.js:123-126`)
- [ ] **10. Money stored as floating-point `REAL`.** Repeated buys/sells/payouts accrue rounding drift. For a thing that calls itself an exchange, move to integer cents (or at least round consistently at every write). (`server/src/db.js` schema, all routes touching `cash`)
- [ ] **11. VARIANTS get no live pricing.** `gpt-5-5`, `gpt-5-5-pro`, `grok-4-3`, `gemini-3-5-*` etc. aren't in `PROVIDER_IDS`, so they never receive a live OpenRouter price — they sit on the seed value forever while their base siblings move. Either map them or document that they're intentionally static. (`server/src/seed.js:127-150`)
- [ ] **12. Misleading provider mappings.** `o4 → openai/gpt-5.2-pro` and `grok-4 → x-ai/grok-4.3` pull a *different* model's live price. Cheap "best match" today, but the displayed API $/Mtok (which sets vote value) is wrong. Review the mapping table. (`server/src/seed.js:127-150`)
- [ ] **13. LMArena ingest is regex-scraping HTML.** `parseArena` will silently break the day the page markup changes. It degrades gracefully (keeps prior values) but no one is alerted. Add a "stale signals > N hours" warning, and consider a more stable source. (`server/src/ingest.js:77-103`)
- [ ] **14. HF downloads fetched sequentially in a loop.** One `await` per open model serializes the whole ingest. Batch with `Promise.all`. (`server/src/ingest.js:172-179`)
- [ ] **15. No global error boundary on the client.** A single render throw blanks the entire app. Add a React error boundary with a fallback. (`client/src/App.jsx`)
- [ ] **16. `optionalAuth`/`requireAuth` hit the DB on every request.** Fine now, but every authed call does a `SELECT * FROM users`. Acceptable; revisit if traffic grows. (`server/src/auth.js:55-84`)

## P2 — Tests, tooling, data hygiene

- [x] **17. Zero automated tests.** → Vitest stood up (`server/test/`), 18 tests, `npm test`. The convention (per workspace CLAUDE.md) is Vitest. Start with the money-critical pure functions. (whole repo)
- [x] **18. Test `pricing.js`** (math extracted to `pricing-core.js`; also covers `eloWinProb`) — `costFactor` clamping, `perVoteValue`, `priceFor` (net ≤ 0 → $0, scaling). (`server/src/pricing.js`)
- [ ] **19. Test settlement math** — `settleBattle` and `resolveMarket` pay out the full pool pro-rata and never mint/burn cash. (`server/src/battles.js`, `server/src/resolve.js`)
- [ ] **20. Test the vote toggle state machine** — like → none → dislike → switch, and tally sync. (`server/src/routes/models.js:130-172`)
- [ ] **21. Test `expandEfforts` + opening-line math** — 17 reasoning families ×3, suffixes/tickers, `base_votes = max(0, bench−62)`. (`server/src/seed.js`)
- [ ] **22. Add a CI workflow** (GitHub Actions): install, lint, build client, run tests on PR. (new `.github/workflows/`)
- [ ] **23. Add ESLint + Prettier** with a shared config; no linter is configured today. (repo root)
- [ ] **24. Add `client/.env.example`** documenting `VITE_API_URL` (server has one; client doesn't). (`client/`)
- [ ] **25. Rename `resolve.js` vs `resolver.js`.** Near-identical names for "settle a market" vs "decide which markets to settle" — genuinely confusing. e.g. `settleMarket.js` / `autoResolver.js`. (`server/src/`)
- [ ] **26. Document or drop legacy columns** `models.demand` and `models.vote_count` — retired but kept dormant. Leave a one-line note or migrate them out. (`server/src/db.js:170-173`)
- [ ] **27. Reconcile-delete is destructive.** Removing a slug from the roster cascades away users' holdings/votes/comments. Fine for retiring fakes, dangerous if a slug is ever *renamed*. Add a guard/log so it can't silently wipe a model with open positions. (`server/src/seed.js:322-330`)
- [ ] **28. Leaderboard N+1.** One holdings query per user; collapse to a single `GROUP BY`. Also filter out brand-new untouched $100k accounts so the board isn't a wall of ties. (`server/src/routes/leaderboard.js`)
- [ ] **29. No migration versioning.** The additive `ensureColumn` approach works but has no version record or rollback path. Add a tiny `schema_version` table. (`server/src/db.js`)
- [ ] **30. Clean up stale root docs.** `continue.md` and `VOTING-PLAN.md` are old planning notes living in the repo root. Move to `/docs` or delete. (repo root)
- [ ] **31. Verify README + DEPLOY accuracy.** README likely still says prices "launch at $0"; that changed to the quality opening line. (`README.md`, `DEPLOY.md`)

## P2 — UX / product (the "felt like Polymarket" thread)

- [ ] **32. Mobile tables overflow.** Floor and Portfolio are wide multi-column `<table>`s; on phones they scroll/clip. Add a stacked card layout below `sm`. (`client/src/pages/Floor.jsx`, `Portfolio.jsx`)
- [ ] **33. Loading skeletons.** Pages flash a bare "Loading…". Add skeleton rows/cards that match the real layout. (all pages)
- [ ] **34. Toast notifications.** Errors/success are inline-only and easy to miss. A small toast system for trades/bets/votes. (new component)
- [ ] **35. Live pool updates for other users' bets.** Arena/Predictions pools only move on *your* action or a settle event — they feel static. Broadcast pool changes on every bet. (`server/src/routes/battles.js`, `markets.js`, sockets)
- [ ] **36. Settle/resolve notifications.** You only learn a bet settled by reloading. Push a socket event → toast when one of *your* positions resolves. (sockets + client)
- [ ] **37. The `opus-vs-gpt-elo` market closes 8 min after first seed** and then sits permanently "closed, awaiting close-time resolution". Reads as broken. Give it a real future close date or rethink. (`server/src/seed.js:191`)
- [ ] **38. Accessibility pass.** Icon-only buttons (watch star, share, refresh, vote) need `aria-label`s; up/down is color-only; add visible focus states. (multiple components)
- [ ] **39. Social/OG meta + favicon.** Share copies a URL but there's no rich preview card or proper favicon/title per model. (`client/index.html`, ModelDetail)
- [ ] **40. Fractional shares policy.** Server accepts any `qty > 0` (fractional, huge). Decide: integer shares only, or embrace fractional and show it consistently. (`server/src/routes/trade.js:13-14`)
- [ ] **41. User profiles / social proof.** No way to see another trader's holdings or a model's top holders. Even a read-only profile adds stickiness. (new route + page)
- [ ] **42. Intro banner doesn't use the new skeuomorphic `.card`.** Visual inconsistency with the v1.3 design language. (`client/src/pages/Floor.jsx:425-451`)
- [ ] **43. No "you" highlight on the leaderboard.** Hard to find yourself in 50 rows. (`client/src/pages/Leaderboard.jsx`)

## P3 — Performance & polish

- [ ] **44. Floor re-renders the whole table on every price tick.** 66 rows + AnimatedNumber each, recomputed on each socket push. Memoize rows or split the live cells into their own subscribers. Low priority at current scale. (`client/src/pages/Floor.jsx`)
- [ ] **45. Add a request body size limit** explicitly (`express.json({ limit })`) instead of relying on the default. (`server/src/index.js:35`)
- [ ] **46. Add `helmet`** for baseline security headers (CSP, HSTS, no-sniff). (`server/src/index.js`)
- [ ] **47. Stronger password policy + "show password" toggle** on the login form. (`server/src/routes/auth.js`, `Login.jsx`)
- [ ] **48. Health check returns more.** `/api/health` could report seed status, model count, last-ingest age for quick prod debugging. (`server/src/index.js:37`)
- [ ] **49. Graceful shutdown.** Close the SQLite handle and socket server on SIGTERM so Railway redeploys don't risk a half-written WAL. (`server/src/index.js`)
- [ ] **50. Empty-history chart state is good but inconsistent** between ModelDetail (nice message) and Floor sparkline (just blank). Unify. (`ModelDetail.jsx`, `Sparkline.jsx`)
- [ ] **51. Dial up the skeuomorphism** (standing offer): more pronounced bevels, a faint noise/texture layer, glossier buttons. (`client/src/index.css`)
- [ ] **52. `compact()`/`money()` locale** is hardcoded `en-US`. Fine, but note it for any future i18n. (`client/src/lib/format.js`)
- [ ] **53. Comment moderation.** No profanity/spam filter and no admin bulk-delete; a single user can flood a model's discussion. (`server/src/routes/models.js:201-219`)
- [ ] **54. Keyboard-trade affordances.** The "/" search shortcut is great; consider similar quick-buy/quick-vote shortcuts to lean into the terminal identity. (`client/src/pages/Floor.jsx`)

---

### Suggested first sprint (my pick)
1, 2, 5 (security + data-loss landmines) → 6, 7, 8, 9 (the bugs users actually feel:
stale prices, empty board race, dead charts) → 17–21 (a real test net so the next
change doesn't break payout math). Everything else is genuine but can wait.
