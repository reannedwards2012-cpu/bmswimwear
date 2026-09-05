<template>
  <div>
    <NuxtLink to="/admin/orders" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
      ← Back to orders
    </NuxtLink>

    <p v-if="pending" class="mt-6 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading order…</p>

    <div v-else-if="loadError" class="mt-6 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">{{ notFound ? 'That order could not be found.' : 'Couldn’t load this order.' }}</p>
      <button v-if="!notFound" type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
      <NuxtLink v-else to="/admin/orders" class="btn-outline mt-4 inline-block">Back to orders</NuxtLink>
    </div>

    <template v-else-if="order">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-2xl font-semibold text-ink md:text-3xl">{{ order.orderNumber }}</h1>
          <p class="mt-1 text-sm text-ink/50">{{ formatDate(order.createdAt) }}</p>
        </div>
        <span class="rounded-full px-4 py-1.5 text-xs font-semibold" :class="statusClass(order.status)">
          {{ statusLabel(order.status) }}
        </span>
      </div>

      <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div class="space-y-8">
          <!-- items -->
          <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
            <h2 class="font-display text-lg font-semibold text-ink">Items</h2>
            <ul class="mt-4 divide-y divide-ink/10 border-t border-ink/10">
              <li v-for="(it, i) in order.items" :key="i" class="flex gap-3 py-4">
                <img :src="it.image" :alt="it.productName" class="aspect-[3/4] w-16 shrink-0 rounded-xl object-cover" />
                <div class="flex min-w-0 flex-1 flex-col justify-center">
                  <p class="text-sm font-medium text-ink">{{ it.productName }}</p>
                  <p v-if="optionText(it)" class="mt-0.5 text-xs text-ink/55">{{ optionText(it) }}</p>
                  <div class="mt-1 flex items-center justify-between text-xs text-ink/55">
                    <span>Qty {{ it.quantity }}</span>
                    <span>{{ money(it.unitPriceUsdCents / 100) }} each</span>
                  </div>
                </div>
              </li>
            </ul>
            <div class="mt-4 flex items-center justify-between border-t border-ink/10 pt-4 text-sm">
              <span class="text-ink/60">Subtotal</span>
              <span class="font-semibold text-ink">USD {{ money(order.subtotalUsdCents / 100) }}</span>
            </div>
          </section>

          <!-- customer notes -->
          <section v-if="order.notes" class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
            <h2 class="font-display text-lg font-semibold text-ink">Customer notes</h2>
            <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">{{ order.notes }}</p>
          </section>

          <!-- admin notes — private, internal, never customer-facing -->
          <section class="rounded-4xl bg-shell/60 p-6 shadow-card ring-1 ring-coral/15 md:p-7">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-display text-lg font-semibold text-ink">Admin notes</h2>
              <span class="rounded-full bg-coral/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-coral">
                Private
              </span>
            </div>
            <p class="mt-1 text-xs text-ink/45">Private note — customers cannot see this.</p>

            <textarea
              v-model="adminNotesDraft"
              rows="5"
              maxlength="5000"
              placeholder="Internal notes for this order…"
              class="mt-3 w-full rounded-2xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
            />

            <div class="mt-3 flex items-center gap-3">
              <button
                type="button"
                class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingNotes || adminNotesDraft === (order.adminNotes ?? '')"
                @click="saveAdminNotes"
              >
                {{ savingNotes ? 'Saving…' : 'Save notes' }}
              </button>
              <span v-if="notesSuccess" class="text-xs text-ink/50">Saved.</span>
            </div>
            <p v-if="notesError" class="mt-2 text-xs text-coral">{{ notesError }}</p>
          </section>
        </div>

        <aside class="space-y-6">
          <!-- status control -->
          <section class="rounded-4xl bg-cream p-6 shadow-card">
            <h2 class="font-display text-lg font-semibold text-ink">Status</h2>
            <p class="mt-1 text-xs text-ink/45">
              Currently <span class="font-semibold text-ink">{{ statusLabel(order.status) }}</span>
            </p>

            <div v-if="availableTransitions.length" class="mt-4 space-y-2">
              <button
                v-for="t in availableTransitions"
                :key="t"
                type="button"
                class="w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="t === 'cancelled' ? 'border border-coral text-coral hover:bg-coral/10' : 'btn-primary'"
                :disabled="updating"
                @click="t === 'cancelled' ? (confirmCancel = true) : applyStatus(t)"
              >
                {{ updating && pendingTarget === t ? 'Updating…' : transitionLabel(t) }}
              </button>
            </div>
            <p v-else class="mt-4 text-xs text-ink/40">No further status changes available.</p>

            <p v-if="statusError" class="mt-3 text-xs text-coral">{{ statusError }}</p>
          </section>

          <!-- customer -->
          <section class="rounded-4xl bg-cream p-6 shadow-card">
            <h2 class="font-display text-lg font-semibold text-ink">Customer</h2>
            <p class="mt-3 text-sm text-ink">{{ order.customer.firstName }} {{ order.customer.lastName }}</p>
            <p class="mt-1 break-all text-xs text-ink/55">{{ order.customer.email }}</p>
            <p class="mt-1 text-xs text-ink/55">{{ order.customer.phone }}</p>
          </section>

          <!-- delivery -->
          <section class="rounded-4xl bg-cream p-6 shadow-card">
            <h2 class="font-display text-lg font-semibold text-ink">Delivery</h2>
            <p class="mt-3 text-sm text-ink">{{ order.delivery.deliveryMethod === 'shipping' ? 'Shipping' : 'Pickup' }}</p>
            <div v-if="order.delivery.deliveryMethod === 'shipping'" class="mt-2 space-y-0.5 text-xs leading-relaxed text-ink/60">
              <p>{{ order.delivery.shippingAddress1 }}</p>
              <p v-if="order.delivery.shippingAddress2">{{ order.delivery.shippingAddress2 }}</p>
              <p>
                {{ order.delivery.shippingCity }}<template v-if="order.delivery.shippingRegion">, {{ order.delivery.shippingRegion }}</template>
              </p>
              <p v-if="order.delivery.shippingPostalCode">{{ order.delivery.shippingPostalCode }}</p>
              <p>{{ order.delivery.shippingCountry }}</p>
            </div>
          </section>
        </aside>
      </div>
    </template>

    <!-- cancel confirmation — a destructive status change, so it's a separate step -->
    <div
      v-if="confirmCancel"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="confirmCancel = false"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Cancel {{ order?.orderNumber }}?</h2>
        <p class="mt-2 text-sm text-ink/60">
          This will mark the order as cancelled. It will not issue or process a refund. Any refund must be handled separately.
        </p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="updating" @click="confirmCancel = false">Keep order</button>
          <button
            type="button"
            class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="updating"
            @click="applyStatus('cancelled')"
          >
            {{ updating ? 'Cancelling…' : 'Cancel order' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { formatUsd } from '~/utils/money'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const { getAccessToken } = useAuth()
const money = formatUsd

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
  })
}

