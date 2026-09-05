<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Order *Management*" size="sm" as="h1" />
      <NuxtLink to="/admin/orders/new" class="btn-primary">Add Order</NuxtLink>
    </div>

    <!-- filters -->
    <div class="mt-6 space-y-4">
      <!-- search + period, side by side on desktop, stacked on mobile -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1 sm:max-w-xs">
          <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" stroke-linecap="round" />
          </svg>
          <input
            v-model="searchInput"
            type="search"
            placeholder="Order #, name, or email…"
            class="w-full rounded-full border border-ink/15 bg-cream py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink/35 focus:border-coral focus:outline-none"
          />
        </div>

        <!-- single scrollable row on mobile (keeps the filter block short),
             wraps normally from sm: up where there's room -->
        <div class="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
          <button
            v-for="p in PERIODS"
            :key="p.value"
            type="button"
            class="shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
            :class="period === p.value ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
            @click="period = p.value"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- status filter — same scrollable-on-mobile treatment -->
      <div class="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
        <button
          v-for="f in STATUS_FILTERS"
          :key="f.value"
          type="button"
          class="shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
          :class="activeFilter === f.value ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
          @click="activeFilter = f.value"
        >
          {{ f.label }}<span v-if="filterCount(f.value) !== null" class="ml-1 opacity-60">({{ filterCount(f.value) }})</span>
        </button>
      </div>

      <!-- source filter -->
      <div class="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
        <button
          v-for="s in SOURCE_FILTERS"
          :key="s.value"
          type="button"
          class="shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
          :class="sourceFilter === s.value ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
          @click="sourceFilter = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading orders…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load orders.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <template v-else-if="data">
      <!-- result summary -->
      <p class="mt-6 text-xs font-medium text-ink/40">
        {{ resultSummary }}
      </p>

      <div v-if="!orders.length" class="mt-3 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">{{ hasActiveFilters ? 'No orders match these filters.' : 'No orders yet.' }}</p>
        <button v-if="hasActiveFilters" type="button" class="btn-outline mt-5" @click="clearFilters">Clear filters</button>
      </div>

      <template v-else>
        <!-- desktop table -->
        <div class="mt-3 hidden overflow-x-auto rounded-4xl bg-cream shadow-card md:block">
          <table class="w-full min-w-[58rem] text-left text-sm">
            <thead>
              <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
                <th class="px-5 py-4">Order #</th>
                <th class="px-5 py-4">Source</th>
                <th class="px-5 py-4">Date</th>
                <th class="px-5 py-4">Customer</th>
                <th class="px-5 py-4">Total</th>
                <th class="px-5 py-4">Status</th>
                <th class="px-5 py-4" />
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/10">
              <tr v-for="o in orders" :key="o.id">
                <td class="px-5 py-4 font-medium text-ink">{{ o.orderNumber }}</td>
                <td class="px-5 py-4"><SourceBadge :source="o.source" /></td>
                <td class="px-5 py-4 text-ink/70">{{ formatDate(o.createdAt) }}</td>
                <td class="px-5 py-4">
                  <p class="text-ink">{{ customerName(o) }}</p>
                  <p class="text-xs text-ink/40">{{ o.email || '—' }}</p>
                </td>
                <td class="px-5 py-4 text-ink/70">{{ orderTotal(o) }}</td>
                <td class="px-5 py-4">
                  <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(o.status)">
                    {{ statusLabel(o.status) }}
                  </span>
                </td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <NuxtLink :to="`/admin/orders/${o.id}`" class="text-xs font-semibold text-coral link-underline">View</NuxtLink>
                    <button
                      v-if="o.source !== 'website'"
                      type="button"
                      class="text-ink/35 transition-colors hover:text-coral"
                      :aria-label="`Delete ${o.orderNumber}`"
                      :title="`Delete ${o.orderNumber}`"
                      @click="deleteTarget = o"
                    >
                      <IconTrash class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- mobile cards -->
        <ul class="mt-3 space-y-4 md:hidden">
          <li v-for="o in orders" :key="o.id" class="rounded-4xl bg-cream p-5 shadow-card">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-display text-base font-semibold text-ink">{{ o.orderNumber }}</p>
                <div class="mt-1 flex items-center gap-2">
                  <SourceBadge :source="o.source" />
                  <span class="text-xs text-ink/45">{{ formatDate(o.createdAt) }}</span>
                </div>
              </div>
              <span class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(o.status)">
                {{ statusLabel(o.status) }}
              </span>
            </div>
            <div class="mt-3 space-y-1 text-sm">
              <p class="text-ink">{{ customerName(o) }}</p>
              <p class="text-xs text-ink/45">{{ o.email || '—' }}</p>
            </div>
            <div class="mt-3 flex items-center justify-between text-sm">
              <span class="text-ink/60">{{ o.deliveryMethod === 'shipping' ? 'Delivery' : 'Pickup' }}</span>
              <span class="font-semibold text-ink">{{ orderTotal(o) }}</span>
            </div>
            <div class="mt-4 flex gap-2">
              <NuxtLink :to="`/admin/orders/${o.id}`" class="btn-outline flex-1 text-center">View order</NuxtLink>
              <button
                v-if="o.source !== 'website'"
                type="button"
                class="grid w-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink/40 hover:border-coral hover:text-coral"
                :aria-label="`Delete ${o.orderNumber}`"
                @click="deleteTarget = o"
              >
                <IconTrash class="h-4 w-4" />
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <!-- manual order permanent delete -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="deleteTarget = null"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Permanently delete {{ deleteTarget.orderNumber }}?</h2>
        <p class="mt-2 text-sm text-ink/60">
          This manual order for <span class="font-semibold text-ink">{{ customerName(deleteTarget) }}</span> and its items
          will be removed. This can’t be undone.
        </p>
        <p v-if="deleteError" class="mt-3 text-sm text-coral">{{ deleteError }}</p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="deleting" @click="deleteTarget = null">Cancel</button>
          <button
            type="button"
            class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deleting"
            @click="doDelete"
          >
            {{ deleting ? 'Deleting…' : 'Delete order' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { formatMoney } from '~/utils/money'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Orders — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
const route = useRoute()
const router = useRouter()

const customerName = (o) => [o.firstName, o.lastName].filter(Boolean).join(' ') || '—'
const orderTotal = (o) =>
  formatMoney(o.currency === 'XCD' ? o.subtotalXcdCents : o.subtotalUsdCents, o.currency)

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
  })
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'pending', label: 'Pending' },
  { value: 'payment_failed', label: 'Payment failed' }
]
const PERIODS = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' }
]
const SOURCE_FILTERS = [
  { value: 'all', label: 'All Sources' },
  { value: 'website', label: 'Website' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'in_person', label: 'In Person' },
  { value: 'other', label: 'Other' }
]
const VALID_STATUS_VALUES = STATUS_FILTERS.map((f) => f.value)
const VALID_PERIOD_VALUES = PERIODS.map((p) => p.value)
const VALID_SOURCE_VALUES = SOURCE_FILTERS.map((s) => s.value)

