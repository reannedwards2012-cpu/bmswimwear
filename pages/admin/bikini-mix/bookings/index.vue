<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Bikini *Mix*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <div class="mt-6">
      <AdminFilterSelect label="Status" v-model="statusFilter" :options="statusOptions" class="sm:w-56" />
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading bookings…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load bookings.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!bookings.length" class="mt-6 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">No bookings{{ statusFilter !== 'all' ? ' match this filter' : ' yet' }}.</p>
    </div>

    <div v-else class="mt-6 overflow-x-auto rounded-4xl bg-cream shadow-card">
      <table class="w-full min-w-[52rem] text-left text-sm">
        <thead>
          <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
            <th class="px-5 py-4">Booking</th>
            <th class="px-5 py-4">Guest</th>
            <th class="px-5 py-4">Package</th>
            <th class="px-5 py-4">Price</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr
            v-for="b in bookings"
            :key="b.id"
            tabindex="0"
            role="link"
            :aria-label="`Open ${b.bookingNumber}`"
            class="cursor-pointer transition-colors hover:bg-shell/50 focus-visible:bg-shell/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral"
            @click="rowActivate($event, () => openBooking(b))"
            @keydown="rowKeydown($event, () => openBooking(b))"
          >
            <td class="px-5 py-4 font-medium text-ink">
              {{ b.bookingNumber }}
              <span v-if="b.isTest" class="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink/50">
                Test
              </span>
            </td>
            <td class="px-5 py-4">
              <p class="text-ink">{{ b.fullName }}</p>
              <p class="text-xs text-ink/40">{{ b.email }}</p>
            </td>
            <td class="px-5 py-4 text-ink/70">{{ b.package === 'the_works' ? 'The Works' : 'Classic Mix' }}</td>
            <td class="px-5 py-4 text-ink/70">{{ formatMoney(b.retailPriceXcdCents, 'XCD') }}</td>
            <td class="px-5 py-4">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(b.displayStatus)">
                {{ statusLabel(b.displayStatus) }}
              </span>
            </td>
            <td class="px-5 py-4 text-ink/60">{{ formatDate(b.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '~/utils/money'
import { rowActivate, rowKeydown } from '~/utils/adminRowClick.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Bikini Mix Bookings — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const statusFilter = ref('all')
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'paid_needs_review', label: 'Paid — Needs Review' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' }
]

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'bikini-mix-bookings',
  () => authedFetch(`/api/admin/bikini-mix/bookings${statusFilter.value !== 'all' ? `?status=${statusFilter.value}` : ''}`),
  { server: false, watch: [statusFilter] }
)
const bookings = computed(() => data.value?.bookings ?? [])

const statusOptions = computed(() =>
  STATUS_FILTERS.map((f) => {
    const c = data.value?.counts
    if (f.value === 'all' || !c) return f
    return { ...f, label: `${f.label} (${c[f.value] ?? 0})` }
  })
)

function openBooking(b) {
  navigateTo(`/admin/bikini-mix/bookings/${b.id}`)
}

const STATUS_STYLES = {
  confirmed: 'bg-shell text-ink/70',
  pending_payment: 'bg-blush/30 text-ink',
  paid_needs_review: 'bg-coral/15 text-coral',
  expired: 'bg-ink/10 text-ink/50',
  cancelled: 'bg-ink/10 text-ink/50'
}
const STATUS_LABELS = {
  confirmed: 'Confirmed',
  pending_payment: 'Pending Payment',
  paid_needs_review: 'Paid — Needs Review',
  expired: 'Expired',
  cancelled: 'Cancelled'
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
