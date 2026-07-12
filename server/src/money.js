// Shared numeric parsing for all money/share write paths. Number('Infinity') and
// absurdly precise fractions previously passed the simple `> 0` checks and could
// corrupt balances, pools, holdings, and JSON responses.
export const MAX_TRANSACTION_VALUE = 1_000_000_000
export const MAX_SHARE_QUANTITY = 1_000_000_000

function numericInput(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parsePositiveMoney(value, { max = MAX_TRANSACTION_VALUE } = {}) {
  const parsed = numericInput(value)
  if (parsed == null || parsed <= 0 || parsed > max) return null
  const cents = Math.round((parsed + Number.EPSILON) * 100)
  if (cents < 1) return null
  return cents / 100
}

// Fractional shares are intentionally supported, but normalized to six decimal
// places so microscopic floating-point dust cannot accumulate forever.
export function parsePositiveShares(value, { max = MAX_SHARE_QUANTITY } = {}) {
  const parsed = numericInput(value)
  if (parsed == null || parsed <= 0 || parsed > max) return null
  const rounded = Number(parsed.toFixed(6))
  return rounded > 0 ? rounded : null
}
