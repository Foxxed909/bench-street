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
1. **Live from zero** — every model launches at **$0** and only gains value as people vote.
   No pre-seeded prices, no simulation, no fabricated volatility.
2. **Price = votes × per-vote value** — each vote is worth a `$5` base scaled ×0.5–2.0 by the
   model's blended API price (`costFactor = clamp(0.5, 2, $/Mtok ÷ 5)`). A vote on a pricey
   frontier model moves it more than a vote on a cheap one. See `server/src/pricing.js`.
3. **Event-driven** — voting recomputes the model's price, persists a candle, and broadcasts it
   over Socket.io instantly. Token-price refreshes (every ~10 min) also re-price and rebroadcast.
   Trading is disabled until a model has a price.

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
