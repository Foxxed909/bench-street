# Bench Street — Public Changelog

## v1.0.0 — Real model lineups, suspended models, research bets (2026-06-15)

### Features
- **Real model names.** Retired the synthetic low/medium/high/xhigh/max effort matrix. Each lab now
  shows the lineup it actually ships — GPT-5.5 & GPT-5.6 (base + Pro), Grok 4.3 (base + Heavy),
  Gemini 3.5 (Pro + Flash), and the Anthropic pair. 32 models total (down from 52), no more fake
  "GPT-5.6 Max".
- **Suspended models.** Claude Fable 5 & Claude Mythos 5 are listed with an "Access suspended" badge
  reflecting the real 2026-06-12 US-government export directive. They show a notice on their page,
  aren't tradeable, and can't be voted on — but stay visible.
- **Research bets.** Three new prediction markets that settle on Bench Street's own data:
  *Which model tops BridgeBench at year-end?* (Benchmarks), *Most valued model at year-end?*
  (Price action), and *Will Fable 5 & Mythos 5 access be restored in 2026?* (News).
- **Newest on top.** The Floor defaults to a "Newest" sort, with a "new" badge on models released in
  the last ~45 days and a release date on each model page.

## v0.9.0 — Likes & dislikes, new models, benchmarks, polish (2026-06-15)

### Features
- **Dislikes.** Every model now has like *and* dislike. Net sentiment (likes − dislikes) drives the
  price: like to push it up, dislike to pull it down. One stance per model, toggleable. Price still
  floors at $0.
- **Way more models.** Added the latest frontier models and their full reasoning-effort matrix —
  GPT-5.5 & GPT-5.6, Claude Fable 5, Mythos 5, Gemini 3.5 Pro, Grok 4.3 — each in low / medium /
  high / xhigh / max tiers (52 models total). Higher tiers cost more per token and score higher.
- **Benchmarks.** Each model page shows a benchmark suite — BridgeBench (the live vibe-coding board),
  SWE-bench, GPQA, AIME, MMLU — as a clean bar chart with an average.
- **App icon + identity.** Added a candlestick app icon/favicon, social preview tags, and a web
  manifest so it installs cleanly.

### Polish
- Reasoning-effort **tier badges** (low→max) across the Floor and model pages.
- The Floor's sentiment column shows live 👍/👎; "Top rated" sort + highlight by net sentiment.
- Model page "Community sentiment" card with an approval bar.
- Fixed a stale-token console error on load; refreshed the footer copy.

## v0.8.0 — Comments on every model (2026-06-15)

### Features
- **Discussion on each model page.** Signed-in users can post comments; everyone can read them.
- Comments show the author and a relative timestamp, newest first.
- You can delete your own comments (admins can remove any); a live character counter caps posts
  at 500 chars.

## v0.7.0 — Live from zero: votes set the price (2026-06-15)

### Changes
- **Every model launches at $0** and only gains value as people vote. No more pre-seeded
  prices, no simulated ticks, no fabricated 24h swings — numbers move only on real activity.
- **Price = votes × per-vote value.** Each vote is worth a $5 base, scaled ×0.5–2.0 by the
  model's blended token price ($/Mtok). So a vote on a pricey frontier model (e.g. o4, ~$10/vote)
  moves it more than a vote on a cheap small one (e.g. Phi-4, ~$2.50/vote) — the crowd drives it,
  real economics tilt it.
- Voting updates the price instantly and broadcasts it live to everyone.
- Trading is disabled on a model until it has votes (no price = nothing to trade).
- Model pages now explain price as *votes × per-vote value*, with a clean empty state before
  the first vote.

## v0.6.0 — Cost × quality pricing (2026-06-15)

### Changes
- **New base price formula.** A model's fundamental is now its **token economics × its
  quality**: `blended API price ($/Mtok) × quality(ELO) × multiplier`, clamped to $10–$2500.
  Pricier, higher-rated frontier models trade richer; cheap small models trade lower. Replaces
  the old weighted signal index.
- **Fresh start.** Wiped all placeholder/runtime data — prices, 24h baselines, votes, and test
  accounts all reset to zero. Prices now build up purely from live signals and real votes.
- Model pages explain the price as factor chips: *API $/Mtok × quality(ELO) × multiplier =
  fundamental*, then *+ votes × $5*. Live signals are shown for transparency, with the two that
  drive price (API price, ELO) badged.

## v0.5.0 — Votes drive the price (2026-06-15)

