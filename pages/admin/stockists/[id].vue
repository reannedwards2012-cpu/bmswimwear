<template>
  <div>
    <NuxtLink to="/admin/stockists" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
      ← Back to stockists
    </NuxtLink>

    <p v-if="pending" class="mt-6 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading stockist…</p>

    <div v-else-if="loadError" class="mt-6 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">{{ notFound ? 'That stockist could not be found.' : 'Couldn’t load this stockist.' }}</p>
      <button v-if="!notFound" type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
      <NuxtLink v-else to="/admin/stockists" class="btn-outline mt-4 inline-block">Back to stockists</NuxtLink>
    </div>

    <template v-else-if="stockist">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="font-display text-2xl font-semibold text-ink md:text-3xl">{{ stockist.name }}</h1>
            <span v-if="!stockist.isActive" class="rounded-full bg-ink/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink/55">
              Inactive
            </span>
          </div>
          <p v-if="stockist.location" class="mt-1 text-sm text-ink/50">{{ stockist.location }}</p>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" class="btn-outline" @click="editOpen = true">Edit stockist</button>
          <button type="button" class="btn-primary" @click="addOpen = true">Add Inventory</button>
        </div>
      </div>

      <!-- summary cards -->
      <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <AdminMetricCard label="Current Stock" :value="String(summary.currentStock)" />
        <AdminMetricCard label="Sold" :value="String(summary.totalSold)" :sub="`of ${summary.totalSupplied} supplied`" />
        <AdminMetricCard label="Sell-through" :value="pct(summary.sellThroughPercent)" />
        <AdminMetricCard label="Retail Sales" :value="formatMoney(summary.retailSalesCents, 'XCD')" />
        <AdminMetricCard label="Bahama Mama Proceeds" :value="formatMoney(summary.proceedsCents, 'XCD')" :sub="`Commission ${formatMoney(summary.commissionCents, 'XCD')}`" />
      </div>

      <!-- contact / notes -->
      <section v-if="stockist.contactName || stockist.phone || stockist.email || stockist.notes" class="mt-6 rounded-4xl bg-cream p-6 shadow-card">
        <div class="flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink/70">
          <p v-if="stockist.contactName"><span class="text-ink/45">Contact</span> {{ stockist.contactName }}</p>
          <p v-if="stockist.phone"><span class="text-ink/45">Phone</span> {{ stockist.phone }}</p>
          <p v-if="stockist.email"><span class="text-ink/45">Email</span> {{ stockist.email }}</p>
        </div>
        <p v-if="stockist.notes" class="mt-3 whitespace-pre-line text-sm text-ink/60">{{ stockist.notes }}</p>
      </section>

      <!-- filters -->
      <div v-if="items.length" class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div class="relative flex-1 sm:max-w-xs">
          <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" stroke-linecap="round" />
          </svg>
          <input
            v-model.trim="search"
            type="search"
            placeholder="Search product, colour, size…"
            class="w-full rounded-full border border-ink/15 bg-cream py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink/35 focus:border-coral focus:outline-none"
          />
        </div>
        <AdminFilterSelect label="View" v-model="stockFilter" :options="STOCK_FILTERS" class="sm:w-40" />
        <AdminFilterSelect label="Product" v-model="productFilter" :options="productOptions" class="sm:w-52" />
        <AdminFilterSelect label="Colour" v-model="colourFilter" :options="colourOptions" class="sm:w-40" />
        <AdminFilterSelect label="Size" v-model="sizeFilter" :options="sizeOptions" class="sm:w-32" />
      </div>

      <p v-if="items.length" class="mt-5 text-xs font-medium text-ink/40">
        {{ filtered.length }} item{{ filtered.length === 1 ? '' : 's' }}{{ hasActiveFilters ? ' found' : '' }}
      </p>

      <div v-if="!items.length" class="mt-3 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">No inventory yet.</p>
        <button type="button" class="btn-primary mt-6" @click="addOpen = true">Add inventory</button>
      </div>

      <div v-else-if="!filtered.length" class="mt-3 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">No items match these filters.</p>
        <button type="button" class="btn-outline mt-5" @click="clearFilters">Clear filters</button>
      </div>

      <template v-else>
        <!-- desktop table -->
        <div class="mt-3 hidden overflow-x-auto rounded-4xl bg-cream shadow-card lg:block">
          <table class="w-full min-w-[64rem] text-left text-sm">
            <thead>
              <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
                <th class="px-5 py-4">Product</th>
                <th class="px-5 py-4">Sent</th>
                <th class="px-5 py-4">Sold</th>
                <th class="px-5 py-4">Remaining</th>
                <th class="px-5 py-4">Retail</th>
                <th class="px-5 py-4">First Sent</th>
                <th class="px-5 py-4" />
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/10">
              <tr v-for="i in filtered" :key="i.id" :class="i.isArchived ? 'opacity-50' : ''">
                <td class="px-5 py-4">
                  <div class="flex items-center gap-3">
                    <span class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-sand/40">
                      <img v-if="i.productImage" :src="i.productImage" :alt="i.productName" class="h-full w-full object-cover" />
                    </span>
                    <div class="min-w-0">
                      <p class="truncate font-medium text-ink">{{ i.productName }}</p>
                      <p class="truncate text-xs text-ink/40">{{ variantText(i) || '—' }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-4 text-ink/70">{{ i.totalSuppliedQuantity }}</td>
                <td class="px-5 py-4 text-ink/70">{{ i.totalSoldQuantity }}</td>
                <td class="px-5 py-4">
                  <span class="font-semibold" :class="i.remainingQuantity === 0 ? 'text-ink/35' : 'text-ink'">{{ i.remainingQuantity }}</span>
                </td>
                <td class="px-5 py-4 text-ink/70">{{ formatMoney(i.retailPriceCents, 'XCD') }}</td>
                <td class="px-5 py-4 text-ink/60">{{ formatDate(i.firstSentAt) }}</td>
                <td class="px-5 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:border-coral hover:text-coral disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="i.remainingQuantity === 0"
                      @click="openMovement(i, 'sold')"
                    >
                      Mark Sold
                    </button>
                    <details class="relative">
                      <summary class="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full text-ink/40 hover:bg-shell hover:text-ink">⋯</summary>
                      <div class="absolute right-0 z-10 mt-1 w-40 rounded-2xl bg-cream p-1.5 text-left shadow-card">
                        <button type="button" class="menu-item" @click="closeMenu($event); openMovement(i, 'restock')">Restock</button>
                        <button type="button" class="menu-item" :disabled="i.remainingQuantity === 0" @click="closeMenu($event); openMovement(i, 'returned')">Return</button>
                        <button type="button" class="menu-item" :disabled="i.remainingQuantity === 0" @click="closeMenu($event); openMovement(i, 'removed')">Remove / Adjust</button>
                        <button type="button" class="menu-item" @click="closeMenu($event); openHistory(i)">History</button>
                        <button type="button" class="menu-item" @click="closeMenu($event); toggleArchive(i)">{{ i.isArchived ? 'Unarchive' : 'Archive' }}</button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- mobile cards -->
        <ul class="mt-3 space-y-4 lg:hidden">
          <li v-for="i in filtered" :key="i.id" class="rounded-4xl bg-cream p-5 shadow-card" :class="i.isArchived ? 'opacity-50' : ''">
            <div class="flex items-start gap-3">
              <span class="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-sand/40">
                <img v-if="i.productImage" :src="i.productImage" :alt="i.productName" class="h-full w-full object-cover" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium text-ink">{{ i.productName }}</p>
                <p class="text-xs text-ink/40">{{ variantText(i) || '—' }}</p>
              </div>
              <span class="shrink-0 text-right">
                <span class="block font-semibold" :class="i.remainingQuantity === 0 ? 'text-ink/35' : 'text-ink'">{{ i.remainingQuantity }}</span>
                <span class="block text-[0.65rem] text-ink/40">remaining</span>
              </span>
            </div>
            <div class="mt-3 flex items-center justify-between text-xs text-ink/55">
              <span>Sent {{ i.totalSuppliedQuantity }} · Sold {{ i.totalSoldQuantity }}</span>
              <span>{{ formatMoney(i.retailPriceCents, 'XCD') }}</span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="i.remainingQuantity === 0"
                @click="openMovement(i, 'sold')"
              >
                Mark Sold
              </button>
              <button type="button" class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70" @click="openMovement(i, 'restock')">
                Restock
              </button>
              <button
                type="button"
                class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="i.remainingQuantity === 0"
                @click="openMovement(i, 'returned')"
              >
                Return
              </button>
              <button
                type="button"
                class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="i.remainingQuantity === 0"
                @click="openMovement(i, 'removed')"
              >
                Remove
              </button>
              <button type="button" class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70" @click="openHistory(i)">
                History
              </button>
              <button type="button" class="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/40" @click="toggleArchive(i)">
                {{ i.isArchived ? 'Unarchive' : 'Archive' }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <AdminStockistForm v-if="editOpen" :stockist="stockist" @saved="onStockistSaved" @cancel="editOpen = false" />

    <AdminStockistInventoryForm
      v-if="addOpen"
      :stockist-id="route.params.id"
      :default-commission-bps="stockist?.defaultCommissionBps"
      @saved="onItemAdded"
      @cancel="addOpen = false"
    />

    <AdminStockistMovementModal
      v-if="movementTarget"
      :stockist-id="route.params.id"
      :item="movementTarget.item"
      :type="movementTarget.type"
      @saved="onMovementSaved"
      @cancel="movementTarget = null"
    />

    <AdminStockistItemHistory v-if="historyItem" :stockist-id="route.params.id" :item="historyItem" @close="historyItem = null" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '~/utils/money'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const { getAccessToken } = useAuth()

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const notFound = ref(false)

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  `admin-stockist-${route.params.id}`,
  () => {
    notFound.value = false
    return authedFetch(`/api/admin/stockists/${route.params.id}`).catch((err) => {
      if (err?.statusCode === 404 || err?.response?.status === 404) notFound.value = true
      throw err
    })
  },
  { server: false }
)

const stockist = computed(() => data.value?.stockist ?? null)
const summary = computed(
  () =>
    data.value?.summary ?? {
      currentStock: 0,
      totalSupplied: 0,
      totalSold: 0,
      sellThroughPercent: 0,
      retailSalesCents: 0,
      commissionCents: 0,
      proceedsCents: 0
    }
)
const items = computed(() => data.value?.items ?? [])

useHead(() => ({
  title: stockist.value ? `${stockist.value.name} — Stockists — Admin — Bahama Mama Swimwear` : 'Stockist — Admin — Bahama Mama Swimwear',
  meta: [{ name: 'robots', content: 'noindex' }]
}))

const pct = (n) => `${(n ?? 0).toFixed(1)}%`
const variantText = (i) => [i.colour, i.size, i.coverage].filter(Boolean).join(' · ')

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// ── filters (client-side — a boutique's item list is small; same
// philosophy as pages/admin/products.vue) ──
const STOCK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'sold_out', label: 'Sold Out' }
]
const search = ref('')
const stockFilter = ref('all')
const productFilter = ref('all')
const colourFilter = ref('all')
const sizeFilter = ref('all')

