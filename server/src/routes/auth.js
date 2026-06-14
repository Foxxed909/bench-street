import { Router } from 'express'
import db from '../db.js'
import {
  createUser,
  verifyLogin,
  signToken,
  publicUser,
  requireAuth
} from '../auth.js'

const router = Router()

router.post('/signup', (req, res) => {
  const { username, email, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' })
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' })
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return res.status(409).json({ error: 'username already taken' })

  const user = createUser({ username, email, password })
  res.json({ token: signToken(user), user: publicUser(user) })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = verifyLogin({ username, password })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  res.json({ token: signToken(user), user: publicUser(user) })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

export default router
