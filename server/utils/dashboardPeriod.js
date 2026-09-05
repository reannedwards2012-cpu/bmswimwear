/**
 * Calendar-boundary date ranges shared by the admin dashboard
 * (server/api/admin/dashboard.get.js, which ranges by `paid_at`) and the
 * admin orders list (server/api/admin/orders/index.get.js, which ranges by
 * `created_at`) — this module only computes boundaries, it has no opinion on
 * which timestamp column a caller applies them to.
 *
 * Timezone approach: the storefront has one home market — Grenada (the
 * Go2Pay integration is go2pay.gd) — which observes Atlantic Standard Time
 * (UTC-4) year-round with no daylight saving. That makes a full IANA
 * timezone database unnecessary here: a fixed UTC-4 offset is accurate for
 * this business every day of the year, and far simpler than pulling in a
 * timezone library for one endpoint. If the business ever spans multiple
 * timezones, BUSINESS_UTC_OFFSET_MINUTES is the one constant to revisit.
 *
 * "Week" is Monday–Sunday (the common business-week convention).
 */
const BUSINESS_UTC_OFFSET_MINUTES = -4 * 60 // Grenada, Atlantic Standard Time — fixed, no DST

const DAY_MS = 24 * 60 * 60 * 1000

// Shift a real UTC instant so its UTC-getters (getUTCFullYear/Month/Date/Day)
// read as business-local calendar fields — the standard trick for a fixed
// (non-DST) offset without a timezone database.
function toBusinessLocal(utcDate) {
  return new Date(utcDate.getTime() + BUSINESS_UTC_OFFSET_MINUTES * 60000)
}
// Inverse: a "local-shifted" Date (as produced above, or built directly with
// Date.UTC from local calendar fields) back to the real UTC instant.
function toUtc(localShiftedDate) {
  return new Date(localShiftedDate.getTime() - BUSINESS_UTC_OFFSET_MINUTES * 60000)
}

export const PERIODS = ['week', 'month', 'year']

/**
 * `{ start, end }` — real UTC Date instants marking the calendar boundary
 * for `period`, evaluated in business-local time. `end` is exclusive (the
 * instant the next period begins), so callers filter with
 * `created_at >= start AND created_at < end`.
 *
 * week  = Monday 00:00 through the following Monday 00:00, business-local.
 * month = the 1st of the current business-local month through the 1st of the next.
 * year  = Jan 1 through Jan 1 of the next business-local year.
 */
export function getPeriodRange(period, now = new Date()) {
  const local = toBusinessLocal(now)

  if (period === 'week') {
    const day = local.getUTCDay() // 0=Sun..6=Sat
    const sinceMonday = (day + 6) % 7
    const startLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday))
    const endLocal = new Date(startLocal.getTime() + 7 * DAY_MS)
    return { start: toUtc(startLocal), end: toUtc(endLocal) }
  }
  if (period === 'month') {
    const startLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1))
    const endLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1))
    return { start: toUtc(startLocal), end: toUtc(endLocal) }
  }
  if (period === 'year') {
    const startLocal = new Date(Date.UTC(local.getUTCFullYear(), 0, 1))
    const endLocal = new Date(Date.UTC(local.getUTCFullYear() + 1, 0, 1))
    return { start: toUtc(startLocal), end: toUtc(endLocal) }
  }
  throw new Error(`Unknown period: ${period}`)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Pre-built, zero-filled trend buckets for `period`/`range` — every bucket
 * that should appear on the chart, in calendar order, before any real order
 * is added. Returns `{ buckets, keyFor }`: `buckets` is the scaffold to
 * accumulate onto, `keyFor(isoTimestamp)` maps a timestamp to the bucket key
 * it belongs in (business-local calendar day, or month for the year view).
 * Field-agnostic by design — the caller decides which timestamp column it
 * means (server/api/admin/dashboard.get.js feeds it each qualifying order's
 * `paid_at`, since that's the authoritative "this became a sale" moment, not
 * `created_at`). Building the scaffold up front — rather than only emitting
 * buckets that have data — is what keeps a zero-sales period rendering a
 * normal, gap-free (if flat) chart instead of an empty/broken one.
 *
 * week/month  -> one bucket per business-local calendar day.
 * year        -> one bucket per business-local calendar month.
 */
export function buildTrendBuckets(period, range) {
  if (period === 'year') {
    const year = toBusinessLocal(range.start).getUTCFullYear()
    const buckets = MONTH_LABELS.map((label, m) => ({
      key: `${year}-${String(m + 1).padStart(2, '0')}`,
      label,
      salesUsdCents: 0
    }))
    return {
      buckets,
      keyFor: (iso) => {
        const d = toBusinessLocal(new Date(iso))
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      }
    }
  }

  // week & month both group by business-local calendar day.
  const startLocal = toBusinessLocal(range.start)
  const endLocal = toBusinessLocal(range.end)
  const dayCount = Math.round((endLocal.getTime() - startLocal.getTime()) / DAY_MS)

  const buckets = []
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startLocal.getTime() + i * DAY_MS)
    const key = dayKey(d)
    const label = period === 'week' ? WEEKDAY_LABELS[d.getUTCDay()] : String(d.getUTCDate())
    buckets.push({ key, label, salesUsdCents: 0 })
  }
  return {
    buckets,
    keyFor: (iso) => dayKey(toBusinessLocal(new Date(iso)))
  }
}

function dayKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
