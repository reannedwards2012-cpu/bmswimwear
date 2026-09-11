<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="*Stockists*" size="sm" as="h1" />
      <button type="button" class="btn-primary" @click="openCreate">Add stockist</button>
    </div>

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading stockists…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load stockists.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!stockists.length" class="mt-8 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">No stockists yet.</p>
      <button type="button" class="btn-primary mt-6" @click="openCreate">Add your first stockist</button>
    </div>

    <template v-else>
      <!-- totals -->
      <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminMetricCard label="Current Stock" :value="String(data.totals.currentStock)" sub="across all stockists" />
        <AdminMetricCard label="Sold" :value="String(data.totals.totalSold)" :sub="`of ${data.totals.totalSupplied} supplied`" />
        <AdminMetricCard label="Sell-through" :value="pct(data.totals.sellThroughPercent)" />
        <AdminMetricCard label="Bahama Mama Proceeds" :value="formatMoney(data.totals.proceedsCents, 'XCD')" :sub="`Retail ${formatMoney(data.totals.retailSalesCents, 'XCD')}`" />
      </div>

      <!-- lightweight cross-stockist insights -->
      <section v-if="hasInsights" class="mt-6 rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">What’s Selling</h2>
        <div class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div v-for="group in insightGroups" :key="group.label">
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/45">{{ group.label }}</p>
            <ol v-if="group.rows.length" class="mt-2 space-y-1 text-sm text-ink">
              <li v-for="(r, i) in group.rows" :key="r.key" class="flex items-center justify-between gap-2">
                <span class="truncate">{{ i + 1 }}. {{ r.key }}</span>
                <span class="shrink-0 text-xs text-ink/45">{{ r.quantitySold }}</span>
              </li>
            </ol>
            <p v-else class="mt-2 text-xs text-ink/40">No sales yet.</p>
          </div>

          <div>
            <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/45">Best sell-through</p>
            <p v-if="data.insights.bestSellThroughStockist" class="mt-2 text-sm text-ink">
              {{ data.insights.bestSellThroughStockist.name }}
              <span class="block text-xs text-ink/45">{{ pct(data.insights.bestSellThroughStockist.sellThroughPercent) }}</span>
            </p>
            <p v-else class="mt-2 text-xs text-ink/40">Not enough data yet.</p>
          </div>
        </div>
      </section>

      <!-- stockist rows -->
      <div class="mt-6 overflow-x-auto rounded-4xl bg-cream shadow-card">
        <table class="w-full min-w-[58rem] text-left text-sm">
          <thead>
            <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
              <th class="px-5 py-4">Stockist</th>
              <th class="px-5 py-4">In Stock</th>
              <th class="px-5 py-4">Sold</th>
              <th class="px-5 py-4">Supplied</th>
              <th class="px-5 py-4">Sell-through</th>
              <th class="px-5 py-4">Retail Sales</th>
              <th class="px-5 py-4">BM Proceeds</th>
              <th class="px-5 py-4" />
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="s in stockists"
              :key="s.id"
              tabindex="0"
              role="link"
              :aria-label="`Open ${s.name}`"
              class="cursor-pointer transition-colors hover:bg-shell/50 focus-visible:bg-shell/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral"
              @click="rowActivate($event, () => openStockist(s))"
              @keydown="rowKeydown($event, () => openStockist(s))"
            >
              <td class="px-5 py-4">
                <p class="font-medium text-ink">
                  {{ s.name }}
                  <span v-if="!s.isActive" class="ml-1.5 rounded-full bg-ink/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest2 text-ink/50">Inactive</span>
                </p>
                <p v-if="s.location" class="text-xs text-ink/40">{{ s.location }}</p>
              </td>
              <td class="px-5 py-4 text-ink/70">{{ s.currentStock }}</td>
              <td class="px-5 py-4 text-ink/70">{{ s.totalSold }}</td>
              <td class="px-5 py-4 text-ink/70">{{ s.totalSupplied }}</td>
              <td class="px-5 py-4 text-ink/70">{{ pct(s.sellThroughPercent) }}</td>
              <td class="px-5 py-4 text-ink/70">{{ formatMoney(s.retailSalesCents, 'XCD') }}</td>
              <td class="px-5 py-4 text-ink/70">{{ formatMoney(s.proceedsCents, 'XCD') }}</td>
              <td class="px-5 py-4 text-right">
                <button
                  data-row-action
                  type="button"
                  class="text-ink/35 transition-colors hover:text-coral"
                  :aria-label="`Edit ${s.name}`"
                  :title="`Edit ${s.name}`"
                  @click.stop="openEdit(s)"
                >
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <AdminStockistForm v-if="formOpen" :key="editingStockist?.id || 'new'" :stockist="editingStockist" @saved="onSaved" @cancel="formOpen = false" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '~/utils/money'
import { rowActivate, rowKeydown } from '~/utils/adminRowClick.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Stockists — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData('admin-stockists', () => authedFetch('/api/admin/stockists'), {
  server: false
})
const stockists = computed(() => data.value?.stockists ?? [])
const hasInsights = computed(() => {
  const i = data.value?.insights
  return !!i && (i.topProducts.length || i.topColours.length || i.topSizes.length || i.topCoverage.length || i.bestSellThroughStockist)
})
const insightGroups = computed(() => {
  const i = data.value?.insights
  if (!i) return []
  return [
    { label: 'Best products', rows: i.topProducts },
    { label: 'Best colours', rows: i.topColours },
    { label: 'Best sizes', rows: i.topSizes },
    { label: 'Best coverage', rows: i.topCoverage }
  ]
})

const pct = (n) => `${(n ?? 0).toFixed(1)}%`

function openStockist(s) {
  navigateTo(`/admin/stockists/${s.id}`)
}

// ── create / edit ──
const formOpen = ref(false)
const editingStockist = ref(null)
const savedMessage = ref('')
let savedTimer = null

function openCreate() {
  editingStockist.value = null
  formOpen.value = true
}
function openEdit(s) {
  editingStockist.value = s
  formOpen.value = true
}
function flash(msg) {
  clearTimeout(savedTimer)
  savedMessage.value = msg
  savedTimer = setTimeout(() => (savedMessage.value = ''), 4000)
}
async function onSaved(stockist) {
  formOpen.value = false
  await refresh()
  flash(`“${stockist?.name ?? 'Stockist'}” saved.`)
}
</script>
