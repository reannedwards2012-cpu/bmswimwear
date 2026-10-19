<template>
  <div>
    <NuxtLink to="/admin/bikini-mix/bookings" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
      ← Back to bookings
    </NuxtLink>

    <p v-if="pending" class="mt-6 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading booking…</p>

    <div v-else-if="loadError" class="mt-6 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">{{ notFound ? 'That booking could not be found.' : 'Couldn’t load this booking.' }}</p>
    </div>

    <template v-else-if="booking">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-2xl font-semibold text-ink md:text-3xl">
            {{ booking.bookingNumber }}
            <span v-if="booking.isTest" class="ml-2 align-middle rounded-full bg-ink/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
              Test booking
            </span>
          </h1>
          <p class="mt-1 text-sm text-ink/50">{{ formatDate(booking.createdAt) }}</p>
        </div>
        <span class="rounded-full px-4 py-1.5 text-xs font-semibold" :class="statusClass(booking.displayStatus)">
          {{ statusLabel(booking.displayStatus) }}
        </span>
      </div>

      <!-- admin resolution — only shown when actionable -->
      <section v-if="booking.status === 'paid_needs_review'" class="mt-6 rounded-4xl bg-coral/10 p-6 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Needs Review</h2>
        <p class="mt-2 text-sm text-ink/70">
          Payment was verified after this booking's hold expired, once the event was already at capacity. It is
          <strong>not</strong> counted as a confirmed guest or in the production summary until you resolve it.
        </p>
        <p v-if="booking.adminNotes" class="mt-2 whitespace-pre-line text-xs text-ink/55">{{ booking.adminNotes }}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <button type="button" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="resolving" @click="resolve('confirm')">
            Confirm as exception guest
          </button>
          <button type="button" class="btn-outline disabled:cursor-not-allowed disabled:opacity-60" :disabled="resolving" @click="resolve('cancel')">
            Cancel &amp; refund per policy
          </button>
        </div>
        <p v-if="resolveError" class="mt-3 text-sm text-coral">{{ resolveError }}</p>
      </section>

      <section v-else-if="['pending_payment', 'confirmed'].includes(booking.status)" class="mt-6 flex justify-end">
        <button type="button" class="text-xs font-semibold text-ink/45 hover:text-coral" @click="confirmCancel = true">
          Cancel this booking
        </button>
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div class="space-y-6">
          <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
            <h2 class="font-display text-lg font-semibold text-ink">Bikini Selections</h2>
            <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt class="text-ink/45">Top size</dt><dd class="text-ink">{{ booking.topSize }}</dd></div>
              <div><dt class="text-ink/45">Left triangle</dt><dd class="text-ink">{{ booking.leftFabricName }}</dd></div>
              <div><dt class="text-ink/45">Right triangle</dt><dd class="text-ink">{{ booking.rightFabricName }}</dd></div>
              <div><dt class="text-ink/45">Bottom style</dt><dd class="text-ink">{{ booking.bottomStyle === 'tie-side' ? 'Tie-Side' : 'Classic' }}</dd></div>
              <div><dt class="text-ink/45">Coverage</dt><dd class="text-ink">{{ booking.bottomCoverage === 'cheeky' ? 'Cheeky' : 'Bikini' }}</dd></div>
              <div><dt class="text-ink/45">Bottom size</dt><dd class="text-ink">{{ booking.bottomSize }}</dd></div>
              <div><dt class="text-ink/45">Bottom colour</dt><dd class="text-ink">{{ booking.bottomFabricName }}</dd></div>
            </dl>
          </section>

          <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
            <h2 class="font-display text-lg font-semibold text-ink">Payment</h2>
            <dl class="mt-4 space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-ink/45">Package</dt><dd class="text-ink">{{ booking.package === 'the_works' ? 'The Works' : 'Classic Mix' }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink/45">Retail price (EC$)</dt><dd class="text-ink">{{ formatMoney(booking.retailPriceXcdCents, 'XCD') }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink/45">Charged (USD)</dt><dd class="text-ink">{{ booking.chargedUsdCents != null ? formatMoney(booking.chargedUsdCents, 'USD') : '—' }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink/45">Paid at</dt><dd class="text-ink">{{ booking.paidAt ? formatDate(booking.paidAt) : 'Not yet paid' }}</dd></div>
            </dl>
          </section>

          <section v-if="booking.status === 'confirmed'" class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
            <h2 class="font-display text-lg font-semibold text-ink">Confirmation Email</h2>
            <p class="mt-2 text-sm text-ink/60">
              Last sent: <span class="text-ink">{{ booking.paidEmailSentAt ? formatDate(booking.paidEmailSentAt) : 'Not sent yet' }}</span>
            </p>
            <button
              type="button"
              class="btn-outline mt-4 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="resendingEmail"
              @click="resendEmail"
            >
              {{ resendingEmail ? 'Sending…' : 'Resend Confirmation Email' }}
            </button>
            <p v-if="resendSuccess" class="mt-2 text-sm text-ink/60">✓ Email sent.</p>
            <p v-if="resendError" class="mt-2 text-sm text-coral">{{ resendError }}</p>
          </section>
        </div>

        <aside class="space-y-6">
          <section class="rounded-4xl bg-cream p-6 shadow-card">
            <h2 class="font-display text-lg font-semibold text-ink">Guest</h2>
            <p class="mt-3 text-sm text-ink">{{ booking.fullName }}</p>
            <p class="mt-1 break-all text-xs text-ink/55">{{ booking.email }}</p>
            <p class="mt-1 text-xs text-ink/55">{{ booking.whatsapp }}</p>
            <p v-if="booking.personalizationName" class="mt-3 text-xs text-ink/55">
              Personalization: <span class="text-ink">{{ booking.personalizationName }}</span>
            </p>
            <p class="mt-2 text-xs text-ink/40">{{ booking.marketingOptIn ? '✓ Opted in to marketing' : 'Not opted in to marketing' }}</p>
          </section>
        </aside>
      </div>
    </template>

    <div v-if="confirmCancel" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm" @click.self="confirmCancel = false">
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Cancel {{ booking?.bookingNumber }}?</h2>
        <p class="mt-2 text-sm text-ink/60">This records the cancellation. Any refund is processed manually per the approved policy — nothing is charged or refunded automatically here.</p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="resolving" @click="confirmCancel = false">Keep booking</button>
          <button type="button" class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream hover:bg-coral/90 disabled:opacity-60" :disabled="resolving" @click="resolve('cancel')">
            {{ resolving ? 'Cancelling…' : 'Cancel booking' }}
          </button>
        </div>
      </div>
    </div>
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
  `bikini-mix-booking-${route.params.id}`,
  () => {
    notFound.value = false
    return authedFetch(`/api/admin/bikini-mix/bookings/${route.params.id}`).catch((err) => {
      if (err?.statusCode === 404 || err?.response?.status === 404) notFound.value = true
      throw err
    })
  },
  { server: false }
)
const booking = computed(() => data.value?.booking ?? null)

useHead(() => ({
  title: booking.value ? `${booking.value.bookingNumber} — Bikini Mix — Admin — Bahama Mama Swimwear` : 'Booking — Admin — Bahama Mama Swimwear',
  meta: [{ name: 'robots', content: 'noindex' }]
}))

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
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

const resolving = ref(false)
const resolveError = ref('')
const confirmCancel = ref(false)

const resendingEmail = ref(false)
const resendError = ref('')
const resendSuccess = ref(false)
let resendSuccessTimer

async function resendEmail() {
  if (resendingEmail.value) return
  resendingEmail.value = true
  resendError.value = ''
  resendSuccess.value = false
  clearTimeout(resendSuccessTimer)
  try {
    const res = await authedFetch(`/api/admin/bikini-mix/bookings/${route.params.id}/resend-email`, { method: 'POST' })
    if (data.value?.booking) data.value.booking.paidEmailSentAt = res.sentAt
    resendSuccess.value = true
    resendSuccessTimer = setTimeout(() => {
      resendSuccess.value = false
    }, 4000)
  } catch (err) {
    resendError.value = err?.data?.error || 'Could not send the email. Please try again.'
  } finally {
    resendingEmail.value = false
  }
}

async function resolve(resolution) {
  resolving.value = true
  resolveError.value = ''
  try {
    const res = await authedFetch(`/api/admin/bikini-mix/bookings/${route.params.id}`, { method: 'PATCH', body: { resolution } })
    data.value = { booking: res.booking }
    confirmCancel.value = false
  } catch (err) {
    resolveError.value = err?.data?.error || 'Could not update this booking.'
  } finally {
    resolving.value = false
  }
}
</script>
