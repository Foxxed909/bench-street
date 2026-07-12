import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'node:http'
import { Server } from 'socket.io'

import db from './db.js'
import { rateLimit } from './ratelimit.js'
import { seedDatabase } from './seed.js'
import { reconcileAdminFlags } from './admins.js'
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
console.log('[admins]', reconcileAdminFlags())

const app = express()
// Behind Railway's proxy: trust the first hop so req.ip reflects the real client
// (X-Forwarded-For) — without this the rate limiter would bucket everyone together.
app.set('trust proxy', 1)
app.use(cors({ origin: ORIGIN }))
app.use(express.json({ limit: '100kb' }))

// Broad abuse cap on the whole API, plus a tight limit on auth (brute-force / spam).
app.use('/api', rateLimit({ windowMs: 60_000, max: 300, key: 'api' }))

app.get('/api/health', (req, res) => {
  const models = db.prepare('SELECT COUNT(*) AS n FROM models').get().n
  const latestSignal = db.prepare('SELECT MAX(captured_at) AS at FROM model_signals').get().at
  res.json({ ok: true, ts: Date.now(), models, latestSignal })
})
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 60, key: 'auth' }), authRoutes)
app.use('/api/models', modelRoutes)
app.use('/api/trade', tradeRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/markets', marketRoutes)
app.use('/api/battles', battleRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/admin', adminRoutes)

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: ORIGIN } })
// Make io reachable from routes (e.g. votes and bets broadcast live changes).
app.set('io', io)

const snapshotStmt = db.prepare(
  `SELECT id, slug, ticker, price, prev_close,
          like_count AS likes, dislike_count AS dislikes
     FROM models`
)
io.on('connection', (socket) => {
  // Emit once on connect, and again whenever the client asks. The client requests
  // a snapshot on (re)connect so it can never miss the opening board to a race
  // between the socket handshake and its React listener mounting.
  const sendSnapshot = () => socket.emit('snapshot', { t: Date.now(), models: snapshotStmt.all() })
  sendSnapshot()
  socket.on('request-snapshot', sendSnapshot)
})

const stopBackgroundJobs = [
  startPricing(io),
  startSignalCron({ intervalMin: 10, io }),
  startBattleSettler({ io }),
  startAutoResolver({ io })
]

server.listen(PORT, () => {
  console.log(`Bench Street API → http://localhost:${PORT}`)
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] ${signal} received`)

  for (const stop of stopBackgroundJobs) {
    try {
      stop?.()
    } catch (error) {
      console.error('[shutdown] background job cleanup failed:', error)
    }
  }

  // WebSockets otherwise keep the HTTP server open indefinitely during a Railway
  // deploy. Disconnect them first, then checkpoint and close SQLite after HTTP drains.
  io.disconnectSockets(true)
  const force = setTimeout(() => {
    console.error('[shutdown] timed out; forcing exit')
    process.exit(1)
  }, 10_000)
  force.unref?.()

  server.close((error) => {
    clearTimeout(force)
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      db.close()
    } catch (dbError) {
      console.error('[shutdown] database close failed:', dbError)
      error ||= dbError
    }
    if (error) console.error('[shutdown] server close failed:', error)
    process.exit(error ? 1 : 0)
  })
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
