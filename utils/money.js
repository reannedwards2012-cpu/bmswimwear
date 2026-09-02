const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Format a USD amount (in dollars) e.g. 66 -> "$66.00". */
export const formatUsd = (amount) => usd.format(amount)
