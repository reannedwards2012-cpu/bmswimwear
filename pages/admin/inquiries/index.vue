<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Inquiry *Management*" size="sm" as="h1" />

    <!-- filters -->
    <div class="mt-6 space-y-4">
      <div class="relative sm:max-w-sm">
        <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" stroke-linecap="round" />
        </svg>
        <input
          v-model="searchInput"
          type="search"
          placeholder="Name, email, phone, or message…"
          class="w-full rounded-full border border-ink/15 bg-cream py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink/35 focus:border-coral focus:outline-none"
        />
      </div>

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
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading inquiries…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load inquiries.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <template v-else-if="data">
      <p class="mt-6 text-xs font-medium text-ink/40">{{ resultSummary }}</p>

      <div v-if="!inquiries.length" class="mt-3 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">{{ hasActiveFilters ? 'No inquiries match these filters.' : 'No inquiries yet.' }}</p>
        <button v-if="hasActiveFilters" type="button" class="btn-outline mt-5" @click="clearFilters">Clear filters</button>
      </div>

      <template v-else>
        <!-- desktop table -->
        <div class="mt-3 hidden overflow-x-auto rounded-4xl bg-cream shadow-card md:block">
          <table class="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
                <th class="px-5 py-4">From</th>
                <th class="px-5 py-4">Subject</th>
                <th class="px-5 py-4">Message</th>
                <th class="px-5 py-4">Received</th>
                <th class="px-5 py-4">Status</th>
                <th class="px-5 py-4" />
              </tr>
            </thead>
            <tbody class="divide-y divide-ink/10">
              <tr v-for="q in inquiries" :key="q.id" :class="q.status === 'new' ? 'bg-coral/[0.03]' : ''">
                <td class="px-5 py-4">
                  <p class="font-medium text-ink" :class="q.status === 'new' ? 'font-semibold' : ''">{{ fullName(q) }}</p>
                  <p class="text-xs text-ink/40">{{ q.email }}</p>
                  <p v-if="q.phone" class="text-xs text-ink/40">{{ q.phone }}</p>
                </td>
                <td class="px-5 py-4 text-ink/70">{{ q.subject }}</td>
                <td class="max-w-[22rem] px-5 py-4 text-xs text-ink/55">
                  <span class="line-clamp-2">{{ q.messagePreview }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap text-ink/60">{{ formatDate(q.createdAt) }}</td>
                <td class="px-5 py-4"><AdminInquiryStatusBadge :status="q.status" /></td>
                <td class="px-5 py-4 text-right">
                  <NuxtLink :to="`/admin/inquiries/${q.id}`" class="text-xs font-semibold text-coral link-underline">Open</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- mobile cards -->
        <ul class="mt-3 space-y-4 md:hidden">
          <li v-for="q in inquiries" :key="q.id" class="rounded-4xl bg-cream p-5 shadow-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-display text-base font-semibold text-ink">{{ fullName(q) }}</p>
                <p class="truncate text-xs text-ink/45">{{ q.email }}</p>
              </div>
              <AdminInquiryStatusBadge :status="q.status" class="shrink-0" />
            </div>
            <p class="mt-2 text-xs font-semibold uppercase tracking-widest2 text-ink/45">{{ q.subject }}</p>
            <p class="mt-2 line-clamp-3 text-sm text-ink/60">{{ q.messagePreview }}</p>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-xs text-ink/40">{{ formatDate(q.createdAt) }}</span>
              <NuxtLink :to="`/admin/inquiries/${q.id}`" class="btn-outline px-4 py-1.5 text-xs">Open</NuxtLink>
            </div>
          </li>
        </ul>

        <div v-if="data.hasMore" class="mt-6 text-center">
          <button type="button" class="btn-outline" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Inquiries — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
const route = useRoute()
const router = useRouter()

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' }
]
const VALID_STATUSES = STATUS_FILTERS.map((f) => f.value)

const initialStatus =
  typeof route.query.status === 'string' && VALID_STATUSES.includes(route.query.status) ? route.query.status : 'all'
const initialSearch = typeof route.query.search === 'string' ? route.query.search : ''

const activeFilter = ref(initialStatus)
const searchInput = ref(initialSearch)
const search = ref(initialSearch)

let debounceTimer
watch(searchInput, (val) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    search.value = val.trim()
  }, 350)
})

watch([activeFilter, search], () => {
  const query = {}
  if (activeFilter.value !== 'all') query.status = activeFilter.value
  if (search.value) query.search = search.value
  router.replace({ query })
})

function buildQuery(extra = {}) {
  const params = new URLSearchParams()
  if (activeFilter.value !== 'all') params.set('status', activeFilter.value)
  if (search.value) params.set('search', search.value)
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'admin-inquiries',
  () => authedFetch(`/api/admin/inquiries${buildQuery()}`),
  { server: false, watch: [activeFilter, search] }
)

// "Load more" appends older rows (cursor by the oldest currently-shown createdAt).
const extraPages = ref([])
const loadingMore = ref(false)
watch([activeFilter, search], () => {
  extraPages.value = []
})

const inquiries = computed(() => [...(data.value?.inquiries ?? []), ...extraPages.value.flat()])

async function loadMore() {
  const all = inquiries.value
  if (!all.length) return
  loadingMore.value = true
  try {
    const before = all[all.length - 1].createdAt
    const res = await authedFetch(`/api/admin/inquiries${buildQuery({ before })}`)
    extraPages.value.push(res.inquiries ?? [])
    if (data.value) data.value.hasMore = res.hasMore
  } catch {
    // silent — the button stays available to retry
  } finally {
    loadingMore.value = false
  }
}

const hasActiveFilters = computed(() => activeFilter.value !== 'all' || !!search.value)
const resultSummary = computed(() => {
  const n = inquiries.value.length
  return `${n} inquir${n === 1 ? 'y' : 'ies'}${hasActiveFilters.value ? ' found' : ''}${data.value?.hasMore ? '+' : ''}`
})

function clearFilters() {
  activeFilter.value = 'all'
  searchInput.value = ''
  search.value = ''
}

function filterCount(value) {
  const counts = data.value?.statusCounts
  if (!counts) return null
  if (value === 'all') return Object.values(counts).reduce((sum, n) => sum + n, 0)
  return counts[value] ?? 0
}

const fullName = (q) => [q.firstName, q.lastName].filter(Boolean).join(' ') || '—'

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
