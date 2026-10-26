<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Custom *Quotes*" size="sm" as="h1" />
    </div>

    <AdminQuoteSubNav class="mt-6" />

    <p v-if="pending" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading quote…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load this quote.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else class="mt-8 space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-4xl bg-cream p-5 shadow-card">
        <div class="flex items-center gap-3">
          <h2 class="font-display text-lg font-semibold text-ink">{{ quote.quoteNumber }}</h2>
          <AdminQuoteStatusBadge :status="quote.status" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="copying" @click="onCopyQuote">
            {{ copied ? 'Copied!' : 'Copy Quote' }}
          </button>
          <button type="button" class="btn-outline px-4 py-1.5 text-xs disabled:opacity-60" :disabled="duplicating" @click="onDuplicate">
            {{ duplicating ? 'Duplicating…' : 'Duplicate' }}
          </button>
        </div>
      </div>

      <AdminQuoteCalculatorForm
        :quote="quote"
        :settings="data.settings.settings"
        :fabrics="data.fabrics.fabrics"
        :saving="saving"
        :form-error="formError"
        :form-issues="formIssues"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney } from '~/utils/money.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Quote — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const id = route.params.id

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  `quote-${id}`,
  () =>
    Promise.all([
      authedFetch(`/api/admin/quotes/${id}`),
      authedFetch('/api/admin/quotes/settings'),
      authedFetch('/api/admin/fabrics')
    ]).then(([quote, settings, fabrics]) => ({ quote, settings, fabrics })),
  { server: false }
)

const quote = computed(() => data.value?.quote?.quote)

const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

async function onSubmit(payload) {
  saving.value = true
  formError.value = ''
  formIssues.value = []
  try {
    const res = await authedFetch(`/api/admin/quotes/${id}`, { method: 'PATCH', body: payload })
    data.value = { ...data.value, quote: { quote: res.quote } }
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving this quote.'
    formIssues.value = err?.data?.issues || []
  } finally {
    saving.value = false
  }
}

const duplicating = ref(false)
async function onDuplicate() {
  duplicating.value = true
  try {
    const res = await authedFetch(`/api/admin/quotes/${id}/duplicate`, { method: 'POST' })
    await navigateTo(`/admin/quotes/${res.quote.id}`)
  } catch (err) {
    formError.value = err?.data?.error || 'Could not duplicate this quote.'
  } finally {
    duplicating.value = false
  }
}

// ── Copy Quote — customer-safe text only, built entirely client-side from
// data already in this admin's browser. Deliberately excludes labour
// rates, cost breakdown and margins (see server/utils/quoteMappers.js's
// mapQuoteCustomerSummary, which this mirrors). ──
const copying = ref(false)
const copied = ref(false)
function onCopyQuote() {
  const q = quote.value
  if (!q) return
  const outputs = q.calculation?.outputs ?? {}
  const lines = [
    `Quote ${q.quoteNumber} — ${q.customerName}`,
    q.description ? q.description : null,
    `Price: ${formatMoney(q.finalPriceXcdCents, 'XCD')}`,
    outputs.depositXcdCents != null ? `Deposit required: ${formatMoney(outputs.depositXcdCents, 'XCD')}` : null,
    outputs.remainingBalanceXcdCents != null ? `Remaining balance: ${formatMoney(outputs.remainingBalanceXcdCents, 'XCD')}` : null,
    q.customerNotes ? q.customerNotes : null
  ].filter(Boolean)

  copying.value = true
  navigator.clipboard
    .writeText(lines.join('\n'))
    .then(() => {
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    })
    .finally(() => (copying.value = false))
}
</script>
