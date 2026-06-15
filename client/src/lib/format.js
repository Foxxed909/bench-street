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

// Reasoning-effort tier suffixes shown as a badge on variant models.
const TIER_WORDS = ['low', 'medium', 'high', 'xhigh', 'max']
export function splitTier(name) {
  if (!name) return { base: name, tier: null }
  const parts = name.split(' ')
  const last = parts[parts.length - 1]?.toLowerCase()
  if (TIER_WORDS.includes(last)) {
    return { base: parts.slice(0, -1).join(' '), tier: last }
  }
  return { base: name, tier: null }
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
