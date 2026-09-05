/**
 * Order status rules shared by the admin order endpoints.
 *
 * ORDER_STATUSES — every status value the `orders` table allows (used to
 * validate a ?status= filter).
 *
 * SALES_QUALIFYING_STATUSES — a confirmed sale, for the Overview dashboard.
 * Excludes 'pending' / 'payment_failed' / 'cancelled'.
 *
 * ── Admin-editable transitions ────────────────────────────────────────────
 * Two maps, because website and manual orders have different payment
 * authority:
 *
 *  - WEBSITE orders: `pending → paid` is IMPOSSIBLE by hand. Only the Go2Pay
 *    callback (server/utils/go2payVerify.js) may mark a website order paid,
 *    tied to independent payment verification + `paid_at`. `pending` and
 *    `payment_failed` have no admin transitions at all — a pending website
 *    order is never cancelled by hand either (avoids the late-webhook race).
 *
 *  - MANUAL orders (source ∈ instagram/whatsapp/in_person/other): payment
 *    happened outside the website flow, so an admin MAY move `pending → paid`
 *    (which sets `paid_at` and, optionally, `payment_method`). A pending
 *    manual order may also be cancelled.
 *
 * 'completed' and 'cancelled' are terminal for both — no reopening.
 */
export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'completed', 'cancelled', 'payment_failed']

export const SALES_QUALIFYING_STATUSES = ['paid', 'processing', 'completed']

export const WEBSITE_STATUS_TRANSITIONS = {
  pending: [],
  payment_failed: [],
  paid: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

export const MANUAL_STATUS_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  payment_failed: [], // manual orders never enter this state, kept for completeness
  paid: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

/** Manual order = any non-website source. */
export const isManualSource = (source) => typeof source === 'string' && source !== '' && source !== 'website'

/**
 * Admin-editable target statuses for an order's current status, given its
 * source. The status.patch endpoint re-checks this server-side regardless of
 * what the UI offers.
 */
export function adminTransitionsFor(source, currentStatus) {
  const map = isManualSource(source) ? MANUAL_STATUS_TRANSITIONS : WEBSITE_STATUS_TRANSITIONS
  return map[currentStatus] ?? []
}

/**
 * ── Admin Order Management visibility ─────────────────────────────────────
 * `POST /api/checkout` creates a real `pending` website order row BEFORE the
 * customer is sent to Go2Pay — that row is load-bearing for payment
 * idempotency / callback correlation and must never be deleted or altered.
 * But an abandoned checkout attempt (customer bailed on the Go2Pay screen) is
 * not an "order" the shop owner should see, count, or search in Admin → Order
 * Management. So a website order is only admin-visible once it has moved past
 * the abandoned-checkout stage; a manual order is visible at every legitimate
 * status (including `pending`, which is a real unpaid order the owner is
 * working). This is enforced in the DB queries, not in Vue.
 *
 * `HIDDEN_WEBSITE_STATUSES` are hidden ONLY for `source = 'website'`.
 */
export const HIDDEN_WEBSITE_STATUSES = ['pending', 'payment_failed']

export const isAdminVisibleOrder = (source, status) =>
  isManualSource(source) || !HIDDEN_WEBSITE_STATUSES.includes(status)

/**
 * PostgREST `.or(...)` filter string for the abandoned-checkout rule only:
 * keep the row when it's a manual order OR its status is not one of the hidden
 * website statuses. (`source.neq.website` is false for a NULL source, but every
 * row has had a non-null `source` since the Manual Orders migration, so a
 * legacy website row can't slip through.)
 *
 * Used by the DETAIL endpoint (404 an abandoned checkout) and the status PATCH
 * guard — NOT by the list. It deliberately says nothing about `archived_at`:
 * an archived order's detail page must stay reachable.
 */
export const ADMIN_VISIBLE_ORDERS_OR_FILTER = `source.neq.website,status.not.in.(${HIDDEN_WEBSITE_STATUSES.join(
  ','
)})`

/**
 * ── Archive (website orders only) ────────────────────────────────────────
 * `orders.archived_at` is an admin organisation/presentation flag, completely
 * separate from `status`. Archiving a website order sets `archived_at = now()`;
 * restoring sets it back to `null`. Nothing else on the row is ever touched.
 * Manual orders are never archived (they're deleted instead) — the archive
 * endpoint rejects them.
 *
 * `ADMIN_ACTIVE_ORDERS_OR_FILTER` is the DEFAULT admin-list + dashboard
 * "recent orders" view: the abandoned-checkout rule AND, for website orders,
 * `archived_at IS NULL`. Manual orders are unaffected by archive, so the
 * `source.neq.website` branch still passes them through regardless.
 *
 * The "Archived" list view uses a plain AND instead (see index.get.js):
 *   source = 'website' AND archived_at IS NOT NULL AND status NOT IN (hidden)
 */
export const ADMIN_ACTIVE_ORDERS_OR_FILTER = `source.neq.website,and(status.not.in.(${HIDDEN_WEBSITE_STATUSES.join(
  ','
)}),archived_at.is.null)`

/** A website order is the only thing Archive/Restore may touch. */
export const isArchivableSource = (source) => source === 'website'

// Back-compat: some code/tests referenced the old single map. It matched the
// website rules, so alias it.
export const ADMIN_STATUS_TRANSITIONS = WEBSITE_STATUS_TRANSITIONS
