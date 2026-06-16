import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import db from './db.js'
import { JWT_SECRET, STARTING_BALANCE, isAdminUsername } from './config.js'

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10)
}

export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '30d'
  })
}

export function createUser({ username, email, password }) {
  const now = new Date().toISOString()
  // Admin is granted ONLY to names on the configured allowlist — never by signup
  // order, so a stranger registering first on a fresh DB can't seize the panel.
  const isAdmin = isAdminUsername(username) ? 1 : 0
  const info = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, cash, is_admin, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(username, email || null, hashPassword(password), STARTING_BALANCE, isAdmin, now)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
}

export function verifyLogin({ username, password }) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user) return null
  return bcrypt.compareSync(password, user.password_hash) ? user : null
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    cash: user.cash,
    isAdmin: !!user.is_admin
  }
}

// Express middleware: require a valid Bearer token.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id)
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Optional auth: attach req.user if a valid token is present, but never block.
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id)
      if (user) req.user = user
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next()
}

// Require an authenticated admin.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin only' })
    next()
  })
}

export { STARTING_BALANCE }
