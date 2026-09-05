<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-6"
    @click.self="$emit('cancel')"
  >
    <div class="max-h-[90vh] w-full overflow-y-auto rounded-t-4xl bg-cream p-6 shadow-card sm:max-w-xl sm:rounded-4xl sm:p-8">
      <div class="flex items-center justify-between">
        <h2 class="font-display text-lg font-semibold text-ink">{{ fabric ? 'Edit fabric' : 'Add fabric' }}</h2>
        <button type="button" class="text-ink/40 transition-colors hover:text-ink" aria-label="Close" @click="$emit('cancel')">
          ✕
        </button>
      </div>

      <form class="mt-6 space-y-5" novalidate @submit.prevent="onSubmit">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Name</span>
            <input
              v-model.trim="form.name"
              type="text"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
            />
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Slug</span>
            <input
              v-model.trim="form.slug"
              type="text"
              placeholder="royal-blue"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
            />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Hex colour</span>
            <div class="mt-1.5 flex items-center gap-2">
              <span
                class="h-9 w-9 shrink-0 rounded-full border border-ink/10"
                :style="{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(form.hexColor) ? form.hexColor : '#e5e0d8' }"
              />
              <input
                v-model.trim="form.hexColor"
                type="text"
                placeholder="#26408B"
                class="w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
              />
            </div>
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Type</span>
            <select
              v-model="form.type"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm capitalize text-ink focus:border-coral focus:outline-none"
            >
              <option v-for="t in FABRIC_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
        </div>

        <div>
          <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Fabric image (optional)</span>
          <div class="mt-1.5 flex items-center gap-3">
            <span class="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-ink/10 bg-sand/40">
              <img v-if="form.imageUrl" :src="form.imageUrl" alt="" class="h-full w-full object-cover" />
            </span>
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  class="btn-outline px-4 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="uploading"
                  @click="triggerFilePick"
                >
                  {{ uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Upload image' }}
                </button>
                <button
                  v-if="form.imageUrl"
                  type="button"
                  class="text-xs font-semibold text-coral link-underline disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="uploading"
                  @click="removeImage"
                >
                  Remove
                </button>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="onFileSelected"
              />
              <p class="text-xs text-ink/40">JPEG, PNG or WebP · up to 5MB.</p>
              <p v-if="uploadError" class="text-xs text-coral">{{ uploadError }}</p>
            </div>
          </div>
          <p class="mt-1.5 text-xs text-ink/40">
            For prints/specialty fabrics a single hex colour can't represent. Leave blank to use the hex colour instead.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Quantity</span>
            <input
              v-model="form.quantity"
              type="number"
              min="0"
              step="0.5"
              placeholder="—"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
            />
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Unit</span>
            <select
              v-model="form.unit"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
            >
              <option value="">—</option>
              <option v-for="u in FABRIC_UNITS" :key="u" :value="u">{{ u }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Status</span>
            <select
              v-model="form.status"
              class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm capitalize text-ink focus:border-coral focus:outline-none"
            >
              <option v-for="s in FABRIC_STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </div>

        <label class="flex items-center gap-2 text-sm text-ink/70">
          <input v-model="form.isActive" type="checkbox" class="h-4 w-4 accent-coral" />
          Active (visible on the storefront)
        </label>

        <div>
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">
            Product compatibility
            <span class="text-ink/40">· {{ form.productIds.length }} selected</span>
          </p>
          <div class="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-2xl border border-ink/10 p-3">
            <div v-for="group in groupedProducts" :key="group.value">
              <p class="text-[0.65rem] font-semibold uppercase tracking-widest2 text-ink/40">{{ group.label }}</p>
              <div class="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <label v-for="p in group.products" :key="p.id" class="flex items-center gap-2 text-sm text-ink/70">
                  <input v-model="form.productIds" type="checkbox" class="h-4 w-4 accent-coral" :value="p.id" />
                  {{ p.title }}
                </label>
              </div>
            </div>
          </div>
        </div>

        <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
        <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
          <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
        </ul>

        <div class="flex items-center justify-end gap-3 border-t border-ink/10 pt-5">
          <button type="button" class="btn-outline" @click="$emit('cancel')">Cancel</button>
          <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
            {{ saving ? 'Saving…' : fabric ? 'Save changes' : 'Create fabric' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { CATEGORIES } from '~/data/constants.js'

const props = defineProps({
  // null = creating a new fabric; an admin-API fabric object = editing.
  fabric: { type: Object, default: null },
  productOptions: { type: Array, required: true }, // [{ id, title, category }]
  saving: { type: Boolean, default: false },
  formError: { type: String, default: '' },
  formIssues: { type: Array, default: () => [] }
})
const emit = defineEmits(['submit', 'cancel'])

// Product compatibility grouped by the real catalogue categories (Tops,
// Bottoms, One Pieces, Cover Ups) — purely a layout change, the checkbox
// behaviour and submitted `productIds` array are unchanged. A category with
// no eligible products (e.g. none currently linkable) is skipped.
const groupedProducts = computed(() =>
  CATEGORIES.map((label) => ({
    value: label,
    label,
    products: props.productOptions.filter((p) => p.category === label)
  })).filter((g) => g.products.length > 0)
)

const FABRIC_TYPES = ['solid', 'print', 'mesh', 'specialty']
const FABRIC_STATUSES = ['available', 'low', 'unavailable']
const FABRIC_UNITS = ['yards', 'metres']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB — mirrors the server-side limit

function blankForm() {
  return {
    name: '',
    slug: '',
    hexColor: '',
    imageUrl: '',
    type: 'solid',
    quantity: '',
    unit: '',
    status: 'available',
    isActive: true,
    productIds: []
  }
}

function fromFabric(f) {
  return {
    name: f.name ?? '',
    slug: f.slug ?? '',
    hexColor: f.hexColor ?? '',
    imageUrl: f.imageUrl ?? '',
    type: f.type ?? 'solid',
    quantity: f.quantity ?? '',
    unit: f.unit ?? '',
    status: f.status ?? 'available',
    isActive: f.isActive ?? true,
    productIds: [...(f.productIds ?? [])]
  }
}

// The parent remounts this component per open (v-if), so props are fresh at
// setup time — no need to watch props.fabric for changes after mount.
const form = reactive(props.fabric ? fromFabric(props.fabric) : blankForm())

// Image upload — a self-contained action with its own loading/error state,
// separate from the form's overall Save. Uploading immediately stores the
// file in Supabase Storage and returns its URL; nothing is deleted here.
// Cleanup of a replaced/removed image happens centrally after a successful
// Save (pages/admin/fabrics.vue), so a cancelled edit never deletes an image
// still referenced by the saved fabric.
const { getAccessToken } = useAuth()
const fileInput = ref(null)
const uploading = ref(false)
const uploadError = ref('')

function triggerFilePick() {
  fileInput.value?.click()
}

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // allow re-selecting the same file later
  if (!file) return

  uploadError.value = ''
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    uploadError.value = 'Please choose a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    uploadError.value = 'Image is too large — please choose one under 5MB.'
    return
  }

  uploading.value = true
  try {
    const token = await getAccessToken()
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch('/api/admin/fabrics/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body
    })
    form.imageUrl = res.url
  } catch (err) {
    uploadError.value = err?.data?.error || 'Upload failed — please try again.'
  } finally {
    uploading.value = false
  }
}

function removeImage() {
  form.imageUrl = ''
  uploadError.value = ''
}

function onSubmit() {
  emit('submit', {
    name: form.name,
    slug: form.slug,
    hexColor: form.hexColor || null,
    imageUrl: form.imageUrl || null,
    type: form.type,
    quantity: form.quantity === '' ? null : Number(form.quantity),
    unit: form.unit || null,
    status: form.status,
    isActive: form.isActive,
    productIds: form.productIds
  })
}
</script>
