import { Router } from 'express'
import db from '../db.js'
import {
  createUser,
  verifyLogin,
  signToken,
  publicUser,
  optionalAuth
} from '../auth.js'

const router = Router()

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Validate + normalize signup input. Returns { username, email } or { error }.
function validateSignup({ username, email, password }) {
  const u = String(username || '').trim()
  if (!u || !password) return { error: 'username and password required' }
  if (u.length < 3 || u.length > 20) return { error: 'username must be 3–20 characters' }
  if (!USERNAME_RE.test(u)) {
    return { error: 'username may only use letters, numbers, underscore and hyphen' }
  }
  const pw = String(password)
  if (pw.length < 6) return { error: 'password must be at least 6 characters' }
  if (pw.length > 200) return { error: 'password is too long' }
  const e = String(email || '').trim()
  if (e && (e.length > 254 || !EMAIL_RE.test(e))) return { error: 'enter a valid email address' }
  return { username: u, email: e || null }
}

router.post('/signup', (req, res) => {
  const v = validateSignup(req.body || {})
  if (v.error) return res.status(400).json({ error: v.error })

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
    .get(v.username)
  if (existing) return res.status(409).json({ error: 'username already taken' })

  const user = createUser({ username: v.username, email: v.email, password: req.body.password })
  res.json({ token: signToken(user), user: publicUser(user) })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = verifyLogin({ username, password })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  res.json({ token: signToken(user), user: publicUser(user) })
})

// Returns the current user, or { user: null } when the token is missing/stale —
// a 200 either way so an expired token doesn't spam the console with a 401.
router.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

export default router
