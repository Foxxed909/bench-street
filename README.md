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
1. **Fundamental value** — each model's "fair price" = weighted, normalized blend of its
   signals (`ELO 40% · usage 30% · benchmarks 20% · downloads+price 10%`), mapped to a
   $10–$1000 band. See `server/src/pricing.js`.
2. **Demand** — every buy/sell nudges a decaying demand term; the tick target becomes
   `fundamental × (1 + demand)`, so player flow moves the price.
3. **Live ticks** — every ~4s the price mean-reverts toward that target plus a volatility
   shock, and broadcasts over Socket.io. 1-minute OHLC candles are persisted for charts.

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
