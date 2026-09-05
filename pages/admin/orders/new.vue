<template>
  <div>
    <NuxtLink to="/admin/orders" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
      ← Back to orders
    </NuxtLink>

    <FancyHeading eyebrow="Admin" title="Add *Order*" size="sm" as="h1" class="mt-4" />
    <p class="mt-1 text-sm text-ink/50">A manual order — Instagram, WhatsApp, in-person or other. Not routed through Go2Pay.</p>

    <form class="mt-8 space-y-8" novalidate @submit.prevent="onSubmit">
      <!-- customer -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Customer</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">First name *</span>
            <input v-model.trim="form.firstName" type="text" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Last name</span>
            <input v-model.trim="form.lastName" type="text" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Email</span>
            <input v-model.trim="form.email" type="email" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Phone</span>
            <input v-model.trim="form.phone" type="tel" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Source *</span>
            <select v-model="form.source" class="inp">
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="in_person">In Person</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label class="block">
            <span class="lbl">Order date *</span>
            <input v-model="form.orderDate" type="date" class="inp" />
          </label>
        </div>
        <div class="mt-4">
          <span class="lbl">Currency *</span>
          <div class="mt-1.5 flex gap-2">
            <button
              v-for="c in ['XCD', 'USD']"
              :key="c"
              type="button"
              class="rounded-full border px-5 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
              :class="form.currency === c ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
              @click="setCurrency(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>
      </section>

      <!-- notes -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Notes</h2>
        <div class="mt-4 space-y-4">
          <label class="block">
            <span class="lbl">Customer / order notes</span>
            <textarea v-model.trim="form.notes" rows="2" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Private admin notes</span>
            <textarea v-model.trim="form.adminNotes" rows="2" class="inp" />
            <span class="mt-1 block text-xs text-ink/40">Never shown to the customer.</span>
          </label>
        </div>
      </section>

      <!-- items -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <div class="flex items-center justify-between">
          <h2 class="font-display text-lg font-semibold text-ink">Items</h2>
          <button type="button" class="btn-outline px-4 py-1.5 text-xs" @click="addItem">+ Add item</button>
        </div>

        <div v-for="(it, i) in form.items" :key="it._key" class="mt-5 rounded-2xl border border-ink/10 p-4">
          <div class="flex items-center justify-between">
            <div class="flex gap-2">
              <button
                v-for="t in ['catalogue', 'custom']"
                :key="t"
                type="button"
                class="rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-widest2 transition-colors"
                :class="it.type === t ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60'"
                @click="setItemType(i, t)"
              >
                {{ t === 'catalogue' ? 'Catalogue Product' : 'Custom Item' }}
              </button>
            </div>
            <button v-if="form.items.length > 1" type="button" class="text-ink/35 hover:text-coral" aria-label="Remove item" @click="form.items.splice(i, 1)">
              <IconTrash class="h-4 w-4" />
            </button>
          </div>

          <!-- catalogue -->
          <div v-if="it.type === 'catalogue'" class="mt-4 space-y-3">
            <label class="block">
              <span class="lbl">Product</span>
              <select v-model="it.productId" class="inp" @change="loadProductOptions(i)">
                <option value="">Select a product…</option>
                <option v-for="p in activeProducts" :key="p.id" :value="p.slug">{{ p.name }} — {{ p.category }}</option>
              </select>
            </label>

            <p v-if="it._loading" class="text-xs text-ink/40">Loading options…</p>
            <template v-else-if="it._opts">
              <div class="grid gap-3 sm:grid-cols-3">
                <label v-if="it._opts.sizes.length" class="block">
                  <span class="lbl">Size</span>
                  <select v-model="it.size" class="inp">
                    <option value="">—</option>
                    <option v-for="s in it._opts.sizes" :key="s" :value="s">{{ s }}</option>
                  </select>
                </label>
                <label v-if="it._opts.colours.length" class="block">
                  <span class="lbl">Fabric / colour</span>
                  <select v-model="it.colourId" class="inp">
                    <option value="">—</option>
                    <option v-for="c in it._opts.colours" :key="c.id" :value="c.id" :disabled="c.status === 'unavailable'">
                      {{ c.name }}{{ c.status === 'unavailable' ? ' (unavailable)' : '' }}
                    </option>
                  </select>
                </label>
                <label v-if="it._opts.coverage.length" class="block">
                  <span class="lbl">Coverage</span>
                  <select v-model="it.coverage" class="inp">
                    <option value="">—</option>
                    <option v-for="cv in it._opts.coverage" :key="cv" :value="cv">{{ cv }}</option>
                  </select>
                </label>
              </div>
            </template>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="lbl">Price ({{ form.currency }}) <span class="text-ink/40">· per unit</span></span>
                <input v-model="it.price" type="number" min="0" step="0.01" class="inp" />
              </label>
              <label class="block">
                <span class="lbl">Quantity</span>
                <input v-model="it.quantity" type="number" min="1" step="1" class="inp" />
              </label>
            </div>
          </div>

          <!-- custom -->
          <div v-else class="mt-4 space-y-3">
            <label class="block">
              <span class="lbl">Item name *</span>
              <input v-model.trim="it.name" type="text" placeholder="e.g. Custom Pageant Swimwear" class="inp" />
            </label>
            <label class="block">
              <span class="lbl">Description / specs</span>
              <textarea v-model.trim="it.description" rows="2" class="inp" />
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="lbl">Price ({{ form.currency }}) *</span>
                <input v-model="it.price" type="number" min="0" step="0.01" class="inp" />
              </label>
              <label class="block">
                <span class="lbl">Quantity</span>
                <input v-model="it.quantity" type="number" min="1" step="1" class="inp" />
              </label>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <label class="block"><span class="lbl">Size</span><input v-model.trim="it.size" type="text" class="inp" /></label>
              <label class="block"><span class="lbl">Colour / fabric</span><input v-model.trim="it.colour" type="text" class="inp" /></label>
              <label class="block"><span class="lbl">Coverage</span><input v-model.trim="it.coverage" type="text" class="inp" /></label>
            </div>
            <div>
              <span class="lbl">Reference / design image</span>
              <div class="mt-1.5 flex items-center gap-3">
                <span class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-sand/40">
                  <img v-if="it.imageUrl" :src="it.imageUrl" alt="" class="h-full w-full object-cover" />
                </span>
                <div>
                  <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="it._uploading" @click="pickImage(i)">
                    {{ it._uploading ? 'Uploading…' : it.imageUrl ? 'Replace' : 'Upload image' }}
                  </button>
                  <button v-if="it.imageUrl" type="button" class="ml-3 text-xs font-semibold text-coral link-underline" @click="it.imageUrl = ''">Remove</button>
                  <p class="mt-1 text-xs text-ink/40">JPEG, PNG or WebP · up to 5MB.</p>
                  <p v-if="it._imgError" class="text-xs text-coral">{{ it._imgError }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between border-t border-ink/10 pt-4">
          <span class="text-sm text-ink/60">Order total</span>
          <span class="font-display text-lg font-semibold text-ink">{{ totalDisplay }}</span>
        </div>
      </section>

      <!-- payment -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Payment</h2>
        <label class="mt-4 flex items-center gap-2 text-sm text-ink/70">
          <input v-model="form.payment.markPaid" type="checkbox" class="h-4 w-4 accent-coral" />
          Already paid — mark this order Paid now
        </label>
        <div v-if="form.payment.markPaid" class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Payment date</span>
            <input v-model="form.payment.paymentDate" type="date" class="inp" />
            <span class="mt-1 block text-xs text-ink/40">Separate from the order date — used for sales analytics.</span>
          </label>
          <label class="block">
            <span class="lbl">Payment method</span>
            <select v-model="form.payment.paymentMethod" class="inp">
              <option value="">—</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="payment_link">Go2Pay / Payment Link</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
      </section>

      <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
      <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
        <li v-for="(m, i) in formIssues" :key="i">{{ m }}</li>
      </ul>

      <div class="flex items-center gap-3">
        <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
          {{ saving ? 'Creating…' : 'Create order' }}
        </button>
        <NuxtLink to="/admin/orders" class="btn-outline">Cancel</NuxtLink>
      </div>
    </form>

    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFileChosen" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { formatMoney } from '~/utils/money'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Add order — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
const router = useRouter()

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const today = () => new Date().toISOString().slice(0, 10)
let keySeq = 0
const blankItem = () => ({
  _key: ++keySeq,
  type: 'catalogue',
  productId: '',
  _opts: null,
  _loading: false,
  size: '',
  colourId: '',
  coverage: '',
  name: '',
  description: '',
  colour: '',
  imageUrl: '',
  _uploading: false,
  _imgError: '',
  price: '',
  quantity: 1
})

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  source: 'instagram',
  currency: 'XCD',
  orderDate: today(),
  notes: '',
  adminNotes: '',
  items: [blankItem()],
  payment: { markPaid: false, paymentDate: today(), paymentMethod: '' }
})

