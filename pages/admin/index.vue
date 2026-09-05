<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="*Overview*" size="sm" as="h1" />

      <div class="flex flex-wrap gap-2">
        <button
          v-for="f in PERIODS"
          :key="f.value"
          type="button"
          class="rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
          :class="period === f.value ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
          @click="period = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading dashboard…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load the dashboard.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <template v-else-if="data">
      <!-- metric cards -->
      <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminMetricCard label="Sales" :value="money(data.metrics.salesUsdCents / 100)" :sub="periodSub" />
        <AdminMetricCard label="Orders" :value="String(data.metrics.orderCount)" :sub="periodSub" />
        <AdminMetricCard label="Avg. Order Value" :value="money(data.metrics.averageOrderUsdCents / 100)" />
        <AdminMetricCard
          label="Best Seller"
          :value="data.metrics.bestSeller.productName || 'No sales yet'"
          :sub="data.metrics.bestSeller.productName ? `${data.metrics.bestSeller.unitsSold} sold` : ''"
        />
      </div>

      <!-- sales trend -->
      <section class="mt-6 rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Sales trend</h2>
        <div class="mt-6">
          <AdminSalesTrendChart :points="data.salesTrend" />
        </div>
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <!-- top products -->
        <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
          <h2 class="font-display text-lg font-semibold text-ink">Top Products</h2>
          <p v-if="!data.topProducts.length" class="mt-4 text-sm text-ink/45">No sales yet.</p>
          <ul v-else class="mt-4 divide-y divide-ink/10">
            <li v-for="(p, i) in data.topProducts" :key="i" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-ink">{{ p.productName }}</p>
                <p class="text-xs text-ink/45">{{ p.unitsSold }} sold</p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-ink">{{ money(p.salesUsdCents / 100) }}</span>
            </li>
          </ul>
        </section>

        <!-- recent orders -->
        <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold text-ink">Recent Orders</h2>
            <NuxtLink to="/admin/orders" class="text-xs font-semibold text-coral link-underline">View all</NuxtLink>
          </div>
          <p v-if="!data.recentOrders.length" class="mt-4 text-sm text-ink/45">No orders yet.</p>
          <ul v-else class="mt-4 divide-y divide-ink/10">
            <li v-for="o in data.recentOrders" :key="o.id">
              <NuxtLink :to="`/admin/orders/${o.id}`" class="flex items-center justify-between gap-3 py-3 hover:text-coral">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink">{{ o.orderNumber }}</p>
                  <p class="truncate text-xs text-ink/45">{{ o.firstName }} {{ o.lastName }} · {{ formatDate(o.createdAt) }}</p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold text-ink">{{ money(o.subtotalUsdCents / 100) }}</p>
                  <span class="rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold" :class="statusClass(o.status)">
                    {{ statusLabel(o.status) }}
                  </span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatUsd } from '~/utils/money'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Overview — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
const money = formatUsd

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
  })
}

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' }
]
const period = ref('month')
const periodSub = computed(() => PERIODS.find((p) => p.value === period.value)?.label ?? '')

const {
  data,
  pending,
  error: loadError,
  refresh
} = useLazyAsyncData('admin-dashboard', () => authedFetch(`/api/admin/dashboard?period=${period.value}`), {
  server: false,
  watch: [period]
})

const STATUS_STYLES = {
  paid: 'bg-shell text-ink/70',
  processing: 'bg-blush/30 text-ink',
  completed: 'bg-ink/10 text-ink',
  cancelled: 'bg-coral/15 text-coral',
  pending: 'bg-shell text-ink/50',
  payment_failed: 'bg-coral/15 text-coral'
}
const STATUS_LABELS = {
  paid: 'Paid',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
  payment_failed: 'Payment failed'
}
const statusClass = (s) => STATUS_STYLES[s] || 'bg-shell text-ink/70'
const statusLabel = (s) => STATUS_LABELS[s] || s

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
