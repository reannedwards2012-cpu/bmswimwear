<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Swimsuit *Mixer*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <div v-if="previewMode" class="mt-6 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-ink/70">
      🔧 <strong>Preview mode</strong> — the Swimsuit Mixer database migration hasn't been applied yet, so this list
      is showing local mock bookings instead of a load error.
    </div>

    <div v-if="data?.earlyBird" class="mt-6 flex flex-wrap items-center gap-3 rounded-3xl bg-cream p-4 text-sm shadow-card">
      <span class="font-semibold text-ink">Early Bird</span>
      <span class="text-ink/60">{{ data.earlyBird.applied }} claimed</span>
      <span v-if="data.earlyBird.mismatches" class="rounded-full bg-blush/30 px-2.5 py-0.5 text-xs text-ink/70">
        {{ data.earlyBird.mismatches }} honored right at the cutoff
      </span>
    </div>

    <div class="mt-6 flex flex-wrap gap-3">
      <AdminFilterSelect label="Status" v-model="statusFilter" :options="statusOptions" class="sm:w-56" />
      <AdminFilterSelect label="Garment" v-model="garmentFilter" :options="garmentOptions" class="sm:w-44" />
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading bookings…</p>

    <div v-else-if="loadError && !previewMode" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load bookings.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!bookings.length" class="mt-6 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">No bookings match these filters.</p>
    </div>

    <div v-else class="mt-6 overflow-x-auto rounded-4xl bg-cream shadow-card">
      <table class="w-full min-w-[52rem] text-left text-sm">
        <thead>
          <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
            <th class="px-5 py-4">Booking</th>
            <th class="px-5 py-4">Guest</th>
            <th class="px-5 py-4">Garment</th>
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
              <span v-if="b.earlyBirdApplied" class="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-coral">
                Early Bird
              </span>
              <span v-if="b.earlyBirdMismatch" class="ml-2 rounded-full bg-blush/30 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink/60">
                honored at cutoff
              </span>
              <span v-if="b.isComplimentary" class="ml-2 rounded-full bg-seafoam px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink">
                Complimentary · {{ CATEGORY_LABELS[b.invitationCategory] || b.invitationCategory }}
              </span>
            </td>
            <td class="px-5 py-4">
              <p class="text-ink">{{ b.fullName }}</p>
              <p class="text-xs text-ink/40">{{ b.email }}</p>
            </td>
            <td class="px-5 py-4 text-ink/70">{{ b.garmentType === 'onepiece' ? 'One-Piece' : 'Bikini' }}</td>
            <td class="px-5 py-4 text-ink/70">{{ b.isComplimentary ? 'Complimentary' : formatMoney(b.retailPriceXcdCents, 'XCD') }}</td>
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
import { mockBookings } from '~/data/bikiniMixAdminMock.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Swimsuit Mixer Bookings — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const statusFilter = ref('all')
const garmentFilter = ref('all')
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'paid_needs_review', label: 'Paid — Needs Review' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' }
]
const garmentOptions = [
  { value: 'all', label: 'All' },
  { value: 'bikini', label: 'Bikini' },
  { value: 'onepiece', label: 'One-Piece' }
]
const CATEGORY_LABELS = { event_assistant: 'Event Assistant', giveaway: 'Giveaway', other: 'Other' }

function isNotConfigured(err) {
  return err?.statusCode === 503 || err?.data?.configured === false
}
const previewMode = ref(false)

function mockBookingsResponse(status, garment) {
  const all = mockBookings()
  const counts = { pending_payment: 0, confirmed: 0, paid_needs_review: 0, expired: 0, cancelled: 0 }
  for (const b of all) {
    if (counts[b.displayStatus] != null) counts[b.displayStatus] += 1
  }
  const earlyBird = {
    applied: all.filter((b) => b.status === 'confirmed' && !b.isTest && b.earlyBirdApplied).length,
    mismatches: all.filter((b) => b.earlyBirdMismatch).length
  }
  let bookings = all
  if (garment !== 'all') bookings = bookings.filter((b) => b.garmentType === garment)
  if (status !== 'all') bookings = bookings.filter((b) => b.displayStatus === status)
  return { bookings, counts, earlyBird }
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'bikini-mix-bookings',
  async () => {
    const params = new URLSearchParams()
    if (statusFilter.value !== 'all') params.set('status', statusFilter.value)
    if (garmentFilter.value !== 'all') params.set('garmentType', garmentFilter.value)
    const qs = params.toString()
    try {
      return await authedFetch(`/api/admin/bikini-mix/bookings${qs ? `?${qs}` : ''}`)
    } catch (err) {
      if (isNotConfigured(err)) {
        previewMode.value = true
        return mockBookingsResponse(statusFilter.value, garmentFilter.value)
      }
      throw err
    }
  },
  { server: false, watch: [statusFilter, garmentFilter] }
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
