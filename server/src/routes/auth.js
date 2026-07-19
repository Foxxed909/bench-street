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

// Validate + normalize signup input. Returns { username, email, password } or { error }.
function validateSignup({ username, email, password }) {
  const u = String(username || '').trim()
  if (!u || typeof password !== 'string' || !password) {
    return { error: 'username and password required' }
  }
  if (u.length < 3 || u.length > 20) return { error: 'username must be 3–20 characters' }
  if (!USERNAME_RE.test(u)) {
    return { error: 'username may only use letters, numbers, underscore and hyphen' }
  }
  if (password.length < 6) return { error: 'password must be at least 6 characters' }
  if (password.length > 200) return { error: 'password is too long' }
  const e = String(email || '').trim().toLowerCase()
  if (e && (e.length > 254 || !EMAIL_RE.test(e))) return { error: 'enter a valid email address' }
  return { username: u, email: e || null, password }
}

function validateLogin({ username, password }) {
  const u = String(username || '').trim()
  if (!u || typeof password !== 'string' || !password) {
    return { error: 'username and password required' }
  }
  if (u.length > 20 || password.length > 200) return { error: 'invalid credentials' }
  return { username: u, password }
}

router.post('/signup', (req, res) => {
  const v = validateSignup(req.body || {})
  if (v.error) return res.status(400).json({ error: v.error })

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
    .get(v.username)
  if (existing) return res.status(409).json({ error: 'username already taken' })

  if (v.email) {
    const emailOwner = db
      .prepare('SELECT id FROM users WHERE email IS NOT NULL AND LOWER(email) = LOWER(?)')
      .get(v.email)
    if (emailOwner) return res.status(409).json({ error: 'email already in use' })
  }

  try {
    const user = createUser(v)
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (e) {
    if (String(e?.code || '').startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'username or email already in use' })
    }
    console.error('[auth] signup failed:', e)
    return res.status(500).json({ error: 'could not create account' })
  }
})

router.post('/login', (req, res) => {
  const v = validateLogin(req.body || {})
  if (v.error) return res.status(400).json({ error: v.error })

  try {
    const user = verifyLogin(v)
    if (!user) return res.status(401).json({ error: 'invalid credentials' })
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (e) {
    console.error('[auth] login failed:', e)
    res.status(500).json({ error: 'could not sign in' })
  }
})

// Returns the current user, or { user: null } when the token is missing/stale —
// a 200 either way so an expired token doesn't spam the console with a 401.
router.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

export default router
