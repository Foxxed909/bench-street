# 📈 Bench Street

A play-money exchange where you trade **real AI models like stocks**. Prices are driven
by a weighted index of real performance signals (LMArena ELO, OpenRouter usage,
benchmarks, downloads, API price) plus live **player demand** — when traders pile into a
model, its price climbs above fundamental; when they sell, it sinks. There's also a
parimutuel **prediction market** for betting on AI events.

> Play money only. Prices are simulated. Not investment advice.

## Stack
- **Client:** React 18 · Vite · Tailwind · Recharts · socket.io-client
- **Server:** Node · Express · better-sqlite3 · Socket.io · JWT

## Quickstart
```bash
npm run install:all     # install root + server + client deps
npm run dev             # server on :4000, client on :5173 (Vite proxies /api + /socket.io)
```
Then open http://localhost:5173 and create an account — you start with $100,000 in credits.

To reseed the database from scratch:
```bash
npm run seed
```

## How pricing works
1. **Fundamental value** — a model is worth its token economics times its quality:
   `fundamental = blended API price ($/Mtok) × quality(ELO) × multiplier`, clamped to a
   $10–$2500 band. API price is live from OpenRouter; the quality factor scales ~0.5×
   (weak) to 2.0× (frontier) off the live LMArena ELO. See `server/src/pricing.js`.
2. **Votes** — each community vote adds a flat amount (`VOTE_RATE`, $5) to a model's tick
   target on top of its fundamental, so crowd conviction lifts the price.
3. **Live ticks** — every ~4s the price mean-reverts toward `fundamental + votes × rate`
   plus a volatility shock, and broadcasts over Socket.io. 1-minute OHLC candles are
   persisted for charts.

## Layout
```
server/src/
  db.js         schema + migrations
  seed.js       ~22-model roster + starter prediction markets
  pricing.js    fundamental index + demand + tick loop
  auth.js       JWT + bcrypt
  routes/       auth · models · trade · portfolio · markets · leaderboard
client/src/
  pages/        Floor · ModelDetail · Portfolio · Predictions · Leaderboard · Login
  components/    Nav · TickerTape · MarketStats · FlashNum · FlowBar · Sparkline
  store/        auth · prices (Socket.io context)
```
