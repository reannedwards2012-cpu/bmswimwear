<template>
  <form class="space-y-8" novalidate @submit.prevent="onSubmit">
    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Customer &amp; Swimsuit</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="lbl">Customer name</span>
          <input v-model.trim="form.customerName" type="text" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Status</span>
          <select v-model="form.status" class="inp">
            <option v-for="s in QUOTE_STATUSES" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Email</span>
          <input v-model.trim="form.customerEmail" type="email" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Phone / WhatsApp</span>
          <input v-model.trim="form.customerPhone" type="text" class="inp" />
        </label>
        <label class="block sm:col-span-2">
          <span class="lbl">Swimsuit description</span>
          <textarea v-model.trim="form.description" rows="2" class="inp" placeholder="e.g. Triangle bikini, royal blue mesh, gold ring detail" />
        </label>
        <label class="block">
          <span class="lbl">Category</span>
          <select v-model="form.category" class="inp" @change="onCategoryChange">
            <option v-for="c in QUOTE_CATEGORIES" :key="c" :value="c">{{ QUOTE_CATEGORY_LABELS[c] }}</option>
          </select>
        </label>
      </div>

      <div class="mt-5">
        <p class="lbl">Inspiration images <span class="font-normal normal-case text-ink/35">(optional)</span></p>
        <div class="mt-2 flex flex-wrap gap-3">
          <div v-for="(url, i) in form.inspirationImageUrls" :key="url" class="relative h-20 w-20 overflow-hidden rounded-2xl border border-ink/10">
            <img :src="url" alt="" class="h-full w-full object-cover" />
            <button
              type="button"
              class="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-xs text-cream"
              @click="removeImage(i)"
            >
              ✕
            </button>
          </div>
          <button
            type="button"
            class="grid h-20 w-20 place-items-center rounded-2xl border border-dashed border-ink/25 text-xs text-ink/40 disabled:opacity-60"
            :disabled="uploadingImage"
            @click="fileInput?.click()"
          >
            {{ uploadingImage ? '…' : '+ Add' }}
          </button>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onImageSelected" />
        </div>
        <p v-if="imageUploadError" class="mt-1.5 text-xs text-coral">{{ imageUploadError }}</p>
      </div>
    </section>

    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Production Labour</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="lbl">Production hours</span>
          <input v-model="form.productionHours" type="number" min="0" step="0.25" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Labour rate (EC$/hr)</span>
          <input v-model="form.labourRateXcdDollars" type="number" min="0" step="0.01" class="inp" />
        </label>
      </div>
    </section>

    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Fabric</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="lbl">Fabric (optional — auto-fills cost)</span>
          <select v-model="form.fabricId" class="inp" @change="onFabricChange">
            <option value="">Custom / manual entry</option>
            <option v-for="f in fabrics" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Fabric type</span>
          <select v-model="form.fabricType" class="inp" @change="onFabricTypeChange">
            <option value="solid">Solid</option>
            <option value="printed">Printed</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Cost per yard (EC$)</span>
          <input v-model="form.fabricCostPerYardXcdDollars" type="number" min="0" step="0.01" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Yards needed (incl. lining)</span>
          <input v-model="form.fabricYards" type="number" min="0" step="0.1" class="inp" />
        </label>
      </div>
      <p class="mt-2 text-xs text-ink/40">
        Selecting a fabric with a recorded landed cost (shipping + import included) fills in the cost per yard automatically —
        it's still fully editable.
      </p>
    </section>

    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Materials &amp; Overhead</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="block">
          <span class="lbl">Packaging (EC$)</span>
          <input v-model="form.packagingXcdDollars" type="number" min="0" step="0.01" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Thread / elastic / consumables (EC$)</span>
          <input v-model="form.consumablesXcdDollars" type="number" min="0" step="0.01" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Additional materials / hardware (EC$)</span>
          <input v-model="form.additionalMaterialsXcdDollars" type="number" min="0" step="0.01" class="inp" />
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
          <span class="lbl">Expected volume (units/month)</span>
          <input v-model="form.expectedMonthlyVolume" type="number" min="1" step="1" class="inp" />
        </label>
      </div>
    </section>

    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Design Development <span class="text-xs font-normal normal-case text-ink/40">(optional)</span></h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="lbl">Tier</span>
          <select v-model="form.designOption" class="inp" @change="onDesignOptionChange">
            <option value="none">None</option>
            <option value="minor">Minor</option>
            <option value="new">New custom design</option>
            <option value="complex">Complex</option>
            <option value="custom">Custom amount</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Design fee (EC$)</span>
          <input v-model="form.designFeeXcdDollars" type="number" min="0" step="0.01" class="inp" :disabled="form.designOption !== 'custom'" />
        </label>
        <label class="block">
          <span class="lbl">Design hours <span class="text-ink/35">(reference)</span></span>
          <input v-model="form.designHours" type="number" min="0" step="0.25" class="inp" />
        </label>
        <label class="flex items-end pb-2.5">
          <span class="flex items-center gap-2 text-sm text-ink/70">
            <input v-model="form.designHoursBillable" type="checkbox" class="h-4 w-4 accent-coral" />
            Also bill these hours at the labour rate
          </span>
        </label>
      </div>
      <p class="mt-1 text-xs text-ink/40">
        Off by default to avoid double-counting — design hours are informational only unless this is checked.
      </p>
    </section>

    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Pricing</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="block">
          <span class="lbl">Fitting allowance (EC$)</span>
          <input v-model="form.fittingAllowanceXcdDollars" type="number" min="0" step="0.01" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Target margin (%)</span>
          <input v-model="form.targetMarginPercent" type="number" min="0" max="99" step="1" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Deposit (%)</span>
          <input v-model="form.depositPercent" type="number" min="0" max="100" step="1" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Category minimum (EC$)</span>
          <input v-model="form.categoryMinimumXcdDollars" type="number" min="0" step="1" placeholder="No minimum" class="inp" />
        </label>
        <label class="block sm:col-span-2">
          <span class="lbl">Final price override (EC$) <span class="text-ink/35">— leave blank to use the suggested price</span></span>
          <input v-model="form.finalPriceOverrideXcdDollars" type="number" min="0" step="1" placeholder="—" class="inp" />
        </label>
      </div>
    </section>

    <section class="rounded-4xl bg-ink p-6 text-cream shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold">Price Breakdown</h2>
      <dl class="mt-4 space-y-1.5 text-sm">
        <div class="flex justify-between"><dt class="text-cream/60">Fabric</dt><dd>{{ fmt(calc.outputs.fabricCostXcdCents) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Packaging</dt><dd>{{ fmt(toCents(form.packagingXcdDollars)) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Consumables</dt><dd>{{ fmt(toCents(form.consumablesXcdDollars)) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Additional materials</dt><dd>{{ fmt(toCents(form.additionalMaterialsXcdDollars)) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Production labour</dt><dd>{{ fmt(calc.outputs.productionLabourXcdCents) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Design development</dt><dd>{{ fmt(calc.outputs.designDevelopmentXcdCents) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Fitting allowance</dt><dd>{{ fmt(toCents(form.fittingAllowanceXcdDollars)) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Overhead allocation</dt><dd>{{ fmt(calc.outputs.overheadAllocationXcdCents) }}</dd></div>
        <div class="mt-2 flex justify-between border-t border-cream/15 pt-2 font-semibold"><dt>Estimated cost</dt><dd>{{ fmt(calc.outputs.estimatedCostXcdCents) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Suggested price</dt><dd>{{ fmt(calc.outputs.suggestedPriceXcdCents) }}</dd></div>
        <div v-if="calc.outputs.minimumAppliedXcdCents != null" class="flex justify-between text-xs text-cream/60">
          <dt>Category minimum applied</dt><dd>{{ fmt(calc.outputs.minimumAppliedXcdCents) }}</dd>
        </div>
        <div class="mt-2 flex justify-between border-t border-cream/15 pt-2 text-lg font-bold">
          <dt>Final quoted price</dt><dd>{{ fmt(calc.outputs.finalPriceXcdCents) }}</dd>
        </div>
        <div class="flex justify-between"><dt class="text-cream/60">Estimated profit</dt><dd>{{ fmt(calc.outputs.profitXcdCents) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Actual margin</dt><dd>{{ calc.outputs.actualMarginPercent.toFixed(1) }}%</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Deposit due</dt><dd>{{ fmt(calc.outputs.depositXcdCents) }}</dd></div>
        <div class="flex justify-between"><dt class="text-cream/60">Remaining balance</dt><dd>{{ fmt(calc.outputs.remainingBalanceXcdCents) }}</dd></div>
      </dl>
    </section>

    <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
      <h2 class="font-display text-lg font-semibold text-ink">Notes</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="lbl">Customer-facing notes <span class="text-ink/35">(shown on the customer summary)</span></span>
          <textarea v-model.trim="form.customerNotes" rows="3" class="inp" />
        </label>
        <label class="block">
          <span class="lbl">Admin notes <span class="text-ink/35">(private)</span></span>
          <textarea v-model.trim="form.adminNotes" rows="3" class="inp" />
        </label>
      </div>
    </section>

    <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
    <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
      <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
    </ul>

    <div class="flex items-center justify-end gap-3">
      <button v-if="showCancel" type="button" class="btn-outline" @click="$emit('cancel')">Cancel</button>
      <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
        {{ saving ? 'Saving…' : quote ? 'Save changes' : 'Save quote' }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { formatMoney } from '~/utils/money.js'
import { calculateQuote, QUOTE_CATEGORIES, QUOTE_CATEGORY_LABELS } from '~/utils/quoteCalculator.js'

const props = defineProps({
  // null = creating a new quote; a mapQuoteDetail-shaped object = editing.
  quote: { type: Object, default: null },
  settings: { type: Object, required: true },
  fabrics: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
  formError: { type: String, default: '' },
  formIssues: { type: Array, default: () => [] },
  showCancel: { type: Boolean, default: false }
})
const emit = defineEmits(['submit', 'cancel'])

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired']
const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired' }

const DESIGN_FEE_FIELD_BY_OPTION = {
  none: () => 0,
  minor: (s) => s.designFeeMinorXcdCents,
  new: (s) => s.designFeeNewXcdCents,
  complex: (s) => s.designFeeComplexXcdCents
}

const CATEGORY_DEFAULTS = {
  basic_bikini: { hours: 'defaultHoursBasicBikini', yards: 'fabricConsumptionBikiniYards', min: 'minPriceBasicBikiniXcdCents' },
  basic_onepiece: { hours: 'defaultHoursBasicOnepiece', yards: 'fabricConsumptionOnepieceYards', min: 'minPriceBasicOnepieceXcdCents' },
  complex_custom: { hours: 'defaultHoursComplexCustom', yards: null, min: 'minPriceComplexCustomXcdCents' },
  other_custom: { hours: null, yards: null, min: 'minPriceOtherCustomXcdCents' }
}

const centsToInput = (c) => (typeof c === 'number' && c != null ? (c / 100).toFixed(2) : '')
const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0)
const toCents = (v) => Math.round(num(v) * 100)
const toCentsOrNull = (v) => (v === '' || v === null || v === undefined ? null : Math.round(Number(v) * 100))

function blankForm() {
  const s = props.settings
  return {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    description: '',
    category: 'basic_bikini',
    status: 'draft',
    inspirationImageUrls: [],
    productionHours: s.defaultHoursBasicBikini ?? 2,
    labourRateXcdDollars: centsToInput(s.labourRateXcdCents),
    fabricId: '',
    fabricType: 'solid',
    fabricCostPerYardXcdDollars: centsToInput(s.fabricCostSolidXcdCents),
    fabricYards: s.fabricConsumptionBikiniYards ?? 0.5,
    packagingXcdDollars: centsToInput(s.packagingXcdCents),
    consumablesXcdDollars: centsToInput(s.consumablesXcdCents),
    additionalMaterialsXcdDollars: '',
    electricityMonthlyXcdDollars: centsToInput(s.electricityMonthlyXcdCents),
    machineMaintenanceMonthlyXcdDollars: centsToInput(s.machineMaintenanceMonthlyXcdCents),
    expectedMonthlyVolume: s.expectedMonthlyVolume ?? 20,
    designOption: 'none',
    designFeeXcdDollars: '0.00',
    designHours: '',
    designHoursBillable: false,
    fittingAllowanceXcdDollars: centsToInput(s.fittingAllowanceXcdCents),
    targetMarginPercent: s.targetMarginPercent ?? 30,
    depositPercent: s.depositPercent ?? 50,
    categoryMinimumXcdDollars: centsToInput(s.minPriceBasicBikiniXcdCents),
    finalPriceOverrideXcdDollars: '',
    customerNotes: '',
    adminNotes: ''
  }
}

function fromQuote(q) {
  const inputs = q.calculation?.inputs ?? {}
  return {
    customerName: q.customerName ?? '',
    customerEmail: q.customerEmail ?? '',
    customerPhone: q.customerPhone ?? '',
    description: q.description ?? '',
    category: q.category ?? 'basic_bikini',
    status: q.status ?? 'draft',
    inspirationImageUrls: [...(q.inspirationImageUrls ?? [])],
    productionHours: inputs.productionHours ?? 0,
    labourRateXcdDollars: centsToInput(inputs.labourRateXcdCents),
    fabricId: '',
    fabricType: 'custom',
    fabricCostPerYardXcdDollars: centsToInput(inputs.fabricCostPerYardXcdCents),
    fabricYards: inputs.fabricYards ?? 0,
    packagingXcdDollars: centsToInput(inputs.packagingXcdCents),
    consumablesXcdDollars: centsToInput(inputs.consumablesXcdCents),
    additionalMaterialsXcdDollars: centsToInput(inputs.additionalMaterialsXcdCents),
    electricityMonthlyXcdDollars: centsToInput(inputs.electricityMonthlyXcdCents),
    machineMaintenanceMonthlyXcdDollars: centsToInput(inputs.machineMaintenanceMonthlyXcdCents),
    expectedMonthlyVolume: inputs.expectedMonthlyVolume ?? 20,
    designOption: 'custom',
    designFeeXcdDollars: centsToInput(inputs.designFeeXcdCents),
    designHours: inputs.designHours ?? '',
    designHoursBillable: inputs.designHoursBillable ?? false,
    fittingAllowanceXcdDollars: centsToInput(inputs.fittingAllowanceXcdCents),
    targetMarginPercent: inputs.targetMarginPercent ?? 30,
    depositPercent: inputs.depositPercent ?? 50,
    categoryMinimumXcdDollars: centsToInput(inputs.categoryMinimumXcdCents),
    finalPriceOverrideXcdDollars: centsToInput(inputs.finalPriceOverrideXcdCents),
    customerNotes: q.customerNotes ?? '',
    adminNotes: q.adminNotes ?? ''
  }
}

// The parent remounts this component per open (v-if) in edit flows, so props
// are fresh at setup time — matches FabricForm.vue's convention.
const form = reactive(props.quote ? fromQuote(props.quote) : blankForm())

function onCategoryChange() {
  const def = CATEGORY_DEFAULTS[form.category]
  if (!def) return
  if (def.hours) form.productionHours = props.settings[def.hours]
  if (def.yards) form.fabricYards = props.settings[def.yards]
  form.categoryMinimumXcdDollars = centsToInput(props.settings[def.min])
}

function onFabricTypeChange() {
  if (form.fabricType === 'solid') form.fabricCostPerYardXcdDollars = centsToInput(props.settings.fabricCostSolidXcdCents)
  else if (form.fabricType === 'printed') form.fabricCostPerYardXcdDollars = centsToInput(props.settings.fabricCostPrintedXcdCents)
}

function onFabricChange() {
  if (!form.fabricId) return
  const fabric = props.fabrics.find((f) => f.id === form.fabricId)
  if (fabric?.unitCostXcdCents != null) {
    form.fabricCostPerYardXcdDollars = centsToInput(fabric.unitCostXcdCents)
  }
}

function onDesignOptionChange() {
  const resolver = DESIGN_FEE_FIELD_BY_OPTION[form.designOption]
  if (resolver) form.designFeeXcdDollars = centsToInput(resolver(props.settings))
}

// ── live calculation preview — same pure function the server recomputes
// with before saving, so what the admin sees here IS what gets stored. ──
const calc = computed(() =>
  calculateQuote({
    category: form.category,
    productionHours: num(form.productionHours),
    labourRateXcdCents: toCents(form.labourRateXcdDollars),
    fabricCostPerYardXcdCents: toCents(form.fabricCostPerYardXcdDollars),
    fabricYards: num(form.fabricYards),
    packagingXcdCents: toCents(form.packagingXcdDollars),
    consumablesXcdCents: toCents(form.consumablesXcdDollars),
    additionalMaterialsXcdCents: toCents(form.additionalMaterialsXcdDollars),
    electricityMonthlyXcdCents: toCents(form.electricityMonthlyXcdDollars),
    machineMaintenanceMonthlyXcdCents: toCents(form.machineMaintenanceMonthlyXcdDollars),
    expectedMonthlyVolume: num(form.expectedMonthlyVolume) || 1,
    designFeeXcdCents: toCents(form.designFeeXcdDollars),
    designHours: num(form.designHours),
    designHoursBillable: !!form.designHoursBillable,
    fittingAllowanceXcdCents: toCents(form.fittingAllowanceXcdDollars),
    targetMarginPercent: num(form.targetMarginPercent),
    depositPercent: num(form.depositPercent),
    categoryMinimumXcdCents: toCentsOrNull(form.categoryMinimumXcdDollars),
    finalPriceOverrideXcdCents: toCentsOrNull(form.finalPriceOverrideXcdDollars)
  })
)

const fmt = (cents) => formatMoney(cents, 'XCD')

// ── inspiration images ──
const { getAccessToken } = useAuth()
const fileInput = ref(null)
const uploadingImage = ref(false)
const imageUploadError = ref('')
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

async function onImageSelected(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  imageUploadError.value = ''
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    imageUploadError.value = 'Please choose a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    imageUploadError.value = 'Image is too large — please choose one under 5MB.'
    return
  }
  uploadingImage.value = true
  try {
    const token = await getAccessToken()
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch('/api/admin/quotes/inspiration-image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body
    })
    form.inspirationImageUrls.push(res.url)
  } catch (err) {
    imageUploadError.value = err?.data?.error || 'Upload failed — please try again.'
  } finally {
    uploadingImage.value = false
  }
}

async function removeImage(index) {
  const [url] = form.inspirationImageUrls.splice(index, 1)
  if (!url) return
  try {
    const token = await getAccessToken()
    await $fetch('/api/admin/quotes/inspiration-image', {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: { url }
    })
  } catch {
    // best-effort cleanup — the image is already removed from the quote either way
  }
}

function onSubmit() {
  emit('submit', {
    customerName: form.customerName,
    customerEmail: form.customerEmail || null,
    customerPhone: form.customerPhone || null,
    description: form.description || null,
    category: form.category,
    status: form.status,
    inspirationImageUrls: form.inspirationImageUrls,
    customerNotes: form.customerNotes || null,
    adminNotes: form.adminNotes || null,
    calculatorInput: {
      category: form.category,
      productionHours: num(form.productionHours),
      labourRateXcdCents: toCents(form.labourRateXcdDollars),
      fabricId: form.fabricId || null,
      fabricCostPerYardXcdCents: toCents(form.fabricCostPerYardXcdDollars),
      fabricYards: num(form.fabricYards),
      packagingXcdCents: toCents(form.packagingXcdDollars),
      consumablesXcdCents: toCents(form.consumablesXcdDollars),
      additionalMaterialsXcdCents: toCents(form.additionalMaterialsXcdDollars),
      electricityMonthlyXcdCents: toCents(form.electricityMonthlyXcdDollars),
      machineMaintenanceMonthlyXcdCents: toCents(form.machineMaintenanceMonthlyXcdDollars),
      expectedMonthlyVolume: num(form.expectedMonthlyVolume) || 1,
      designFeeXcdCents: toCents(form.designFeeXcdDollars),
      designHours: num(form.designHours),
      designHoursBillable: !!form.designHoursBillable,
      fittingAllowanceXcdCents: toCents(form.fittingAllowanceXcdDollars),
      targetMarginPercent: num(form.targetMarginPercent),
      depositPercent: num(form.depositPercent),
      categoryMinimumXcdCents: toCentsOrNull(form.categoryMinimumXcdDollars),
      finalPriceOverrideXcdCents: toCentsOrNull(form.finalPriceOverrideXcdDollars)
    }
  })
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