const productOptions = computed(() => [
  { value: 'all', label: 'All Products' },
  ...[...new Set(items.value.map((i) => i.productName))].sort().map((v) => ({ value: v, label: v }))
])
const colourOptions = computed(() => [
  { value: 'all', label: 'All Colours' },
  ...[...new Set(items.value.map((i) => i.colour).filter(Boolean))].sort().map((v) => ({ value: v, label: v }))
])
const sizeOptions = computed(() => [
  { value: 'all', label: 'All Sizes' },
  ...[...new Set(items.value.map((i) => i.size).filter(Boolean))].sort().map((v) => ({ value: v, label: v }))
])

const hasActiveFilters = computed(
  () => !!search.value || stockFilter.value !== 'all' || productFilter.value !== 'all' || colourFilter.value !== 'all' || sizeFilter.value !== 'all'
)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return items.value.filter((i) => {
    if (stockFilter.value === 'in_stock' && i.remainingQuantity === 0) return false
    if (stockFilter.value === 'sold_out' && i.remainingQuantity > 0) return false
    if (productFilter.value !== 'all' && i.productName !== productFilter.value) return false
    if (colourFilter.value !== 'all' && i.colour !== colourFilter.value) return false
    if (sizeFilter.value !== 'all' && i.size !== sizeFilter.value) return false
    if (q) {
      const hay = [i.productName, i.colour, i.size, i.coverage, i.referenceCode].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

function clearFilters() {
  search.value = ''
  stockFilter.value = 'all'
  productFilter.value = 'all'
  colourFilter.value = 'all'
  sizeFilter.value = 'all'
}

// ── edit stockist ──
const editOpen = ref(false)
function onStockistSaved(updated) {
  editOpen.value = false
  if (data.value?.stockist) data.value = { ...data.value, stockist: updated }
}

// ── add inventory ──
const addOpen = ref(false)
async function onItemAdded() {
  addOpen.value = false
  await refresh()
}

// ── movements (Restock / Sold / Return / Remove) ──
const movementTarget = ref(null) // { item, type }
function openMovement(item, type) {
  movementTarget.value = { item, type }
}
// The row actions menu is a native <details>; clicking an item inside it
// should close it immediately rather than leaving it open behind the modal.
function closeMenu(event) {
  event.target.closest('details')?.removeAttribute('open')
}
function onMovementSaved(updatedItem) {
  movementTarget.value = null
  if (data.value?.items) {
    data.value = {
      ...data.value,
      items: data.value.items.map((i) => (i.id === updatedItem.id ? { ...i, ...updatedItem } : i))
    }
  }
  // Aggregates (sell-through/retail sales/commission/proceeds) depend on the
  // full sold-movement history, which the movement response doesn't carry —
  // refresh in the background so those stay accurate without blocking the UI.
  refresh()
}

// ── history ──
const historyItem = ref(null)
function openHistory(item) {
  historyItem.value = item
}

// ── archive / unarchive an item ──
async function toggleArchive(item) {
  try {
    const res = await authedFetch(`/api/admin/stockists/${route.params.id}/items/${item.id}`, {
      method: 'PATCH',
      body: { isArchived: !item.isArchived }
    })
    if (data.value?.items) {
      data.value = {
        ...data.value,
        items: data.value.items.map((i) => (i.id === item.id ? { ...i, ...res.item } : i))
      }
    }
  } catch {
    // best-effort; row stays as-is and can be retried
  }
}
</script>

<style scoped>
.menu-item {
  @apply block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-ink/70 hover:bg-shell disabled:cursor-not-allowed disabled:opacity-40;
}
</style>
