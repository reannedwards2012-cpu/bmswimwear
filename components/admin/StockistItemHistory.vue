<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6" @click.self="$emit('close')">
    <div class="max-h-[85vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-card sm:max-w-md sm:rounded-4xl sm:p-7">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">History</h2>
          <p class="text-xs text-ink/45">{{ item.productName }}<span v-if="variantText"> · {{ variantText }}</span></p>
        </div>
        <button type="button" class="text-ink/40 transition-colors hover:text-ink" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <p v-if="pending" class="mt-6 text-sm text-ink/45">Loading history…</p>
      <p v-else-if="loadError" class="mt-6 text-sm text-coral">Couldn’t load history.</p>
      <p v-else-if="!movements.length" class="mt-6 text-sm text-ink/45">No movements recorded yet.</p>

      <ul v-else class="mt-5 space-y-3 border-t border-ink/10 pt-4">
        <li v-for="m in movements" :key="m.id" class="flex items-start justify-between gap-3 text-sm">
          <div>
            <p class="font-medium text-ink">{{ LABELS[m.type] || m.type }} {{ m.quantity }}</p>
            <p v-if="m.type === 'sold'" class="text-xs text-ink/45">
              {{ formatMoney(m.saleUnitPriceCents, 'XCD') }} each · {{ (m.saleCommissionBps / 100).toFixed(1) }}% commission
            </p>
            <p v-if="m.note" class="mt-0.5 text-xs text-ink/50">{{ m.note }}</p>
          </div>
          <span class="shrink-0 text-xs text-ink/40">{{ formatDate(m.occurredOn) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatMoney } from '~/utils/money'

const props = defineProps({
  stockistId: { type: String, required: true },
  item: { type: Object, required: true }
})
defineEmits(['close'])

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const variantText = computed(() => [props.item.colour, props.item.size, props.item.coverage].filter(Boolean).join(' · '))

const { data, pending, error: loadError } = useLazyAsyncData(
  `stockist-item-history-${props.item.id}`,
  () => authedFetch(`/api/admin/stockists/${props.stockistId}/items/${props.item.id}/movements`),
  { server: false }
)
const movements = computed(() => data.value?.movements ?? [])

const LABELS = { sent: 'Sent', restock: 'Restocked', sold: 'Sold', returned: 'Returned', removed: 'Removed' }

function formatDate(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
</script>