### Features
- **Community votes set the price.** A model's price is now its real-signal fundamental plus
  **$5 for every vote** it gets. Buying and selling still earn you play-money P&L, but votes —
  not trades — are what move a model's worth.
- **One vote per model**, toggleable (upvote on/off). Vote from the Floor or a model's page.
- The Floor gained a **Votes** column and a **Most voted** sort; model pages show a
  **Community votes** card and break the price down as *fundamental + votes × $5*.
- Replaced the old trade-driven "buy pressure" mechanic with this simpler, harder-to-game model.

## v0.4.0 — Visual redesign + wider live coverage (2026-06-14)

### Design
- **New "premium terminal" look** — a cohesive design language across every page: deep
  near-black canvas with soft gold/green auroras, Space Grotesk display type, refined cards
  with inner highlights and depth, gradient Buy/Sell/primary buttons, and gold+green identity.
- **BSI hero** — the Bench Street Index is now the centerpiece of the Floor: a large live
  index number with its own sparkline and advancing/declining/listed breadth.
- **Branded sign-in** and refined nav, tables, badges, and motion throughout.

### Data
- **Wider live ELO** — 16 of 22 models now pull live LMArena ratings (added DeepSeek R-series
  and Amazon Nova); the rest aren't on the public board and keep curated values. Benchmarks
  remain the one curated signal (no free real-time source).

## v0.3.0 — Live ELO & self-resolving markets (2026-06-14)

### Features
- **Live LMArena ELO** — model strength now tracks the real LMArena leaderboard (live
  rating), and **usage** is now live too (a model's share of arena votes). Combined with
  the existing live OpenRouter pricing and HuggingFace downloads, only benchmarks remain
  curated. Matched models show their live ELO on the model page.
- **Auto-resolving prediction markets** — markets that a data feed can decide now settle
  themselves and pay out automatically; they carry an "auto" badge. Examples: "Will any
  model exceed 1400 ELO?" resolves the instant it's true; "Higher Elo at close: A or B?"
  settles to the live leader when it closes. Everything else stays admin-resolved.

## v0.2.0 — Live data, markets & the Arena (2026-06-14)

### Features
- **Live signal feeds** — model fundamentals now track reality: live API pricing from
  OpenRouter and live download counts from HuggingFace, refreshed on a cron. Models carry a
  "live" badge and the Floor shows signal freshness ("signals 33s ago"); admins can refresh
  on demand.
- **Polymarket-style Predictions** — a rich slate of real AI markets across categories
  (Releases, Capability, Open weights, Pricing, Milestone, Company, Leaderboard) with big
  Yes/No probabilities, payout multiples, multi-outcome races, and resolution criteria.
- **Market resolution & payouts** — markets close at their deadline; admins resolve to the
  winning outcome and winners are paid pro-rata from the pool. "My bets" shows won/lost.
- **The Arena (head-to-head betting)** — back one model to beat another in a category.
  Parimutuel sides, live Elo win-probability, and automatic settlement when the matchup
  closes (admins can settle early). Fresh matchups are generated continuously.
- **Polished UI & motion** — rolling animated numbers, live pulse + flash on price changes,
  glass card surfaces, staggered entrances, smooth bar transitions, hover lift.



## v0.1.0 — Initial build (2026-06-14)

### Features
- **The Floor** — live market of 22 real AI models with prices, 24h change, buy-pressure
  bars, and trend sparklines. Sort by price / gainers / losers / most hyped; search.
- **Bench St. Index (BSI)** — market-wide index header with breadth (gainers vs losers),
  top mover, and most-hyped model.
- **Live ticker tape** — scrolling price strip across the top of every page.
- **Model detail** — live area chart vs the fundamental-value line, a "Why this price"
  signal breakdown, and a trade ticket (quick 1/5/10/Max buttons, position + open P&L).
- **Signal-driven pricing** — each model's fair value is a weighted index of LMArena ELO,
  OpenRouter usage, benchmarks, downloads, and API price.
- **Demand-driven prices** — buying lifts a model above fundamental, selling drags it down;
  a decaying demand term means flow moves the market. Shown as a live "buy pressure" meter.
- **Portfolio** — net worth, cash, holdings, live value + open P&L, trade history.
- **Predictions** — parimutuel markets on AI events with live implied odds and payouts.
- **Leaderboard** — traders ranked by net worth.
- **Accounts** — JWT signup/login; every new trader starts with $100,000 in play credits.
- **Live updates** — prices tick every ~4s over Socket.io with green/red flash animations.