// active products for the catalogue picker
const { data: productData } = useLazyAsyncData('manual-order-products', () => authedFetch('/api/admin/products'), { server: false })
const activeProducts = computed(() => (productData.value?.products ?? []).filter((p) => p.isActive))

// cache of /api/products/:slug option payloads, and the catalogue price per currency
const productCache = reactive({})

async function loadProductOptions(i) {
  const it = form.items[i]
  it.size = ''
  it.colourId = ''
  it.coverage = ''
  it._opts = null
  if (!it.productId) return
  it._loading = true
  try {
    if (!productCache[it.productId]) {
      const res = await $fetch(`/api/products/${encodeURIComponent(it.productId)}`)
      productCache[it.productId] = {
        sizes: res.product.sizes ?? [],
        coverage: res.product.coverage ?? [],
        colours: res.product.colours ?? [],
        priceUsd: res.product.price,
        priceXcd: res.product.priceXcd
      }
    }
    it._opts = productCache[it.productId]
    prefillPrice(it)
  } catch {
    it._opts = { sizes: [], coverage: [], colours: [] }
  } finally {
    it._loading = false
  }
}

function prefillPrice(it) {
  const c = productCache[it.productId]
  if (!c) return
  it.price = (form.currency === 'XCD' ? c.priceXcd : c.priceUsd)?.toFixed(2) ?? ''
}

