export const money = (n) =>
  n == null
    ? '—'
    : Number(n).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2
      })

export const num = (n, d = 2) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d })

export const pct = (n) => `${n >= 0 ? '+' : ''}${Number(n || 0).toFixed(2)}%`

export const compact = (n) =>
  n == null
    ? '—'
    : Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export const upDown = (n) => (n >= 0 ? 'text-up' : 'text-down')

// A model counts as "new" for ~45 days after its release date.
const NEW_WINDOW_MS = 45 * 864e5
export function isNew(releasedAt) {
  if (!releasedAt) return false
  return Date.now() - new Date(releasedAt).getTime() < NEW_WINDOW_MS
}

// Reasoning-effort tier display. Same model, different compute: more effort = pricier
// per task and a stronger benchmark profile. `null` for non-reasoning models.
export const EFFORT_ORDER = { low: 0, medium: 1, high: 2 }
const EFFORT_LABELS = { low: 'low', medium: 'med', high: 'high' }
export function effortLabel(e) {
  return e ? EFFORT_LABELS[e] || e : null
}

// Short release-date label, e.g. "Jun 9, 2026".
export function releaseLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ago(iso) {
  if (!iso) return '—'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function until(iso) {
  if (!iso) return ''
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  if (s <= 0) return 'closing…'
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
