<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Custom *Quotes*" size="sm" as="h1" />
    </div>

    <AdminQuoteSubNav class="mt-6" />

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading pricing settings…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load pricing settings.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <form v-else-if="form" class="mt-8 space-y-8" novalidate @submit.prevent="onSave">
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Labour &amp; Production Hours</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="block">
            <span class="lbl">Labour rate (EC$/hr)</span>
            <input v-model="form.labourRateXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Default hours — Basic Bikini</span>
            <input v-model="form.defaultHoursBasicBikini" type="number" min="0" step="0.25" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Default hours — Basic One-Piece</span>
            <input v-model="form.defaultHoursBasicOnepiece" type="number" min="0" step="0.25" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Default hours — Complex Custom</span>
            <input v-model="form.defaultHoursComplexCustom" type="number" min="0" step="0.25" class="inp" />
          </label>
        </div>
      </section>

      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Fabric Defaults</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="block">
            <span class="lbl">Solid fabric (EC$/yd)</span>
            <input v-model="form.fabricCostSolidXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Printed fabric (EC$/yd)</span>
            <input v-model="form.fabricCostPrintedXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Consumption — bikini (yd)</span>
            <input v-model="form.fabricConsumptionBikiniYards" type="number" min="0" step="0.1" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Consumption — one-piece (yd)</span>
            <input v-model="form.fabricConsumptionOnepieceYards" type="number" min="0" step="0.1" class="inp" />
          </label>
        </div>
        <p class="mt-2 text-xs text-ink/40">
          A fabric's own recorded landed cost (see Fabric Inventory) is used automatically when one is selected on a quote;
          these rates are the fallback when no fabric cost is recorded, or for Custom fabric.
        </p>
      </section>

      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Materials &amp; Overhead</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label class="block">
            <span class="lbl">Packaging (EC$/suit)</span>
            <input v-model="form.packagingXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Consumables (EC$/suit)</span>
            <input v-model="form.consumablesXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Fitting allowance (EC$)</span>
            <input v-model="form.fittingAllowanceXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Electricity (EC$/month)</span>
            <input v-model="form.electricityMonthlyXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Machine maintenance (EC$/month)</span>
            <input v-model="form.machineMaintenanceMonthlyXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Expected production volume (units/month)</span>
            <input v-model="form.expectedMonthlyVolume" type="number" min="1" step="1" class="inp" />
          </label>
        </div>
        <p class="mt-2 text-xs text-ink/40">
          Fixed monthly overhead (electricity + machine maintenance) is spread evenly across the expected monthly volume
          to get the per-quote overhead allocation.
        </p>
      </section>

      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Design Development Fees</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="lbl">Minor (EC$)</span>
            <input v-model="form.designFeeMinorXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">New custom design (EC$)</span>
            <input v-model="form.designFeeNewXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Complex (EC$)</span>
            <input v-model="form.designFeeComplexXcdDollars" type="number" min="0" step="0.01" class="inp" />
          </label>
        </div>
      </section>

      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Pricing &amp; Deposit</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Target profit margin (%)</span>
            <input v-model="form.targetMarginPercent" type="number" min="0" max="99" step="1" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Deposit (%)</span>
            <input v-model="form.depositPercent" type="number" min="0" max="100" step="1" class="inp" />
          </label>
        </div>
      </section>

      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Minimum Selling Prices</h2>
        <p class="mt-1 text-xs text-ink/50">The higher of the calculated price and the category minimum is always used, rounded up to the nearest EC$5.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="block">
            <span class="lbl">Basic Bikini (EC$)</span>
            <input v-model="form.minPriceBasicBikiniXcdDollars" type="number" min="0" step="1" placeholder="—" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Basic One-Piece (EC$)</span>
            <input v-model="form.minPriceBasicOnepieceXcdDollars" type="number" min="0" step="1" placeholder="—" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Complex Custom (EC$)</span>
            <input v-model="form.minPriceComplexCustomXcdDollars" type="number" min="0" step="1" placeholder="—" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Other/Custom (EC$)</span>
            <input v-model="form.minPriceOtherCustomXcdDollars" type="number" min="0" step="1" placeholder="No minimum" class="inp" />
          </label>
        </div>
      </section>

      <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
      <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
        <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
      </ul>

      <div class="flex justify-end">
        <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Quote Settings — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData('quote-pricing-settings', () => authedFetch('/api/admin/quotes/settings'), {
  server: false
})

const centsToInput = (c) => (typeof c === 'number' ? (c / 100).toFixed(2) : '')
const toCentsOrNull = (v) => (v === '' || v === null || v === undefined ? null : Math.round(Number(v) * 100))
const toCentsOrUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : Math.round(Number(v) * 100))