function setCurrency(c) {
  form.currency = c
  // re-prefill any catalogue item that wasn't manually overridden is hard to
  // know — just re-prefill all catalogue items with a loaded product.
  for (const it of form.items) if (it.type === 'catalogue' && productCache[it.productId]) prefillPrice(it)
}

function setItemType(i, t) {
  const it = form.items[i]
  it.type = t
  if (t === 'custom') {
    it.productId = ''
    it._opts = null
  }
}
function addItem() {
  form.items.push(blankItem())
}

// image upload
const fileInput = ref(null)
let uploadTargetIndex = -1
function pickImage(i) {
  uploadTargetIndex = i
  fileInput.value?.click()
}
async function onFileChosen(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  const it = form.items[uploadTargetIndex]
  if (!file || !it) return
  it._imgError = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    it._imgError = 'Please choose a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    it._imgError = 'Image is too large — under 5MB please.'
    return
  }
  it._uploading = true
  try {
    const body = new FormData()
    body.append('file', file)
    const { url } = await authedFetch('/api/admin/orders/image', { method: 'POST', body })
    it.imageUrl = url
  } catch (err) {
    it._imgError = err?.data?.error || 'Upload failed.'
  } finally {
    it._uploading = false
  }
}

const totalCents = computed(() =>
  form.items.reduce((sum, it) => {
    const p = Math.round((Number(it.price) || 0) * 100)
    const q = Math.max(1, Math.floor(Number(it.quantity) || 1))
    return sum + p * q
  }, 0)
)
const totalDisplay = computed(() => formatMoney(totalCents.value, form.currency))

// submit
const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

function toCents(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

async function onSubmit() {
  saving.value = true
  formError.value = ''
  formIssues.value = []

  const payload = {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    source: form.source,
    currency: form.currency,
    orderDate: form.orderDate,
    notes: form.notes,
    adminNotes: form.adminNotes,
    items: form.items.map((it) =>
      it.type === 'custom'
        ? {
            type: 'custom',
            name: it.name,
            description: it.description,
            priceCents: toCents(it.price),
            quantity: Number(it.quantity) || 1,
            size: it.size,
            colour: it.colour,
            coverage: it.coverage,
            imageUrl: it.imageUrl
          }
        : {
            type: 'catalogue',
            productId: it.productId,
            size: it.size,
            colourId: it.colourId,
            coverage: it.coverage,
            priceCents: toCents(it.price),
            quantity: Number(it.quantity) || 1
          }
    ),
    payment: form.payment.markPaid
      ? { markPaid: true, paymentDate: form.payment.paymentDate, paymentMethod: form.payment.paymentMethod || null }
      : { markPaid: false }
  }

  try {
    const res = await authedFetch('/api/admin/orders', { method: 'POST', body: payload })
    await router.push(`/admin/orders/${res.order.id}`)
  } catch (err) {
    formError.value = err?.data?.error || 'Could not create the order.'
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
