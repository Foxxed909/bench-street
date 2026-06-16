import { Router } from 'express'
import { requireAdmin } from '../auth.js'
import { ingestSignals, signalsStatus } from '../ingest.js'

const router = Router()

// Public: signal freshness (for the "live · updated Xm ago" badge).
router.get('/signals', (req, res) => res.json(signalsStatus()))

// Admin: pull live signals right now. Pass io so the refreshed prices broadcast
// live to every connected client instead of going stale until the next cron tick.
router.post('/refresh-signals', requireAdmin, async (req, res) => {
  try {
    const result = await ingestSignals({ io: req.app.get('io') })
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