const notFound = ref(false)

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  `admin-order-${route.params.id}`,
  () => {
    notFound.value = false
    return authedFetch(`/api/admin/orders/${route.params.id}`).catch((err) => {
      if (err?.statusCode === 404 || err?.response?.status === 404) notFound.value = true
      throw err
    })
  },
  { server: false }
)

const order = computed(() => data.value?.order ?? null)

// Admin notes — private, editable independently of everything else on the
// order. Loaded with the order, saved via its own endpoint; never touches
// status/paid_at/items/customer data.
const adminNotesDraft = ref('')
const savingNotes = ref(false)
const notesError = ref('')
const notesSuccess = ref(false)
let notesSuccessTimer = null

watch(
  order,
  (o) => {
    if (o) adminNotesDraft.value = o.adminNotes ?? ''
  },
  { immediate: true }
)

async function saveAdminNotes() {
  savingNotes.value = true
  notesError.value = ''
  notesSuccess.value = false
  try {
    const res = await authedFetch(`/api/admin/orders/${route.params.id}/notes`, {
      method: 'PATCH',
      body: { adminNotes: adminNotesDraft.value }
    })
    if (data.value?.order) {
      data.value = { order: { ...data.value.order, adminNotes: res.adminNotes } }
    }
    adminNotesDraft.value = res.adminNotes ?? ''
    notesSuccess.value = true
    clearTimeout(notesSuccessTimer)
    notesSuccessTimer = setTimeout(() => {
      notesSuccess.value = false
    }, 3000)
  } catch (err) {
    notesError.value = err?.data?.error || 'Could not save notes. Please try again.'
  } finally {
    savingNotes.value = false
  }
}

useHead(() => ({
  title: order.value ? `${order.value.orderNumber} — Admin — Bahama Mama Swimwear` : 'Order — Admin — Bahama Mama Swimwear',
  meta: [{ name: 'robots', content: 'noindex' }]
}))

// Mirrors server/utils/orderStatus.js's ADMIN_STATUS_TRANSITIONS — this is
// just for the button labels shown; the server independently re-validates
// every transition regardless of what the UI offers.
const TRANSITIONS = {
  pending: [],
  payment_failed: [],
  paid: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}
const availableTransitions = computed(() => TRANSITIONS[order.value?.status] ?? [])

const TRANSITION_LABELS = { processing: 'Move to Processing', completed: 'Mark Completed', cancelled: 'Cancel order' }
const transitionLabel = (t) => TRANSITION_LABELS[t] || t

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

const optionText = (it) => [it.size, it.colourName, it.coverage].filter(Boolean).join(' · ')

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

const updating = ref(false)
const pendingTarget = ref('')
const statusError = ref('')
const confirmCancel = ref(false)

async function applyStatus(target) {
  updating.value = true
  pendingTarget.value = target
  statusError.value = ''
  try {
    const res = await authedFetch(`/api/admin/orders/${route.params.id}/status`, {
      method: 'PATCH',
      body: { status: target }
    })
    data.value = { order: res.order }
    confirmCancel.value = false
  } catch (err) {
    statusError.value = err?.data?.error || 'Could not update status. Please try again.'
  } finally {
    updating.value = false
    pendingTarget.value = ''
  }
}
</script>
