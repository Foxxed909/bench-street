import crypto from 'node:crypto'

// In-memory store for CSRF tokens (use Redis in production for multi-instance)
const csrfTokens = new Map()

// CSRF token configuration
export const CSRF_TOKEN_LENGTH = 32
export const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000  // 24 hours

// Generate a new CSRF token
export function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

// Store a CSRF token for a user session
export function storeCsrfToken(sessionId, token) {
  csrfTokens.set(sessionId, {
    token,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY_MS
  })
}

// Validate a CSRF token
export function validateCsrfToken(sessionId, token) {
  const stored = csrfTokens.get(sessionId)
  if (!stored) return false
  
  // Check if token is expired
  if (Date.now() > stored.expiresAt) {
    csrfTokens.delete(sessionId)
    return false
  }
  
  // Check if token matches
  return stored.token === token
}

// Middleware to require CSRF token for state-changing requests
export function csrfProtection(req, res, next) {
  // Skip for safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }
  
  // Skip for API routes that don't require CSRF
  if (req.path.startsWith('/api/health')) {
    return next()
  }
  
  // Get CSRF token from header or form body
  const csrfToken = req.headers['x-csrf-token'] || req.body._csrf
  const sessionId = req.headers['x-session-id'] || req.ip
  
  if (!csrfToken) {
    return res.status(403).json({ error: 'CSRF token missing' })
  }
  
  if (!validateCsrfToken(sessionId, csrfToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token' })
  }
  
  // Token is valid, consume it (one-time use)
  csrfTokens.delete(sessionId)
  next()
}

// Middleware to generate and send CSRF token
export function csrfTokenMiddleware(req, res, next) {
  // Only generate for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const sessionId = req.headers['x-session-id'] || req.ip
    const token = generateCsrfToken()
    storeCsrfToken(sessionId, token)
    res.locals.csrfToken = token
  }
  next()
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, data] of csrfTokens) {
    if (now > data.expiresAt) {
      csrfTokens.delete(sessionId)
    }
  }
}, 60 * 60 * 1000)  // Cleanup every hour
