<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6"
    @click.self="$emit('cancel')"
  >
    <div class="max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-card sm:max-w-2xl sm:rounded-4xl sm:p-8">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-lg font-semibold text-ink">{{ isEdit ? 'Edit product' : 'Add product' }}</h2>
        <button type="button" class="text-ink/40 transition-colors hover:text-ink" aria-label="Close" @click="$emit('cancel')">✕</button>
      </div>

      <p v-if="isEdit && !product" class="mt-6 text-sm text-ink/50">Loading product…</p>

      <form v-else class="mt-6 space-y-5" novalidate @submit.prevent="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="lbl">Name</span>
            <input v-model.trim="form.name" type="text" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Slug</span>
            <input v-model.trim="form.slug" type="text" placeholder="kir-royale-top" class="inp" />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="lbl">Category</span>
            <select v-model="form.category" class="inp">
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <label class="block">
            <span class="lbl">USD price</span>
            <input v-model="form.priceUsd" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">XCD price</span>
            <input v-model="form.priceXcd" type="number" min="0" step="0.01" class="inp" />
          </label>
        </div>

        <label class="block">
          <span class="lbl">Description</span>
          <textarea v-model.trim="form.description" rows="3" class="inp" />
        </label>

        <div>
          <span class="lbl">Sizes</span>
          <div class="mt-1.5 flex flex-wrap gap-2">
            <span v-for="s in form.sizes" :key="s" class="chip">
              {{ s }}
              <button type="button" class="chip-x" @click="form.sizes = form.sizes.filter((x) => x !== s)">✕</button>
            </span>
          </div>
          <div class="mt-2 flex gap-2">
            <input v-model.trim="sizeDraft" type="text" placeholder="e.g. M or S/M" class="inp flex-1" @keydown.enter.prevent="addSize" />
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" @click="addSize">Add</button>
          </div>
        </div>

        <div>
          <span class="lbl">Coverage options</span>
          <div class="mt-1.5 flex flex-wrap gap-4">
            <label v-for="c in COVERAGE_CHOICES" :key="c" class="flex items-center gap-2 text-sm text-ink/70">
              <input v-model="form.coverage" type="checkbox" class="h-4 w-4 accent-coral" :value="c" />
              {{ c }}
            </label>
          </div>
        </div>

        <div>
          <span class="lbl">Details</span>
          <div class="mt-1.5 flex flex-wrap gap-2">
            <span v-for="d in form.details" :key="d" class="chip">
              {{ d }}
              <button type="button" class="chip-x" @click="form.details = form.details.filter((x) => x !== d)">✕</button>
            </span>
          </div>
          <div class="mt-2 flex gap-2">
            <input v-model.trim="detailDraft" type="text" placeholder="e.g. Adjustable fit" class="inp flex-1" @keydown.enter.prevent="addDetail" />
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" @click="addDetail">Add</button>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="flex items-center gap-2 text-sm text-ink/70">
            <input v-model="form.isActive" type="checkbox" class="h-4 w-4 accent-coral" />
            Active
          </label>
          <label class="flex items-center gap-2 text-sm text-ink/70">
            <input v-model="form.isFeatured" type="checkbox" class="h-4 w-4 accent-coral" />
            Featured
          </label>
          <label class="block">
            <span class="lbl">Display order</span>
            <input v-model="form.sortOrder" type="number" step="1" placeholder="—" class="inp" />
          </label>
        </div>

        <div>
          <span class="lbl">Images</span>
          <p v-if="!isEdit" class="mt-1 text-xs text-ink/40">Uploaded images are attached when you create the product.</p>
          <div class="mt-2 flex flex-wrap gap-3">
            <div v-for="(img, i) in images" :key="img.id || img.imageUrl" class="w-24">
              <div class="relative overflow-hidden rounded-xl border" :class="img.isPrimary ? 'border-coral' : 'border-ink/10'">
                <img :src="img.imageUrl" alt="" class="aspect-[3/4] w-full object-cover" />
                <span v-if="img.isPrimary" class="absolute left-1 top-1 rounded-full bg-coral px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-white">
                  Primary
                </span>
              </div>
              <div class="mt-1 flex items-center justify-between text-[0.65rem]">
                <button type="button" class="text-ink/45 hover:text-ink disabled:opacity-30" :disabled="i === 0" @click="move(i, -1)">←</button>
                <button v-if="!img.isPrimary" type="button" class="font-semibold text-coral hover:underline" @click="setPrimary(i)">Primary</button>
                <span v-else class="text-ink/25">·</span>
                <button type="button" class="text-ink/45 hover:text-ink disabled:opacity-30" :disabled="i === images.length - 1" @click="move(i, 1)">→</button>
              </div>
              <button type="button" class="mt-0.5 w-full text-[0.65rem] font-medium text-ink/40 hover:text-coral" @click="removeImage(i)">Remove</button>
            </div>

            <button
              type="button"
              class="grid w-24 place-items-center rounded-xl border border-dashed border-ink/25 text-xs text-ink/45 hover:border-ink/50 disabled:opacity-50"
              style="aspect-ratio: 3 / 4"
              :disabled="uploading"
              @click="fileInput?.click()"
            >
              {{ uploading ? '…' : '+ Upload' }}
            </button>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />
          </div>
          <p v-if="imageError" class="mt-1.5 text-xs text-coral">{{ imageError }}</p>
        </div>

        <div>
          <span class="lbl">Compatible fabrics <span class="text-ink/40">· {{ form.fabricIds.length }} selected</span></span>
          <div class="mt-2 grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-2xl border border-ink/10 p-3 sm:grid-cols-2">
            <label
              v-for="f in sortedFabrics"
              :key="f.id"
              class="flex items-center gap-2 text-sm"
              :class="f.isActive ? 'text-ink/70' : 'text-ink/35'"
            >
              <input v-model="form.fabricIds" type="checkbox" class="h-4 w-4 accent-coral" :value="f.id" />
              <span class="h-3.5 w-3.5 shrink-0 rounded-full border border-ink/10" :style="fabricSwatch(f)" />
              {{ f.name }}<span v-if="!f.isActive" class="text-[0.65rem]"> (inactive)</span>
            </label>
          </div>
        </div>

        <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
        <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
          <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
        </ul>

        <div class="flex items-center justify-end gap-3 border-t border-ink/10 pt-5">
          <button type="button" class="btn-outline" @click="$emit('cancel')">Cancel</button>
          <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
            {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create product' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { CATEGORIES } from '~/data/constants.js'

const props = defineProps({
  productId: { type: String, default: null }, // null = creating
  product: { type: Object, default: null }, // full admin detail once loaded
  fabrics: { type: Array, required: true }
})
const emit = defineEmits(['saved', 'cancel'])

const isEdit = computed(() => !!props.productId)

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const COVERAGE_CHOICES = ['Thong', 'Cheeky', 'Bikini']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const centsToInput = (c) => (typeof c === 'number' ? (c / 100).toFixed(2) : '')

function blankForm() {
  return {
    name: '',
    slug: '',
    category: CATEGORIES[0],
    description: '',
    priceUsd: '',
    priceXcd: '',
    sizes: [],
    coverage: [],
    details: [],
    isActive: true,
    isFeatured: false,
    sortOrder: '',
    fabricIds: []
  }
}
function fromProduct(p) {
  return {
    name: p.name ?? '',
    slug: p.slug ?? '',
    category: p.category ?? CATEGORIES[0],
    description: p.description ?? '',
    priceUsd: centsToInput(p.priceUsdCents),
    priceXcd: centsToInput(p.priceXcdCents),
    sizes: [...(p.sizes ?? [])],
    coverage: [...(p.coverage ?? [])],
    details: [...(p.details ?? [])],
    isActive: p.isActive ?? true,
    isFeatured: p.isFeatured ?? false,
    sortOrder: p.sortOrder ?? '',
    fabricIds: [...(p.fabricIds ?? [])]
  }
}

// Parent remounts via :key, and passes `product` only once (after load) — so
// seed from whatever is available at setup, and if it arrives a tick later
// (edit still loading) re-seed once.
const form = reactive(props.product ? fromProduct(props.product) : blankForm())
const images = ref(props.product ? props.product.images.map((i) => ({ ...i })) : [])

if (isEdit.value && !props.product) {
  const stop = watch(
    () => props.product,
    (p) => {
      if (!p) return
      Object.assign(form, fromProduct(p))
      images.value = p.images.map((i) => ({ ...i }))
      stop()
    }
  )
}

const sortedFabrics = computed(() => [...props.fabrics].sort((a, b) => a.name.localeCompare(b.name)))
const fabricSwatch = (f) => (f.imageUrl ? { backgroundImage: `url(${f.imageUrl})`, backgroundSize: 'cover' } : { backgroundColor: f.hexColor || '#e5e0d8' })

const sizeDraft = ref('')
const detailDraft = ref('')
function addSize() {
  const v = sizeDraft.value.trim()
  if (v && !form.sizes.includes(v)) form.sizes.push(v)
  sizeDraft.value = ''
}
function addDetail() {
  const v = detailDraft.value.trim()
  if (v && !form.details.includes(v)) form.details.push(v)
  detailDraft.value = ''
}

// ── images ──
const fileInput = ref(null)
const uploading = ref(false)
const imageError = ref('')

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
  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const { url } = await authedFetch('/api/admin/products/image', { method: 'POST', body })

    if (isEdit.value) {
      const { image } = await authedFetch(`/api/admin/products/${props.productId}/images`, {
        method: 'POST',
        body: { url }
      })
      images.value.push(image)
    } else {
      images.value.push({ imageUrl: url, isPrimary: images.value.length === 0, sortOrder: images.value.length })
    }
  } catch (err) {
    imageError.value = err?.data?.error || 'Upload failed — try again.'
  } finally {
    uploading.value = false
  }
}

