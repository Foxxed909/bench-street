# Bench Street

A play-money market for following and debating AI models through a financial interface.
Users receive virtual credits, buy and sell model shares, vote models up or down, make
predictions about AI events, and back randomized Elo-weighted matchups in the Arena.

> Play money only. No deposits, withdrawals, or real-world securities. Prices and payouts
> are game mechanics, not financial advice.

## Live app

- Frontend: https://benchstreet.vercel.app
- API health: https://bench-street-api-production.up.railway.app/api/health
- Deployment details: [`DEPLOY.md`](./DEPLOY.md)

## Current mechanics

### Model prices

Bench Street is a **vote-priced index**, not an order book. Buying and selling shares does not
move a model's quote and there is no counterparty, spread, or slippage.

```text
price units   = max(0, opening units + likes - dislikes)
per-vote value = $5 × clamp(0.5, 2.0, blended API $/Mtok ÷ 5)
share price    = price units × per-vote value
```

- **Opening units** are a curated quality baseline derived from the seeded benchmark score, so
  active models begin with a non-zero ranked opening line.
- **Community sentiment** moves the line one unit per like/dislike. Each signed-in user has one
  toggleable stance per model.
- **API cost** scales the dollar value of each unit. OpenRouter refreshes can therefore reprice a
  model even when its net vote count is unchanged.
- ELO, usage, downloads, and benchmark bars are context. They do not directly enter the current
  price formula.
- Suspended and upcoming models remain visible but cannot be voted on or traded.

### Predictions and Arena

- Prediction markets use parimutuel pools: the final combined pool is paid pro-rata to backers of
  the winning outcome. Some markets auto-resolve from Bench Street data; others require an admin.
- Arena battles are two-sided parimutuel pools. The winner is a random draw weighted by the two
  models' latest Elo-derived win probability; the app does not currently run the models against
  prompts during settlement.

### Live data

The backend periodically attempts to ingest LMArena ratings, OpenRouter token prices, and
HuggingFace downloads. Missing sources fall back to the most recent stored values. The roster also
contains curated opening data and generated benchmark/effort-tier values, so every displayed metric
should not be assumed to come from a live provider.

## Stack

- **Client:** React 18, Vite, Tailwind CSS, Recharts, Socket.io client
- **Server:** Node.js, Express, better-sqlite3, Socket.io, JWT, bcrypt
- **Production:** Vercel frontend, Railway backend, Railway persistent volume for SQLite

## Quickstart

```bash
npm run install:all
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:4000`; Vite proxies `/api` and
`/socket.io` during local development. New accounts start with `$100,000` in virtual credits unless
`STARTING_BALANCE` is configured.

## Tests and build

```bash
npm test --prefix server
npm run build --prefix client
```

Pull requests also run server syntax checks, server tests, and a production client build in GitHub
Actions.

## Seeding and persistence

```bash
npm run seed
```

The seed command idempotently upserts the current roster and starter markets. It is **not** a full
account/economy reset. For a genuinely fresh local database, stop the server and remove the local
SQLite file under `server/data/` before starting again. Never delete the production volume merely
to refresh roster data.

## Repository map

```text
server/src/
  db.js             schema and additive migrations
  seed.js           roster, opening data, markets, and starter battles
  pricing.js        vote-price recomputation, candles, and daily close
  ingest.js         external signal refresh and freshness tracking
  resolver.js       automatic prediction resolution
  battles.js        Arena generation and settlement
  routes/           auth, models, trading, portfolio, markets, Arena, leaderboard, admin

client/src/
  pages/            Floor, ModelDetail, Portfolio, Predictions, Arena, Leaderboard, Login
  components/       navigation, market stats, charts, voting, comments, benchmarks
  store/            authentication and live Socket.io prices
```
