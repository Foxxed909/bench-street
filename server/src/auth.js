import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import db from './db.js'
import { JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY, JWT_REFRESH_SECRET, STARTING_BALANCE } from './config.js'

// Generate a secure random string for refresh tokens
export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex')
}

export function hashPassword(pw) {
  return bcrypt.hashSync(pw, 12)  // Increased from 10 to 12 for better security
}

export function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY  // Changed from 30d to 15m (configurable)
  })
}

export function signRefreshToken(userId) {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY
  })
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET)
  } catch {
    return null
  }
}

export function createUser({ username, email, password }) {
  const now = new Date().toISOString()
  const refreshToken = generateRefreshToken()
  const refreshTokenHash = hashPassword(refreshToken)
  // Public signup can never grant admin rights. Production admin flags are
  // reconciled from immutable configured user IDs at boot.
  const info = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, cash, is_admin, refresh_token_hash, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    )
    .run(username, email || null, hashPassword(password), STARTING_BALANCE, refreshTokenHash, now)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
}

export function verifyLogin({ username, password }) {
  const normalized = String(username || '').trim()
  if (!normalized || typeof password !== 'string') return null
  // Signup uniqueness is case-insensitive, so login must be too. Otherwise an account
  // created as "James" exists but mysteriously rejects "james".
  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(normalized)
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
  } catch (err) {
    // Handle expired tokens specially
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', expired: true })
    }
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

// Middleware to handle refresh tokens and issue new access tokens
export function refreshAuth(req, res, next) {
  const refreshToken = req.headers['x-refresh-token'] || req.body.refreshToken
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' })
  }
  
  const payload = verifyRefreshToken(refreshToken)
  if (!payload) {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
  
  // Verify the refresh token hash in the database
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId)
  if (!user || !user.refresh_token_hash) {
    return res.status(401).json({ error: 'User not found or no refresh token' })
  }
  
  // Verify the refresh token hash matches
  const tokenHash = hashPassword(refreshToken)
  if (tokenHash !== user.refresh_token_hash) {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
  
  // Issue new tokens
  const newAccessToken = signToken(user)
  const newRefreshToken = generateRefreshToken()
  const newRefreshTokenHash = hashPassword(newRefreshToken)
  
  // Update the refresh token in the database
  db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?')
    .run(newRefreshTokenHash, user.id)
  
  // Return new tokens
  res.json({
    token: newAccessToken,
    refreshToken: newRefreshToken,
    user: publicUser(user)
  })
}

// Require an authenticated admin.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin only' })
    next()
  })
}

export { STARTING_BALANCE }
