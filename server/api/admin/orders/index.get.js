/**
 * GET /api/admin/orders?status=&period=&search=&source=
 *
 * Admin-only. Returns a safe list of orders (newest first), optionally
 * filtered by status, a created_at date period, a search term, and/or the
 * order `source` (website / instagram / whatsapp / in_person / other).
 * Never returns payment tokens/idempotency keys/user_id or other internals —
 * see server/utils/orderMappers.js for the whitelist.
 *
 * period is deliberately evaluated against `created_at`, NOT `paid_at` —
 * this is an operational "when was this order placed" list (unlike the
 * Overview dashboard's analytics, which use `paid_at`; see
 * server/api/admin/dashboard.get.js). An admin browsing here wants to find
 * an order regardless of whether/when it was ever paid.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { ORDER_STATUSES, ADMIN_VISIBLE_ORDERS_OR_FILTER } from '../../../utils/orderStatus.js'
import { ORDER_LIST_SELECT, mapOrderListItem } from '../../../utils/orderMappers.js'
import { PERIODS, getPeriodRange } from '../../../utils/dashboardPeriod.js'
import { buildOrderSearchFilter } from '../../../utils/orderSearch.js'

// 'all' has no meaning for the Overview dashboard (it always reports on a
// concrete period), so it's added here rather than in PERIODS itself.
const LIST_PERIODS = ['all', ...PERIODS]
const ORDER_SOURCES = ['website', 'instagram', 'whatsapp', 'in_person', 'other']
const LIST_SOURCES = ['all', ...ORDER_SOURCES]

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const query = getQuery(event)
  const statusFilter = typeof query.status === 'string' ? query.status : ''
  const period = typeof query.period === 'string' && query.period ? query.period : 'all'
  const rawSearch = typeof query.search === 'string' ? query.search : ''
  const sourceFilter = typeof query.source === 'string' && query.source ? query.source : 'all'

  if (statusFilter && !ORDER_STATUSES.includes(statusFilter)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid status filter.' }
  }
  if (!LIST_PERIODS.includes(period)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid period. Use all, week, month, or year.' }
  }
  if (!LIST_SOURCES.includes(sourceFilter)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid source filter.' }
  }

  try {
    const supabase = supabaseAdmin()
    const range = period === 'all' ? null : getPeriodRange(period)
    const search = buildOrderSearchFilter(rawSearch) // null for an empty/whitespace-only term

    // Shared by both queries below so the date/search/source scope — AND the
    // admin-visibility rule — can never drift between the list and the status
    // counts. Only the status filter and the selected columns differ.
    //
    // The visibility `.or()` hides abandoned website checkout attempts
    // (`source='website'` AND status pending/payment_failed). Chained `.or()`
    // calls are AND-ed by PostgREST, so this composes correctly with the
    // search `.or()` — a hidden row is never surfaced by a name/phone match.
    const applyShared = (q) => {
      q = q.or(ADMIN_VISIBLE_ORDERS_OR_FILTER)
      if (range) q = q.gte('created_at', range.start.toISOString()).lt('created_at', range.end.toISOString())
      if (search) q = q.or(search.orClause)
      if (sourceFilter !== 'all') q = q.eq('source', sourceFilter)
      return q
    }

    let listQuery = applyShared(supabase.from('orders').select(ORDER_LIST_SELECT).order('created_at', { ascending: false }))
    if (statusFilter) listQuery = listQuery.eq('status', statusFilter)

    // Status counts intentionally respect period+search but NOT the current
    // status filter, so switching status pills shows what else is available
    // under the same date/search scope. One extra query, one narrow column
    // (`status` only) — cheap regardless of order-table size, so this
    // doesn't need the "several expensive queries" tradeoff the brief warned
    // about; see the written report for the full reasoning.
    const countsQuery = applyShared(supabase.from('orders').select('status'))

    const [listRes, countsRes] = await Promise.all([listQuery, countsQuery])

    if (listRes.error) {
      console.error('[admin/orders] list query failed:', listRes.error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load orders.' }
    }

    const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]))
    if (countsRes.error) {
      // Non-fatal — the order list itself is still useful without counts.
      console.error('[admin/orders] status counts query failed:', countsRes.error.message)
    } else {
      for (const row of countsRes.data ?? []) {
        if (statusCounts[row.status] !== undefined) statusCounts[row.status]++
      }
    }

    const orders = (listRes.data ?? []).map(mapOrderListItem)

    return {
      orders,
      count: orders.length,
      statusCounts,
      filters: { status: statusFilter || null, period, search: search?.term ?? null, source: sourceFilter }
    }
  } catch (err) {
    console.error('[admin/orders] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load orders.' }
  }
})
