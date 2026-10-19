const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Format a USD amount (in dollars) e.g. 66 -> "$66.00". */
export const formatUsd = (amount) => usd.format(amount)

/**
 * Format an integer-cents amount in its own currency. No conversion — the
 * caller passes the cents value for the currency it belongs to.
 *   formatMoney(6600, 'USD') -> "$66.00"
 *   formatMoney(18000, 'XCD') -> "XCD $180.00"
 *   formatMoney(null, 'USD')  -> "—"
 */
export const formatMoney = (cents, currency = 'USD') => {
  if (cents == null || !Number.isFinite(Number(cents))) return '—'
  const amount = Number(cents) / 100
  return currency === 'XCD' ? `XCD $${amount.toFixed(2)}` : usd.format(amount)
}

/**
 * US$1 = EC$2.70 ⇒ usdCents = xcdCents * 10 / 27 (integer, bankers-safe).
 * Client-safe mirror of server/utils/shipping.js's xcdCentsToUsdCents — kept
 * as a separate copy (not imported) since `server/` isn't in the client
 * bundle; same fixed rate, same rounding, used for display only. The
 * server independently recalculates and verifies this amount — the client
 * copy is never trusted for the actual charge.
 */
export const xcdCentsToUsdCents = (xcdCents) => Math.round(((Number(xcdCents) || 0) * 10) / 27)