function fromSettings(s) {
  return {
    labourRateXcdDollars: centsToInput(s.labourRateXcdCents),
    defaultHoursBasicBikini: s.defaultHoursBasicBikini ?? 2,
    defaultHoursBasicOnepiece: s.defaultHoursBasicOnepiece ?? 2,
    defaultHoursComplexCustom: s.defaultHoursComplexCustom ?? 5,
    fabricCostSolidXcdDollars: centsToInput(s.fabricCostSolidXcdCents),
    fabricCostPrintedXcdDollars: centsToInput(s.fabricCostPrintedXcdCents),
    fabricConsumptionBikiniYards: s.fabricConsumptionBikiniYards ?? 0.5,
    fabricConsumptionOnepieceYards: s.fabricConsumptionOnepieceYards ?? 1,
    packagingXcdDollars: centsToInput(s.packagingXcdCents),
    consumablesXcdDollars: centsToInput(s.consumablesXcdCents),
    fittingAllowanceXcdDollars: centsToInput(s.fittingAllowanceXcdCents),
    electricityMonthlyXcdDollars: centsToInput(s.electricityMonthlyXcdCents),
    machineMaintenanceMonthlyXcdDollars: centsToInput(s.machineMaintenanceMonthlyXcdCents),
    expectedMonthlyVolume: s.expectedMonthlyVolume ?? 20,
    designFeeMinorXcdDollars: centsToInput(s.designFeeMinorXcdCents),
    designFeeNewXcdDollars: centsToInput(s.designFeeNewXcdCents),
    designFeeComplexXcdDollars: centsToInput(s.designFeeComplexXcdCents),
    targetMarginPercent: s.targetMarginPercent ?? 30,
    depositPercent: s.depositPercent ?? 50,
    minPriceBasicBikiniXcdDollars: centsToInput(s.minPriceBasicBikiniXcdCents),
    minPriceBasicOnepieceXcdDollars: centsToInput(s.minPriceBasicOnepieceXcdCents),
    minPriceComplexCustomXcdDollars: centsToInput(s.minPriceComplexCustomXcdCents),
    minPriceOtherCustomXcdDollars: centsToInput(s.minPriceOtherCustomXcdCents)
  }
}

const form = ref(null)
watch(
  () => data.value?.settings,
  (s) => {
    if (s && !form.value) form.value = reactive(fromSettings(s))
  },
  { immediate: true }
)

const saving = ref(false)
const formError = ref('')
const formIssues = ref([])
const savedMessage = ref('')
let savedTimer = null

async function onSave() {
  saving.value = true
  formError.value = ''
  formIssues.value = []

  const f = form.value
  const payload = {
    labourRateXcdCents: toCentsOrUndefined(f.labourRateXcdDollars),
    defaultHoursBasicBikini: f.defaultHoursBasicBikini === '' ? undefined : Number(f.defaultHoursBasicBikini),
    defaultHoursBasicOnepiece: f.defaultHoursBasicOnepiece === '' ? undefined : Number(f.defaultHoursBasicOnepiece),
    defaultHoursComplexCustom: f.defaultHoursComplexCustom === '' ? undefined : Number(f.defaultHoursComplexCustom),
    fabricCostSolidXcdCents: toCentsOrUndefined(f.fabricCostSolidXcdDollars),
    fabricCostPrintedXcdCents: toCentsOrUndefined(f.fabricCostPrintedXcdDollars),
    fabricConsumptionBikiniYards: f.fabricConsumptionBikiniYards === '' ? undefined : Number(f.fabricConsumptionBikiniYards),
    fabricConsumptionOnepieceYards: f.fabricConsumptionOnepieceYards === '' ? undefined : Number(f.fabricConsumptionOnepieceYards),
    packagingXcdCents: toCentsOrUndefined(f.packagingXcdDollars),
    consumablesXcdCents: toCentsOrUndefined(f.consumablesXcdDollars),
    fittingAllowanceXcdCents: toCentsOrUndefined(f.fittingAllowanceXcdDollars),
    electricityMonthlyXcdCents: toCentsOrUndefined(f.electricityMonthlyXcdDollars),
    machineMaintenanceMonthlyXcdCents: toCentsOrUndefined(f.machineMaintenanceMonthlyXcdDollars),
    expectedMonthlyVolume: f.expectedMonthlyVolume === '' ? undefined : Number(f.expectedMonthlyVolume),
    designFeeMinorXcdCents: toCentsOrUndefined(f.designFeeMinorXcdDollars),
    designFeeNewXcdCents: toCentsOrUndefined(f.designFeeNewXcdDollars),
    designFeeComplexXcdCents: toCentsOrUndefined(f.designFeeComplexXcdDollars),
    targetMarginPercent: f.targetMarginPercent === '' ? undefined : Number(f.targetMarginPercent),
    depositPercent: f.depositPercent === '' ? undefined : Number(f.depositPercent),
    minPriceBasicBikiniXcdCents: toCentsOrNull(f.minPriceBasicBikiniXcdDollars),
    minPriceBasicOnepieceXcdCents: toCentsOrNull(f.minPriceBasicOnepieceXcdDollars),
    minPriceComplexCustomXcdCents: toCentsOrNull(f.minPriceComplexCustomXcdDollars),
    minPriceOtherCustomXcdCents: toCentsOrNull(f.minPriceOtherCustomXcdDollars)
  }

  try {
    const res = await authedFetch('/api/admin/quotes/settings', { method: 'PATCH', body: payload })
    form.value = reactive(fromSettings(res.settings))
    data.value = { settings: res.settings }
    clearTimeout(savedTimer)
    savedMessage.value = 'Saved.'
    savedTimer = setTimeout(() => (savedMessage.value = ''), 3000)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving these settings.'
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
