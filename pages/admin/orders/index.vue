<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Order *management*" size="sm" as="h1" />

    <!-- status filter -->
    <div class="mt-6 flex flex-wrap gap-2">
      <button
        v-for="f in FILTERS"
        :key="f.value"
        type="button"
        class="rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
        :class="activeFilter === f.value ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
        @click="activeFilter = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="pending" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading orders…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load orders.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!orders.length" class="mt-8 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">
        No {{ activeFilter === 'all' ? '' : statusLabel(activeFilter).toLowerCase() + ' ' }}orders yet.
      </p>
    </div>

    <template v-else>
      <!-- desktop table -->
      <div class="mt-8 hidden overflow-x-auto rounded-4xl bg-cream shadow-card md:block">
        <table class="w-full min-w-[54rem] text-left text-sm">
          <thead>
            <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
              <th class="px-5 py-4">Order #</th>
              <th class="px-5 py-4">Date</th>
              <th class="px-5 py-4">Customer</th>
              <th class="px-5 py-4">Total</th>
              <th class="px-5 py-4">Delivery</th>
              <th class="px-5 py-4">Status</th>
              <th class="px-5 py-4" />
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr v-for="o in orders" :key="o.id">
              <td class="px-5 py-4 font-medium text-ink">{{ o.orderNumber }}</td>
              <td class="px-5 py-4 text-ink/70">{{ formatDate(o.createdAt) }}</td>
              <td class="px-5 py-4">
                <p class="text-ink">{{ o.firstName }} {{ o.lastName }}</p>
                <p class="text-xs text-ink/40">{{ o.email }}</p>
              </td>
              <td class="px-5 py-4 text-ink/70">{{ money(o.subtotalUsdCents / 100) }}</td>
              <td class="px-5 py-4 text-ink/70">{{ o.deliveryMethod === 'shipping' ? 'Delivery' : 'Pickup' }}</td>
              <td class="px-5 py-4">
                <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(o.status)">
                  {{ statusLabel(o.status) }}
                </span>
              </td>
              <td class="px-5 py-4 text-right">
                <NuxtLink :to="`/admin/orders/${o.id}`" class="text-xs font-semibold text-coral link-underline">View</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- mobile cards -->
      <ul class="mt-8 space-y-4 md:hidden">
        <li v-for="o in orders" :key="o.id" class="rounded-4xl bg-cream p-5 shadow-card">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-display text-base font-semibold text-ink">{{ o.orderNumber }}</p>
              <p class="mt-0.5 text-xs text-ink/45">{{ formatDate(o.createdAt) }}</p>
            </div>
            <span class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(o.status)">
              {{ statusLabel(o.status) }}
            </span>
          </div>
          <div class="mt-3 space-y-1 text-sm">
            <p class="text-ink">{{ o.firstName }} {{ o.lastName }}</p>
            <p class="text-xs text-ink/45">{{ o.email }}</p>
          </div>
          <div class="mt-3 flex items-center justify-between text-sm">
            <span class="text-ink/60">{{ o.deliveryMethod === 'shipping' ? 'Delivery' : 'Pickup' }}</span>
            <span class="font-semibold text-ink">{{ money(o.subtotalUsdCents / 100) }}</span>
          </div>
          <NuxtLink :to="`/admin/orders/${o.id}`" class="btn-outline mt-4 block w-full text-center">View order</NuxtLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatUsd } from '~/utils/money'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Orders — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
const money = formatUsd

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
  })
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'pending', label: 'Pending' },
  { value: 'payment_failed', label: 'Payment failed' }
]
const activeFilter = ref('all')

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'admin-orders',
  () => authedFetch(`/api/admin/orders${activeFilter.value === 'all' ? '' : `?status=${activeFilter.value}`}`),
  { server: false, watch: [activeFilter] }
)

const orders = computed(() => data.value?.orders ?? [])

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
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
</script>
