import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import { Server } from 'socket.io'

import db from './db.js'
import { seedDatabase } from './seed.js'
import { startPricing } from './pricing.js'
import { startSignalCron } from './ingest.js'
import { startBattleSettler } from './battles.js'
import { startAutoResolver } from './resolver.js'

import authRoutes from './routes/auth.js'
import modelRoutes from './routes/models.js'
import tradeRoutes from './routes/trade.js'
import portfolioRoutes from './routes/portfolio.js'
import marketRoutes from './routes/markets.js'
import battleRoutes from './routes/battles.js'
import leaderboardRoutes from './routes/leaderboard.js'
import adminRoutes from './routes/admin.js'

const PORT = Number(process.env.PORT || 4000)
// CLIENT_ORIGIN: comma-separated allowlist, or '*' to reflect any origin (handy for a
// play-money demo — auth is a Bearer token, not cookies). Defaults to '*' in production.
const RAW_ORIGIN =
  process.env.CLIENT_ORIGIN || (process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:5173')
const ORIGIN = RAW_ORIGIN === '*' ? true : RAW_ORIGIN.split(',').map((s) => s.trim())

const seedResult = seedDatabase()
console.log('[seed]', seedResult)

const app = express()
app.use(cors({ origin: ORIGIN }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }))
app.use('/api/auth', authRoutes)
app.use('/api/models', modelRoutes)
app.use('/api/trade', tradeRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/markets', marketRoutes)
app.use('/api/battles', battleRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/admin', adminRoutes)

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: ORIGIN } })

io.on('connection', (socket) => {
  const models = db
    .prepare('SELECT id, slug, ticker, price, prev_close, vote_count AS votes FROM models')
    .all()
  socket.emit('snapshot', { t: Date.now(), models })
})

startPricing(io)
startSignalCron({ intervalMin: 10 })
startBattleSettler({ io })
startAutoResolver({ io })

server.listen(PORT, () => {
  console.log(`Bench Street API → http://localhost:${PORT}`)
})
