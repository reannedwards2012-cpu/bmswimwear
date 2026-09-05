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
 *
 * ── Currency (manual XCD orders) ──────────────────────────────────────────
 * Every website order + USD manual orders have `currency = 'USD'`; XCD
 * manual orders have `currency = 'XCD'` and store their total in
 * `subtotal_xcd_cents`. USD and XCD amounts are NEVER added together. The
 * headline USD figures (Sales, AOV, Sales Trend, Top Products revenue) are
 * scoped to `currency = 'USD'` orders. The Orders count and Best Seller /
 * Top Products *ranking* count units across both currencies (a unit is a
 * unit). `metrics.xcd` carries the XCD side separately; `topProducts[].salesXcdCents`
 * is the per-product XCD revenue.
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../utils/authUser.js'
import { SALES_QUALIFYING_STATUSES, ADMIN_ACTIVE_ORDERS_OR_FILTER } from '../../utils/orderStatus.js'
import { ORDER_LIST_SELECT, mapOrderListItem } from '../../utils/orderMappers.js'
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

    const [salesRes, recentRes, anomalyRes, newInquiriesRes] = await Promise.all([
      // Qualifying orders whose PAYMENT was confirmed in range, with their
      // line items — one query feeds sales/order-count/AOV, best seller,
      // top products, and the trend chart, so the period filter only ever
      // costs a single round trip. Filtering on paid_at (not created_at) is
      // deliberate — see the file header.
      supabase
        .from('orders')
        .select(
          'id, paid_at, currency, subtotal_usd_cents, subtotal_xcd_cents, order_items(product_id, product_name, quantity, unit_price_usd_cents, unit_price_xcd_cents)'
        )
        .in('status', SALES_QUALIFYING_STATUSES)
        .gte('paid_at', range.start.toISOString())
        .lt('paid_at', range.end.toISOString()),
      // Recent orders — independent of period/status, newest first, keyed
      // on created_at (operational "what just happened", not analytics).
      // Follows the same default admin-list rule as Order Management: abandoned
      // website checkout attempts AND archived website orders are excluded and
      // must not appear or bump a real one off the list. (Archive is presentation
      // only — archived paid orders still count in the sales analytics below.)
      supabase
        .from('orders')
        .select(ORDER_LIST_SELECT)
        .or(ADMIN_ACTIVE_ORDERS_OR_FILTER)
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
      supabase.from('orders').select('id, order_number, status').in('status', SALES_QUALIFYING_STATUSES).is('paid_at', null),
      // Inquiry Management — a single "unhandled inbox" count for the Overview
      // (status = 'new', all-time, NOT period-scoped). Best-effort: a failure
      // here never blocks the sales dashboard. Independent of everything above.
      supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new')
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

    // Best-effort — a broken inquiries read must not take down the dashboard.
    let newInquiriesCount = 0
    if (newInquiriesRes.error) {
      console.error('[admin/dashboard] new-inquiries count failed:', newInquiriesRes.error.message)
    } else {
      newInquiriesCount = newInquiriesRes.count ?? 0
    }

    const orders = salesRes.data ?? []
    // XCD amounts are never combined with USD amounts.
    const usdOrders = orders.filter((o) => o.currency !== 'XCD')
    const xcdOrders = orders.filter((o) => o.currency === 'XCD')

    // ── headline metrics ──
    const salesUsdCents = usdOrders.reduce((sum, o) => sum + (o.subtotal_usd_cents || 0), 0)
    const orderCount = orders.length // a count — currency-agnostic
    const averageOrderUsdCents = usdOrders.length > 0 ? Math.round(salesUsdCents / usdOrders.length) : 0
    const xcd = {
      salesXcdCents: xcdOrders.reduce((sum, o) => sum + (o.subtotal_xcd_cents || 0), 0),
      orderCount: xcdOrders.length
    }

    // ── product aggregation (best seller + top products share one pass) ──
    // Units are counted across ALL currencies; revenue is split per currency.
    const productAgg = new Map()
    for (const o of orders) {
      const isXcd = o.currency === 'XCD'
      for (const item of o.order_items ?? []) {
        const key = item.product_id || item.product_name
        if (!key) continue
        const entry = productAgg.get(key) || { productName: item.product_name, unitsSold: 0, salesUsdCents: 0, salesXcdCents: 0 }
        const qty = item.quantity || 0
        entry.unitsSold += qty
        if (isXcd) entry.salesXcdCents += (item.unit_price_xcd_cents || 0) * qty
        else entry.salesUsdCents += (item.unit_price_usd_cents || 0) * qty
        productAgg.set(key, entry)
      }
    }
    const rankedProducts = [...productAgg.values()].sort(
      (a, b) => b.unitsSold - a.unitsSold || b.salesUsdCents - a.salesUsdCents || b.salesXcdCents - a.salesXcdCents
    )
    const bestSeller = rankedProducts.length
      ? { productName: rankedProducts[0].productName, unitsSold: rankedProducts[0].unitsSold }
      : { productName: null, unitsSold: 0 }
    const topProducts = rankedProducts.slice(0, TOP_PRODUCTS_LIMIT)

    // ── sales trend (USD only — the chart is a USD $ chart) ──
    const { buckets, keyFor } = buildTrendBuckets(period, range)
    const bucketByKey = new Map(buckets.map((b) => [b.key, b]))
    for (const o of usdOrders) {
      const bucket = bucketByKey.get(keyFor(o.paid_at))
      if (bucket) bucket.salesUsdCents += o.subtotal_usd_cents || 0
    }
    const salesTrend = buckets.map((b) => ({ label: b.label, salesUsdCents: b.salesUsdCents }))

    return {
      period,
      range: { start: range.start.toISOString(), end: range.end.toISOString() },
      metrics: { salesUsdCents, orderCount, averageOrderUsdCents, bestSeller, xcd },
      salesTrend,
      topProducts,
      recentOrders: (recentRes.data ?? []).map(mapOrderListItem),
      inquiries: { newCount: newInquiriesCount }
    }
  } catch (err) {
    console.error('[admin/dashboard] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load dashboard data.' }
  }
})
