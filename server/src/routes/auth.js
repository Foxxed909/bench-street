import { Router } from 'express'
import db from '../db.js'
import {
  verifyLogin,
  signToken,
  generateRefreshToken,
  hashPassword,
  publicUser,
  optionalAuth
} from '../auth.js'

const router = Router()

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateLogin({ username, password }) {
  const u = String(username || '').trim()
  if (!u || typeof password !== 'string' || !password) {
    return { error: 'username and password required' }
  }
  if (u.length > 20 || password.length > 200) return { error: 'invalid credentials' }
  return { username: u, password }
}

// Login endpoint - only login, no signup
router.post('/login', (req, res) => {
  const v = validateLogin(req.body || {})
  if (v.error) return res.status(400).json({ error: v.error })

  try {
    const user = verifyLogin(v)
    if (!user) return res.status(401).json({ error: 'invalid credentials' })
    const refreshToken = generateRefreshToken()
    const refreshTokenHash = hashPassword(refreshToken)
    db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?')
      .run(refreshTokenHash, user.id)
    res.json({ token: signToken(user), refreshToken, user: publicUser(user) })
  } catch (e) {
    console.error('[auth] login failed:', e)
    res.status(500).json({ error: 'could not sign in' })
  }
})

// Refresh token endpoint
router.post('/refresh', (req, res) => {
  const refreshToken = req.body.refreshToken
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' })
  }
  
  try {
    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
      return res.status(401).json({ error: 'Invalid refresh token' })
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId)
    if (!user || !user.refresh_token_hash) {
      return res.status(401).json({ error: 'User not found or no refresh token' })
    }
    
    const tokenHash = hashPassword(refreshToken)
    if (tokenHash !== user.refresh_token_hash) {
      return res.status(401).json({ error: 'Invalid refresh token' })
    }
    
    const newAccessToken = signToken(user)
    const newRefreshToken = generateRefreshToken()
    const newRefreshTokenHash = hashPassword(newRefreshToken)
    
    db.prepare('UPDATE users SET refresh_token_hash = ? WHERE id = ?')
      .run(newRefreshTokenHash, user.id)
    
    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: publicUser(user)
    })
  } catch (e) {
    console.error('[auth] refresh failed:', e)
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// Returns the current user, or { user: null } when the token is missing/stale —
// a 200 either way so an expired token doesn't spam the console with a 401.
router.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

export default router