async function removeImage(i) {
  const img = images.value[i]
  if (isEdit.value && img.id) {
    try {
      await authedFetch(`/api/admin/products/${props.productId}/images/${img.id}`, { method: 'DELETE' })
      const res = await authedFetch(`/api/admin/products/${props.productId}`)
      images.value = res.product.images.map((x) => ({ ...x }))
      return
    } catch (err) {
      imageError.value = err?.data?.error || 'Could not remove image.'
      return
    }
  }
  const wasPrimary = img.isPrimary
  images.value.splice(i, 1)
  if (wasPrimary && images.value.length) images.value[0].isPrimary = true
}

async function setPrimary(i) {
  const img = images.value[i]
  if (isEdit.value && img.id) {
    try {
      const { images: updated } = await authedFetch(`/api/admin/products/${props.productId}/images`, {
        method: 'PATCH',
        body: { primaryId: img.id }
      })
      images.value = updated
    } catch (err) {
      imageError.value = err?.data?.error || 'Could not set primary.'
    }
    return
  }
  images.value.forEach((x, idx) => (x.isPrimary = idx === i))
}

async function move(i, dir) {
  const j = i + dir
  if (j < 0 || j >= images.value.length) return
  const arr = images.value.slice()
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  images.value = arr
  if (isEdit.value && arr.every((x) => x.id)) {
    try {
      const { images: updated } = await authedFetch(`/api/admin/products/${props.productId}/images`, {
        method: 'PATCH',
        body: { order: arr.map((x) => x.id) }
      })
      images.value = updated
    } catch (err) {
      imageError.value = err?.data?.error || 'Could not reorder.'
    }
  }
}

// ── submit ──
const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

function toCentsOrNull(v) {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

async function onSubmit() {
  saving.value = true
  formError.value = ''
  formIssues.value = []

  const payload = {
    name: form.name,
    slug: form.slug,
    category: form.category,
    description: form.description || null,
    priceUsdCents: toCentsOrNull(form.priceUsd),
    priceXcdCents: toCentsOrNull(form.priceXcd),
    sizes: form.sizes,
    coverage: form.coverage,
    details: form.details,
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    sortOrder: form.sortOrder === '' ? null : Number(form.sortOrder),
    fabricIds: form.fabricIds
  }

  try {
    let res
    if (isEdit.value) {
      res = await authedFetch(`/api/admin/products/${props.productId}`, { method: 'PATCH', body: payload })
    } else {
      res = await authedFetch('/api/admin/products', {
        method: 'POST',
        body: { ...payload, images: images.value.map((i) => i.imageUrl) }
      })
    }
    emit('saved', res.product)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving this product.'
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
.chip {
  @apply inline-flex items-center gap-1.5 rounded-full bg-shell px-3 py-1 text-xs font-medium text-ink;
}
.chip-x {
  @apply text-ink/40 hover:text-coral;
}
</style>
