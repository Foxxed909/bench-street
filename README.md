# 📈 Bench Street

Bench Street is a play-money exchange where people trade **AI models like stocks**, vote on
which models deserve higher valuations, and make predictions about AI releases, benchmarks,
and head-to-head model matchups.

Each account starts with **$100,000 in play credits**. No real money is accepted and nothing
in the app is investment advice.

## What drives a model price

A model opens with a quality-ranked baseline derived from its curated benchmark score. The
community then moves that price with one toggleable like or dislike per user:

```text
price = max(0, opening vote-equivalent + likes - dislikes) × per-vote value
```

The per-vote value starts at `$5` and is scaled between `0.5×` and `2×` by the model's blended
API token price. Trades affect portfolios and P&L, but **trades do not move the quoted price**.
Votes and refreshed token-price signals do.

The app also includes:

- a live Floor with roughly 70 model and effort-tier listings
- model pages with benchmarks, signals, comments, watchlists, and trading
- portfolios, trade history, and a net-worth leaderboard
- parimutuel prediction markets for AI events
- an Arena with Elo-weighted head-to-head model battles
- Socket.io updates for prices and market settlement events

## Stack

- **Client:** React 18, Vite, Tailwind CSS, Recharts, socket.io-client
- **Server:** Node.js, Express, better-sqlite3, Socket.io, JWT, bcrypt
- **Production:** Vercel frontend plus an always-on Railway API with a persistent SQLite volume

## Production

- Frontend: `https://benchstreet.vercel.app`
- API: `https://bench-street-api-production.up.railway.app`

The frontend and API are intentionally separate. The API owns SQLite, Socket.io, scheduled
signal ingestion, candle recording, battle settlement, and prediction-market resolution, so it
must not be deployed as a stateless Vercel function.

## Quickstart

```bash
npm run install:all
npm run dev
```

The server runs on `http://localhost:4000`; the Vite client runs on
`http://localhost:5173` and proxies `/api` plus `/socket.io` to the server.

To run the idempotent seed/upsert process:

```bash
npm run seed
```

The seed command updates the configured roster and starter markets. It is **not** a safe
"wipe everything and start over" command; the production database lives on persistent storage.

## Tests and builds

```bash
npm --prefix server test
npm --prefix client run build
```

## Repository layout

```text
server/src/
  config.js       environment and security configuration
  db.js           SQLite schema and additive migrations
  seed.js         roster, opening lines, prediction markets, and starter battles
  pricing.js      vote-priced quotes, candles, and daily reference prices
  ingest.js       LMArena, OpenRouter, and Hugging Face signal ingestion
  resolver.js     automatic prediction-market resolution
  battles.js      Arena generation and settlement
  routes/         auth, models, trade, portfolio, markets, battles, leaderboard, admin

client/src/
  pages/          Floor, ModelDetail, Portfolio, Predictions, Arena, Leaderboard, Login
  components/     navigation, ticker, stats, charts, comments, vote controls
  store/          auth and Socket.io price state
```

## Security notes

Set a strong production `JWT_SECRET`, configure the admin allowlist through environment
variables, keep Railway/Vercel credentials out of the repository, and rotate any credential
that has ever been committed. Private repositories are access controls, not secret vaults.
