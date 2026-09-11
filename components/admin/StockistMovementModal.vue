<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm" @click.self="$emit('cancel')">
    <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
      <h2 class="font-display text-lg font-semibold text-ink">{{ TITLES[type] }}</h2>
      <p class="mt-1 text-xs text-ink/45">
        {{ item.productName }}
        <span v-if="variantText"> · {{ variantText }}</span>
        — {{ item.remainingQuantity }} remaining
      </p>

      <form class="mt-5 space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="lbl">Quantity</span>
            <input v-model="form.quantity" type="number" min="1" :max="maxQuantity" step="1" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Date</span>
            <input v-model="form.occurredOn" type="date" class="inp" />
          </label>
        </div>

        <template v-if="type === 'sold'">
          <div class="grid grid-cols-2 gap-4">
            <label class="block">
              <span class="lbl">Sale price (XCD)</span>
              <input v-model="form.retailPrice" type="number" min="0" step="0.01" class="inp" />
            </label>
            <label class="block">
              <span class="lbl">Commission %</span>
              <input v-model="form.commission" type="number" min="0" max="100" step="0.1" class="inp" />
            </label>
          </div>
          <p class="text-xs text-ink/45">{{ saleBreakdown }}</p>
        </template>

        <label class="block">
          <span class="lbl">Note (optional)</span>
          <textarea v-model.trim="form.note" rows="2" class="inp" />
        </label>

        <p v-if="maxQuantity !== null && Number(form.quantity) > maxQuantity" class="text-xs text-coral">
          Only {{ maxQuantity }} remaining.
        </p>
        <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
        <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
          <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
        </ul>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button type="button" class="btn-outline" :disabled="saving" @click="$emit('cancel')">Cancel</button>
          <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
            {{ saving ? 'Saving…' : TITLES[type] }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { formatMoney } from '~/utils/money'

const props = defineProps({
  stockistId: { type: String, required: true },
  item: { type: Object, required: true },
  // 'restock' | 'sold' | 'returned' | 'removed'
  type: { type: String, required: true }
})
const emit = defineEmits(['saved', 'cancel'])

const TITLES = { restock: 'Restock', sold: 'Mark Sold', returned: 'Return', removed: 'Remove / Adjust' }

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const today = () => new Date().toISOString().slice(0, 10)
const bpsToPercent = (bps) => (typeof bps === 'number' ? (bps / 100).toString() : '')
const centsToInput = (c) => (typeof c === 'number' ? (c / 100).toFixed(2) : '')

const form = reactive({
  quantity: '1',
  occurredOn: today(),
  retailPrice: centsToInput(props.item.retailPriceCents),
  commission: bpsToPercent(props.item.defaultCommissionBps),
  note: ''
})

const variantText = computed(() => [props.item.colour, props.item.size, props.item.coverage].filter(Boolean).join(' · '))

// Only sale/return/remove are bounded by what's left — restock has no ceiling.
const maxQuantity = computed(() => (props.type === 'restock' ? null : props.item.remainingQuantity))

const saleBreakdown = computed(() => {
  const price = Number(form.retailPrice)
  const qty = Number(form.quantity)
  const commissionPct = Number(form.commission)
  if (!Number.isFinite(price) || !Number.isFinite(qty) || !Number.isFinite(commissionPct) || qty <= 0) return ''
  const retailCents = Math.round(price * 100) * qty
  const commissionCents = Math.round((retailCents * commissionPct) / 100)
  const proceedsCents = retailCents - commissionCents
  return `Retail ${formatMoney(retailCents, 'XCD')} · Commission ${formatMoney(commissionCents, 'XCD')} · Bahama Mama ${formatMoney(proceedsCents, 'XCD')}`
})

const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

function toCentsOrNull(v) {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
function toBpsOrNull(v) {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

async function onSubmit() {
  formError.value = ''
  formIssues.value = []

  const payload = {
    type: props.type,
    quantity: form.quantity === '' ? undefined : Number(form.quantity),
    occurredOn: form.occurredOn || undefined,
    note: form.note || null,
    ...(props.type === 'sold'
      ? { saleUnitPriceCents: toCentsOrNull(form.retailPrice), saleCommissionBps: toBpsOrNull(form.commission) }
      : {})
  }

  saving.value = true
  try {
    const res = await authedFetch(`/api/admin/stockists/${props.stockistId}/items/${props.item.id}/movements`, {
      method: 'POST',
      body: payload
    })
    emit('saved', res.item)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong recording this.'
    formIssues.value = err?.data?.issues || []
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.lbl {
  @apply text-xs font-semibold uppercase tracking-widest2 text-ink/60;
}
.inp {
  @apply mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none;
}
</style>
