<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6"
    @click.self="$emit('cancel')"
  >
    <div class="max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-card sm:max-w-xl sm:rounded-4xl sm:p-8">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-lg font-semibold text-ink">Add Inventory</h2>
        <button type="button" class="text-ink/40 transition-colors hover:text-ink" aria-label="Close" @click="$emit('cancel')">✕</button>
      </div>

      <!-- source tabs -->
      <div class="mt-5 flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          :class="mode === 'product' ? 'bg-ink text-cream' : 'bg-shell text-ink/60 hover:text-ink'"
          @click="mode = 'product'"
        >
          Website product
        </button>
        <button
          type="button"
          class="flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          :class="mode === 'manual' ? 'bg-ink text-cream' : 'bg-shell text-ink/60 hover:text-ink'"
          @click="mode = 'manual'"
        >
          Other / manual item
        </button>
      </div>

      <form class="mt-6 space-y-5" novalidate @submit.prevent="onSubmit">
        <!-- ── website product ── -->
        <template v-if="mode === 'product'">
          <div v-if="!selectedProduct">
            <label class="block">
              <span class="lbl">Product</span>
              <input v-model.trim="productSearch" type="search" placeholder="Search products…" class="inp" />
            </label>
            <div class="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-ink/10 p-2">
              <p v-if="!filteredProducts.length" class="px-2 py-3 text-xs text-ink/40">No matching products.</p>
              <button
                v-for="p in filteredProducts"
                :key="p.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-shell"
                @click="selectProduct(p)"
              >
                <span class="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-sand/40">
                  <img v-if="p.image" :src="p.image" :alt="p.name" class="h-full w-full object-cover" />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm text-ink">{{ p.name }}</span>
                  <span v-if="!p.isActive" class="text-[0.65rem] text-ink/40">Inactive</span>
                </span>
              </button>
            </div>
          </div>

          <div v-else class="flex items-center gap-3 rounded-2xl bg-shell/60 p-3">
            <span class="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-sand/40">
              <img v-if="selectedProduct.image" :src="selectedProduct.image" :alt="selectedProduct.name" class="h-full w-full object-cover" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ selectedProduct.name }}</span>
            <button type="button" class="text-xs font-semibold text-coral hover:underline" @click="clearProduct">Change</button>
          </div>

          <p v-if="loadingVariants" class="text-xs text-ink/40">Loading colours/sizes…</p>

          <div v-if="selectedProduct && !loadingVariants" class="grid gap-4 sm:grid-cols-3">
            <label class="block">
              <span class="lbl">Colour</span>
              <select v-model="form.colour" class="inp">
                <option value="">—</option>
                <option v-for="c in productColours" :key="c.id" :value="c.name">{{ c.name }}</option>
              </select>
            </label>
            <label class="block">
              <span class="lbl">Size</span>
              <select v-model="form.size" class="inp">
                <option value="">—</option>
                <option v-for="s in productSizes" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label v-if="productCoverage.length" class="block">
              <span class="lbl">Coverage</span>
              <select v-model="form.coverage" class="inp">
                <option value="">—</option>
                <option v-for="c in productCoverage" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
          </div>
        </template>

        <!-- ── manual item ── -->
        <template v-else>
          <label class="block">
            <span class="lbl">Item name</span>
            <input v-model.trim="form.manualName" type="text" placeholder="e.g. Sunset Sarong (one-off)" class="inp" />
          </label>

          <div>
            <span class="lbl">Photo (optional)</span>
            <div class="mt-1.5 flex items-center gap-3">
              <span class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-sand/40">
                <img v-if="manualImageUrl" :src="manualImageUrl" alt="" class="h-full w-full object-cover" />
              </span>
              <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="uploadingImage" @click="fileInput?.click()">
                {{ uploadingImage ? 'Uploading…' : manualImageUrl ? 'Replace' : 'Upload' }}
              </button>
              <button v-if="manualImageUrl" type="button" class="text-xs text-ink/45 hover:text-coral" @click="manualImageUrl = ''">Remove</button>
            </div>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />
            <p v-if="imageError" class="mt-1.5 text-xs text-coral">{{ imageError }}</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <label class="block">
              <span class="lbl">Reference # (optional)</span>
              <input v-model.trim="form.referenceCode" type="text" class="inp" />
            </label>
            <label class="block">
              <span class="lbl">Colour</span>
              <input v-model.trim="form.colour" type="text" class="inp" />
            </label>
            <label class="block">
              <span class="lbl">Size</span>
              <input v-model.trim="form.size" type="text" class="inp" />
            </label>
          </div>
          <label class="block">
            <span class="lbl">Coverage (optional)</span>
            <input v-model.trim="form.coverage" type="text" class="inp sm:max-w-[12rem]" />
          </label>
        </template>

        <!-- ── shared fields ── -->
        <div class="grid gap-4 border-t border-ink/10 pt-5 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Quantity</span>
            <input v-model="form.quantity" type="number" min="1" step="1" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Date sent</span>
            <input v-model="form.dateSent" type="date" class="inp" />
          </label>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Retail price (XCD)</span>
            <input v-model="form.retailPrice" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Commission %</span>
            <input v-model="form.commission" type="number" min="0" max="100" step="0.1" class="inp" />
          </label>
        </div>
        <label class="block">
          <span class="lbl">Notes (optional)</span>
          <textarea v-model.trim="form.notes" rows="2" class="inp" />
        </label>

        <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
        <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
          <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
        </ul>

        <div class="flex items-center justify-end gap-3 border-t border-ink/10 pt-5">
          <button type="button" class="btn-outline" @click="$emit('cancel')">Cancel</button>
          <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
            {{ saving ? 'Saving…' : 'Add inventory' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  stockistId: { type: String, required: true },
  defaultCommissionBps: { type: Number, default: null }
})
const emit = defineEmits(['saved', 'cancel'])

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const today = () => new Date().toISOString().slice(0, 10)
const bpsToPercent = (bps) => (typeof bps === 'number' ? (bps / 100).toString() : '')

