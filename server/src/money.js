// Shared numeric parsing and cent-allocation helpers for every money/share write path.
// JavaScript cheerfully accepts Infinity and microscopic float dust; SQLite then stores
// the consequences without judgment, so the boundary has to be explicit here.
export const MAX_TRANSACTION_VALUE = 1_000_000_000
export const MAX_SHARE_QUANTITY = 1_000_000_000

const MONEY_SCALE = 100
const SHARE_SCALE = 1_000_000
const FLOAT_TOLERANCE = 1e-7

function numericInput(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseScaledPositive(value, { scale, max }) {
  const parsed = numericInput(value)
  if (parsed == null || parsed <= 0 || parsed > max) return null

  const units = Math.round(parsed * scale)
  if (!Number.isSafeInteger(units) || units < 1) return null
  // Reject hidden rounding. Inputs may have at most the precision represented by
  // `scale` (2 decimal places for money, 6 for fractional shares).
  if (Math.abs(parsed * scale - units) > FLOAT_TOLERANCE) return null
  return units / scale
}

export function parsePositiveMoney(value, { max = MAX_TRANSACTION_VALUE } = {}) {
  return parseScaledPositive(value, { scale: MONEY_SCALE, max })
}

export function parsePositiveShares(value, { max = MAX_SHARE_QUANTITY } = {}) {
  return parseScaledPositive(value, { scale: SHARE_SCALE, max })
}

// Trades settle to cents. Reject a quantity that would round to a free $0.00 trade,
// overflow safe integer cents, or exceed the configured transaction cap.
export function calculateTradeTotal(shares, price, { max = MAX_TRANSACTION_VALUE } = {}) {
  const qty = Number(shares)
  const quote = Number(price)
  if (!Number.isFinite(qty) || !Number.isFinite(quote) || qty <= 0 || quote <= 0) return null

  const raw = qty * quote
  if (!Number.isFinite(raw) || raw > max) return null
  const cents = Math.round((raw + Number.EPSILON) * MONEY_SCALE)
  if (!Number.isSafeInteger(cents) || cents < 1) return null
  return cents / MONEY_SCALE
}

function storedCents(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  const cents = Math.round((parsed + Number.EPSILON) * MONEY_SCALE)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : 0
}

// Preserve the existing seeded-liquidity economics while making cent rounding exact.
// The aggregate user payout remains:
//   totalPool × (actual winning user stake / displayed winning pool)
// That target is then split by largest remainder so individual rounding cannot create
// or destroy pennies. `positions` should contain only actual winning user positions.
export function allocateParimutuelPayouts(totalPool, winningPool, positions = []) {
  const payouts = new Map(positions.map((position) => [position.id, 0]))
  const totalCents = storedCents(totalPool)
  const winningPoolCents = storedCents(winningPool)
  if (!totalCents || !winningPoolCents || positions.length === 0) return payouts

  const weighted = positions
    .map((position, index) => ({
      id: position.id,
      index,
      stakeCents: storedCents(position.stake)
    }))
    .filter((position) => position.stakeCents > 0)
  const actualWinningStake = weighted.reduce((sum, position) => sum + position.stakeCents, 0)
  if (!actualWinningStake) return payouts

  const targetCents = Math.max(
    0,
    Math.min(totalCents, Math.round((totalCents * actualWinningStake) / winningPoolCents))
  )
  const rows = weighted.map((position) => {
    const raw = (targetCents * position.stakeCents) / actualWinningStake
    const floor = Math.floor(raw)
    return { ...position, cents: floor, remainder: raw - floor }
  })

  let pennies = targetCents - rows.reduce((sum, row) => sum + row.cents, 0)
  rows.sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let i = 0; i < pennies; i++) rows[i].cents += 1

  for (const row of rows) payouts.set(row.id, row.cents / MONEY_SCALE)
  return payouts
}
