// Enhanced rate limiter with sliding window and IP-based tracking
// Uses token bucket algorithm for more accurate rate limiting
const buckets = new Map()

// Rate limit configurations for different endpoints
export const RATE_LIMITS = {
  api: { windowMs: 60000, max: 300, key: 'api' },
  auth: { windowMs: 15 * 60000, max: 60, key: 'auth' },
  vote: { windowMs: 60000, max: 10, key: 'vote' },
  trade: { windowMs: 60000, max: 20, key: 'trade' },
  comment: { windowMs: 60000, max: 15, key: 'comment' }
}

// Sliding window rate limiter
export function rateLimit({ windowMs = 60000, max = 120, key = 'global', skipFailed = false } = {}) {
  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress
    const id = `${key}:${clientIp}`
    const now = Date.now()
    
    let b = buckets.get(id)
    if (!b || now >= b.reset) {
      b = { count: 0, reset: now + windowMs, lastRequest: now }
      buckets.set(id, b)
    }
    
    const elapsed = now - b.lastRequest
    const decayFactor = Math.min(1, elapsed / (windowMs / max))
    b.count = Math.max(0, b.count - decayFactor)
    b.lastRequest = now
    
    b.count++
    
    res.set('X-RateLimit-Limit', String(max))
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - b.count)))
    res.set('X-RateLimit-Reset', String(Math.ceil((b.reset - now) / 1000)))
    
    if (b.count > max) {
      const retry = Math.max(1, Math.ceil((b.reset - now) / 1000))
      res.set('Retry-After', String(retry))
      
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[rate-limit] IP ${clientIp} exceeded ${max} requests for ${key}`)
      }
      
      return res.status(429).json({ 
        error: `Too many requests — slow down and retry in ${retry}s.`,
        retryAfter: retry
      })
    }
    
    next()
  }
}

// Sweep expired buckets so the map can't grow unbounded
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [id, b] of buckets) {
    if (now >= b.reset) {
      buckets.delete(id)
    }
  }
}, 5 * 60000)
sweep.unref?.()

// Get current rate limit status for monitoring
export function getRateLimitStatus() {
  return {
    activeBuckets: buckets.size,
    configurations: RATE_LIMITS
  }
}