// Seed from the URL so a bookmarked/shared/refreshed
// /admin/orders?period=month&status=processing&search=smith&source=instagram
// restores the same view. Anything unrecognised falls back to the default.
const initialStatus = typeof route.query.status === 'string' && VALID_STATUS_VALUES.includes(route.query.status) ? route.query.status : 'all'
const initialPeriod = typeof route.query.period === 'string' && VALID_PERIOD_VALUES.includes(route.query.period) ? route.query.period : 'all'
const initialSearch = typeof route.query.search === 'string' ? route.query.search : ''
const initialSource = typeof route.query.source === 'string' && VALID_SOURCE_VALUES.includes(route.query.source) ? route.query.source : 'all'

const activeFilter = ref(initialStatus)
const period = ref(initialPeriod)
const sourceFilter = ref(initialSource)
// searchInput is bound to the text field directly (updates every
// keystroke); `search` is the debounced value actually sent to the API and
// synced to the URL, so typing doesn't fire a request (or a URL update) on
// every keystroke.
const searchInput = ref(initialSearch)
const search = ref(initialSearch)

let debounceTimer
watch(searchInput, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    search.value = val.trim()
  }, 350)
})

// Keep the URL in sync (replace, not push, so debounced typing doesn't spam
// browser history) whenever the effective filter state changes.
watch([activeFilter, period, search, sourceFilter], () => {
  const query = {}
  if (activeFilter.value !== 'all') query.status = activeFilter.value
  if (period.value !== 'all') query.period = period.value
  if (search.value) query.search = search.value
  if (sourceFilter.value !== 'all') query.source = sourceFilter.value
  router.replace({ query })
})

function buildQuery() {
  const params = new URLSearchParams()
  if (activeFilter.value !== 'all') params.set('status', activeFilter.value)
  if (period.value !== 'all') params.set('period', period.value)
  if (search.value) params.set('search', search.value)
  if (sourceFilter.value !== 'all') params.set('source', sourceFilter.value)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'admin-orders',
  () => authedFetch(`/api/admin/orders${buildQuery()}`),
  { server: false, watch: [activeFilter, period, search, sourceFilter] }
)

const orders = computed(() => data.value?.orders ?? [])
const hasActiveFilters = computed(
  () => activeFilter.value !== 'all' || period.value !== 'all' || !!search.value || sourceFilter.value !== 'all'
)
const resultSummary = computed(() => {
  const n = data.value?.count ?? orders.value.length
  return `${n} order${n === 1 ? '' : 's'}${hasActiveFilters.value ? ' found' : ''}`
})

function clearFilters() {
  activeFilter.value = 'all'
  period.value = 'all'
  sourceFilter.value = 'all'
  searchInput.value = ''
  search.value = ''
}

// ── manual order permanent delete ──
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await authedFetch(`/api/admin/orders/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteTarget.value = null
    await refresh()
  } catch (err) {
    deleteError.value = err?.data?.error || 'Could not delete this order.'
  } finally {
    deleting.value = false
  }
}

// Status pill counts respect the current period+search but not the
// currently selected status (server computes this in one extra lightweight
// query — see server/api/admin/orders/index.get.js). "All" shows the sum.
function filterCount(value) {
  const counts = data.value?.statusCounts
  if (!counts) return null
  if (value === 'all') return Object.values(counts).reduce((sum, n) => sum + n, 0)
  return counts[value] ?? 0
}

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
  processing: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending',
  payment_failed: 'Payment failed'
}
const statusClass = (s) => STATUS_STYLES[s] || 'bg-shell text-ink/70'
const statusLabel = (s) => STATUS_LABELS[s] || s

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
