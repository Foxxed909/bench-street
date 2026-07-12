export const MAX_MONEY_AMOUNT = 1_000_000_000
export const MAX_SHARE_QUANTITY = 1_000_000_000

const MONEY_SCALE = 100
const SHARE_SCALE = 1_000_000
const FLOAT_TOLERANCE = 1e-7

// Parse a play-money amount stored to cents. Reject NaN/Infinity, sub-cent values,
// more than two decimal places, and absurdly large payloads before they reach SQLite.
export function parsePositiveMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0.01 || amount > MAX_MONEY_AMOUNT) return null

  const cents = Math.round(amount * MONEY_SCALE)
  if (!Number.isSafeInteger(cents)) return null
  if (Math.abs(amount * MONEY_SCALE - cents) > FLOAT_TOLERANCE) return null
  return cents / MONEY_SCALE
}

// Shares may be fractional, but cap them at six decimal places. This preserves the
// existing fractional-share API while preventing dust values and floating-point junk.
export function parsePositiveShares(value) {
  const shares = Number(value)
  if (!Number.isFinite(shares) || shares <= 0 || shares > MAX_SHARE_QUANTITY) return null

  const units = Math.round(shares * SHARE_SCALE)
  if (!Number.isSafeInteger(units) || units <= 0) return null
  if (Math.abs(shares * SHARE_SCALE - units) > FLOAT_TOLERANCE) return null
  return units / SHARE_SCALE
}

// Trades settle to cents. Returning null for a rounded-zero total closes the old
// exploit where a tiny positive quantity could add shares while charging $0.00.
export function calculateTradeTotal(shares, price) {
  if (!Number.isFinite(shares) || !Number.isFinite(price) || shares <= 0 || price <= 0) {
    return null
  }
  const cents = Math.round((shares * price + Number.EPSILON) * MONEY_SCALE)
  if (!Number.isSafeInteger(cents) || cents < 1) return null
  return cents / MONEY_SCALE
}
