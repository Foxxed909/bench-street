// Minimal dependency-free rate limiter (fixed-window, in-memory). Per-instance —
// perfectly fine for a single Railway dyno; swap in a shared store (Redis) only if
// we ever run multiple instances. Keyed by client IP + a per-limiter label.
const buckets = new Map()

export function rateLimit({ windowMs = 60000, max = 120, key = 'global' } = {}) {
  return (req, res, next) => {
    const id = `${key}:${req.ip}`
    const now = Date.now()
    let b = buckets.get(id)
    if (!b || now >= b.reset) {
      b = { count: 0, reset: now + windowMs }
      buckets.set(id, b)
    }
    b.count++
    if (b.count > max) {
      const retry = Math.max(1, Math.ceil((b.reset - now) / 1000))
      res.set('Retry-After', String(retry))
      return res.status(429).json({ error: `Too many requests — slow down and retry in ${retry}s.` })
    }
    next()
  }
}

// Sweep expired buckets so the map can't grow unbounded. unref() so this timer
// never keeps the process alive on shutdown.
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [id, b] of buckets) if (now >= b.reset) buckets.delete(id)
}, 5 * 60000)
sweep.unref?.()
