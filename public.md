# Bench Street — Public Changelog

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
