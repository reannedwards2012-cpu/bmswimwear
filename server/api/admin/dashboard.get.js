/**
 * GET /api/admin/dashboard?period=week|month|year
 *
 * Admin-only. Powers the Overview page (pages/admin/index.vue): headline
 * sales/order metrics, a sales trend chart, top products, and a small
 * "recent orders" operational list. Every total here is computed server-side
 * from `orders`/`order_items` — the client never sends or trusts a
 * calculated amount.
 *
 * Qualifying sale = order.status ∈ SALES_QUALIFYING_STATUSES (paid,
 * processing, completed) — see server/utils/orderStatus.js.
 *
 * All period-scoped analytics (sales total, order count, average order
 * value, best seller, top products, sales trend) are keyed on `paid_at`, NOT
 * `created_at` — Go2Pay payment confirmation (server/utils/go2payVerify.js,
 * the only code that ever sets paid_at) is the authoritative moment an order
 * becomes a real sale, not when the pending order row was first created.
 * A qualifying-status order with a null paid_at is a data anomaly (every
 * legitimate paid/processing/completed order gets paid_at set atomically
 * with its status by go2payVerify.js) — see the ANOMALY CHECK below for how
 * that's detected and surfaced rather than silently dropped or silently
 * counted under the wrong timestamp.
 *
 * Recent orders are the one exception to all of the above: they show the 5
 * most recent orders of ANY status, ordered and filtered by `created_at`,
 * unaffected by `period` or by the qualifying-status filter — they're
 * operational ("what just happened"), not analytics.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../utils/authUser.js'
import { SALES_QUALIFYING_STATUSES } from '../../utils/orderStatus.js'
import { mapOrderListItem } from '../../utils/orderMappers.js'
import { PERIODS, getPeriodRange, buildTrendBuckets } from '../../utils/dashboardPeriod.js'

const RECENT_ORDERS_LIMIT = 5
const TOP_PRODUCTS_LIMIT = 5

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const query = getQuery(event)
  const period = typeof query.period === 'string' ? query.period : ''
  if (!PERIODS.includes(period)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid period. Use week, month, or year.' }
  }

  try {
    const supabase = supabaseAdmin()
    const range = getPeriodRange(period)

    const [salesRes, recentRes, anomalyRes] = await Promise.all([
      // Qualifying orders whose PAYMENT was confirmed in range, with their
      // line items — one query feeds sales/order-count/AOV, best seller,
      // top products, and the trend chart, so the period filter only ever
      // costs a single round trip. Filtering on paid_at (not created_at) is
      // deliberate — see the file header.
      supabase
        .from('orders')
        .select('id, paid_at, subtotal_usd_cents, order_items(product_id, product_name, quantity, unit_price_usd_cents)')
        .in('status', SALES_QUALIFYING_STATUSES)
        .gte('paid_at', range.start.toISOString())
        .lt('paid_at', range.end.toISOString()),
      // Recent orders — independent of period/status, newest first, keyed
      // on created_at (operational "what just happened", not analytics).
      supabase
        .from('orders')
        .select('id, order_number, created_at, first_name, last_name, email, subtotal_usd_cents, status, delivery_method, paid_at')
        .order('created_at', { ascending: false })
        .limit(RECENT_ORDERS_LIMIT),
      // ANOMALY CHECK — global, not period-scoped: a qualifying-status order
      // can only be correctly placed in a reporting period by its paid_at,
      // so one with a null paid_at can't be silently included under
      // created_at instead (that would misreport *when* the sale happened)
      // and can't be silently placed in a period at all (there's no
      // authoritative timestamp to place it in). The `.gte`/`.lt` filters
      // above already exclude it from every period automatically (Postgres
      // NULL comparisons are never true) — this query exists purely so that
      // exclusion doesn't happen silently: any hit is logged below with
      // enough detail for an admin to find and fix the row in Supabase.
      supabase.from('orders').select('id, order_number, status').in('status', SALES_QUALIFYING_STATUSES).is('paid_at', null)
    ])

    if (salesRes.error) {
      console.error('[admin/dashboard] sales query failed:', salesRes.error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load dashboard data.' }
    }
    if (recentRes.error) {
      console.error('[admin/dashboard] recent orders query failed:', recentRes.error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load dashboard data.' }
    }
    // Anomaly-check failure is never fatal to the dashboard — it's a
    // best-effort integrity signal, not part of the requested data.
    if (anomalyRes.error) {
      console.error('[admin/dashboard] anomaly check query failed:', anomalyRes.error.message)
    } else if (anomalyRes.data?.length) {
      console.error(
        `[admin/dashboard] ANOMALY: ${anomalyRes.data.length} qualifying order(s) have status ∈ {paid,processing,completed} but paid_at is null — excluded from all period-scoped analytics (no authoritative timestamp to place them in). Needs manual review:`,
        anomalyRes.data.map((o) => ({ id: o.id, orderNumber: o.order_number, status: o.status }))
      )
    }

    const orders = salesRes.data ?? []

    // ── headline metrics ──
    const salesUsdCents = orders.reduce((sum, o) => sum + (o.subtotal_usd_cents || 0), 0)
    const orderCount = orders.length
    const averageOrderUsdCents = orderCount > 0 ? Math.round(salesUsdCents / orderCount) : 0

    // ── product aggregation (best seller + top products share one pass) ──
    // Keyed by product_id (falls back to the name for any legacy row that
    // somehow lacks it) so a renamed/re-titled product still aggregates as
    // one line rather than splitting across its old and new names.
    const productAgg = new Map()
    for (const o of orders) {
      for (const item of o.order_items ?? []) {
        const key = item.product_id || item.product_name
        if (!key) continue
        const entry = productAgg.get(key) || { productName: item.product_name, unitsSold: 0, salesUsdCents: 0 }
        entry.unitsSold += item.quantity || 0
        entry.salesUsdCents += (item.unit_price_usd_cents || 0) * (item.quantity || 0)
        productAgg.set(key, entry)
      }
    }
    const rankedProducts = [...productAgg.values()].sort(
      (a, b) => b.unitsSold - a.unitsSold || b.salesUsdCents - a.salesUsdCents
    )
    const bestSeller = rankedProducts.length
      ? { productName: rankedProducts[0].productName, unitsSold: rankedProducts[0].unitsSold }
      : { productName: null, unitsSold: 0 }
    const topProducts = rankedProducts.slice(0, TOP_PRODUCTS_LIMIT)

    // ── sales trend (zero-filled scaffold, then accumulate real orders) ──
    const { buckets, keyFor } = buildTrendBuckets(period, range)
    const bucketByKey = new Map(buckets.map((b) => [b.key, b]))
    for (const o of orders) {
      const bucket = bucketByKey.get(keyFor(o.paid_at))
      if (bucket) bucket.salesUsdCents += o.subtotal_usd_cents || 0
    }
    const salesTrend = buckets.map((b) => ({ label: b.label, salesUsdCents: b.salesUsdCents }))

    return {
      period,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      metrics: { salesUsdCents, orderCount, averageOrderUsdCents, bestSeller },
      salesTrend,
      topProducts,
      recentOrders: (recentRes.data ?? []).map(mapOrderListItem)
    }
  } catch (err) {
    console.error('[admin/dashboard] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load dashboard data.' }
  }
})
