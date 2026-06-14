# Bench Street — Tech Stack & Skills

## Frontend
- React 18 (Vite 6)
- Tailwind CSS 3 (custom theme: ink/panel/edge palette, Inter + JetBrains Mono)
- Recharts (area price charts)
- socket.io-client (live prices)
- react-router-dom 6
- lucide-react (icons)
- Custom CSS: marquee ticker, price-flash keyframes, fade-up

## Backend
- Node (ESM) + Express 4
- better-sqlite3 (synchronous SQLite, WAL)
- Socket.io (price broadcast)
- jsonwebtoken + bcryptjs (auth)
- nodemon (dev), concurrently (run both)

## Concepts applied
- Mean-reverting stochastic price simulation (Ornstein–Uhlenbeck-style drift + Gaussian shock)
- Signal normalization + weighted indexing → "fundamental value"
- Demand/flow pressure model (decaying, capped) driving price away from fundamental
- Live data ingestion from public APIs (OpenRouter pricing, HuggingFace downloads) with
  graceful degradation + scheduled refresh cron
- Parimutuel markets: pooled odds, pro-rata payouts, admin + auto resolution
- Elo win-probability model for head-to-head settlement
- OHLC candle aggregation
- WebSocket fan-out with React context for live state
- JWT auth + role-based admin guard
- Motion design: rAF number easing, CSS keyframe flashes/pulses, staggered entrances