const mode = ref('product')
const form = reactive({
  colour: '',
  size: '',
  coverage: '',
  manualName: '',
  referenceCode: '',
  quantity: '1',
  dateSent: today(),
  retailPrice: '',
  commission: bpsToPercent(props.defaultCommissionBps),
  notes: ''
})

// ── website product picker ──
const products = ref([])
const productSearch = ref('')
const selectedProduct = ref(null)
const loadingVariants = ref(false)
const productSizes = ref([])
const productCoverage = ref([])
const productColours = ref([])

authedFetch('/api/admin/products').then((res) => {
  products.value = res.products ?? []
})
const allFabricsPromise = authedFetch('/api/admin/fabrics').then((res) => res.fabrics ?? [])

const filteredProducts = computed(() => {
  const q = productSearch.value.toLowerCase()
  const list = q ? products.value.filter((p) => p.name.toLowerCase().includes(q)) : products.value
  return list.slice(0, 30)
})

async function selectProduct(p) {
  selectedProduct.value = p
  loadingVariants.value = true
  form.colour = ''
  form.size = ''
  form.coverage = ''
  try {
    const [detail, fabrics] = await Promise.all([authedFetch(`/api/admin/products/${p.id}`), allFabricsPromise])
    productSizes.value = detail.product.sizes ?? []
    productCoverage.value = detail.product.coverage ?? []
    const fabricIds = new Set(detail.product.fabricIds ?? [])
    productColours.value = fabrics.filter((f) => fabricIds.has(f.id)).sort((a, b) => a.name.localeCompare(b.name))
    if (!form.retailPrice && typeof detail.product.priceXcdCents === 'number') {
      form.retailPrice = (detail.product.priceXcdCents / 100).toString()
    }
  } catch {
    formError.value = 'Could not load this product’s colours/sizes.'
  } finally {
    loadingVariants.value = false
  }
}
function clearProduct() {
  selectedProduct.value = null
  productSizes.value = []
  productCoverage.value = []
  productColours.value = []
}

// ── manual item photo ──
const fileInput = ref(null)
const manualImageUrl = ref('')
const uploadingImage = ref(false)
const imageError = ref('')
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  imageError.value = ''
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    imageError.value = 'Please choose a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    imageError.value = 'Image is too large — under 5MB please.'
    return
  }
  uploadingImage.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const { url } = await authedFetch('/api/admin/stockists/image', { method: 'POST', body })
    manualImageUrl.value = url
  } catch (err) {
    imageError.value = err?.data?.error || 'Upload failed — try again.'
  } finally {
    uploadingImage.value = false
  }
}

// Reset the fields specific to the mode not in use, so switching tabs never
// silently carries stale data into the submit payload.
watch(mode, () => {
  form.colour = ''
  form.size = ''
  form.coverage = ''
  formError.value = ''
})

// ── submit ──
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

  if (mode.value === 'product' && !selectedProduct.value) {
    formError.value = 'Choose a product first.'
    return
  }

  const payload = {
    source: mode.value,
    productId: mode.value === 'product' ? selectedProduct.value.id : undefined,
    productNameSnapshot: mode.value === 'manual' ? form.manualName : selectedProduct.value?.name,
    productImageSnapshot: mode.value === 'manual' ? manualImageUrl.value || null : undefined,
    referenceCode: mode.value === 'manual' ? form.referenceCode || null : null,
    colour: form.colour || null,
    size: form.size || null,
    coverage: form.coverage || null,
    retailPriceCents: toCentsOrNull(form.retailPrice),
    defaultCommissionBps: toBpsOrNull(form.commission),
    notes: form.notes || null,
    initialQuantity: form.quantity === '' ? undefined : Number(form.quantity),
    dateSent: form.dateSent || undefined
  }

  saving.value = true
  try {
    const res = await authedFetch(`/api/admin/stockists/${props.stockistId}/items`, { method: 'POST', body: payload })
    emit('saved', res.item)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong adding this inventory.'
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
