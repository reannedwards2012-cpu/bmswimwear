<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Custom *Quotes*" size="sm" as="h1" />
      <NuxtLink to="/admin/quotes/new" class="btn-primary px-5 py-2 text-sm">+ New Quote</NuxtLink>
    </div>

    <AdminQuoteSubNav class="mt-6" />

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Search name, email, phone, description…"
        class="w-full max-w-xs rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
      />
      <select v-model="statusFilter" class="rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none">
        <option value="">All statuses</option>
        <option v-for="s in QUOTE_STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
      </select>
      <select v-model="categoryFilter" class="rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none">
        <option value="">All categories</option>
        <option v-for="c in QUOTE_CATEGORIES" :key="c" :value="c">{{ QUOTE_CATEGORY_LABELS[c] }}</option>
      </select>
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading quotes…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load quotes.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <p v-else-if="!data.quotes.length" class="mt-8 rounded-4xl bg-cream p-7 text-center text-sm text-ink/50 shadow-card">
      No quotes match these filters yet.
    </p>

    <div v-else class="mt-8 overflow-x-auto rounded-4xl bg-cream shadow-card">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/45">
            <th class="px-5 py-3">Quote</th>
            <th class="px-5 py-3">Customer</th>
            <th class="px-5 py-3">Category</th>
            <th class="px-5 py-3">Price</th>
            <th class="px-5 py-3">Status</th>
            <th class="px-5 py-3">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr
            v-for="q in data.quotes"
            :key="q.id"
            class="cursor-pointer transition-colors hover:bg-shell/40"
            @click="navigateTo(`/admin/quotes/${q.id}`)"
          >
            <td class="px-5 py-3 font-semibold text-ink">{{ q.quoteNumber }}</td>
            <td class="px-5 py-3">
              {{ q.customerName }}
              <p v-if="q.description" class="text-xs text-ink/45">{{ q.description }}</p>
            </td>
            <td class="px-5 py-3 text-ink/70">{{ QUOTE_CATEGORY_LABELS[q.category] || q.category }}</td>
            <td class="px-5 py-3 text-ink/70">{{ fmt(q.finalPriceXcdCents) }}</td>
            <td class="px-5 py-3"><AdminQuoteStatusBadge :status="q.status" /></td>
            <td class="px-5 py-3 text-ink/50">{{ formatDate(q.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { formatMoney } from '~/utils/money.js'
import { QUOTE_CATEGORIES, QUOTE_CATEGORY_LABELS } from '~/utils/quoteCalculator.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Custom Quotes — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired']
const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' }

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const search = ref('')
const debouncedSearch = ref('')
const statusFilter = ref('')
const categoryFilter = ref('')

let searchTimer = null
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (debouncedSearch.value = v), 350)
})

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'admin-quotes-list',
  () =>
    authedFetch('/api/admin/quotes', {
      query: { search: debouncedSearch.value || undefined, status: statusFilter.value || undefined, category: categoryFilter.value || undefined }
    }),
  { server: false, watch: [debouncedSearch, statusFilter, categoryFilter] }
)

const fmt = (cents) => formatMoney(cents, 'XCD')
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
</script>
