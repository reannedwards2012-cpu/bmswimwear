<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Swimsuit *Mixer*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <p class="mt-6 text-sm text-ink/60">
      Photos shown in the customer "See What You Can Customize" overlay — straps, beads, charms, rhinestones,
      iron-on designs, and finished swimsuits. Mark each as included with the ticket, or a paid add-on at the event.
    </p>

    <section class="mt-6 rounded-4xl bg-cream p-6 shadow-card">
      <h2 class="font-display text-base font-semibold text-ink">Add a photo</h2>
      <form class="mt-4 grid gap-4 sm:grid-cols-2" @submit.prevent="onUpload">
        <label class="block">
          <span class="lbl">Category</span>
          <select v-model="uploadForm.category" class="inp">
            <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Caption (optional)</span>
          <input v-model.trim="uploadForm.caption" type="text" class="inp" placeholder="e.g. Gold chain strap" />
        </label>
        <label class="flex items-end pb-2.5 sm:col-span-2">
          <span class="flex items-center gap-2 text-sm text-ink/70">
            <input v-model="uploadForm.includedInTicket" type="checkbox" class="h-4 w-4 accent-coral" />
            Included with the ticket (unchecked = paid add-on at the event)
          </span>
        </label>
        <label class="block sm:col-span-2">
          <span class="lbl">Photo</span>
          <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="inp !py-2" required />
        </label>
        <div class="sm:col-span-2">
          <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="uploading">
            {{ uploading ? 'Uploading…' : 'Upload' }}
          </button>
          <p v-if="uploadError" class="mt-2 text-sm text-coral">{{ uploadError }}</p>
        </div>
      </form>
    </section>

    <div v-if="previewMode" class="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-ink/70">
      🔧 <strong>Preview mode</strong> — the Swimsuit Mixer database migration hasn't been applied yet (the gallery
      table doesn't exist until it is), so this page is showing local mock data. Uploads, toggles and deletes are
      fully interactive but only update this mock data in memory.
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading gallery…</p>
    <div v-else-if="loadError && !previewMode" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load the gallery.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>
    <p v-else-if="!images.length" class="mt-8 rounded-4xl bg-cream p-7 text-center text-sm text-ink/50 shadow-card">No photos yet.</p>

    <template v-else>
      <div class="mt-8 flex flex-wrap items-center justify-between gap-3">
        <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink/60">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-ink/30 text-coral focus:ring-coral"
            :checked="allSelected"
            :indeterminate="indeterminate"
            aria-label="Select all displayed photos"
            @change="toggleAll"
          />
          Select all
        </label>
      </div>

      <!-- bulk-selection action bar — appears only while something is selected -->
      <AdminBulkActionBar :count="selectedCount" @clear="clearSelection">
        <button
          type="button"
          class="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-coral/90"
          @click="bulkDeleteConfirmOpen = true"
        >
          Delete Selected
        </button>
      </AdminBulkActionBar>

      <p v-if="bulkResultMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ bulkResultMessage }}</p>
      <p class="mt-4 text-xs text-ink/45">Drag a photo by its ⠿ handle to reorder — this sets the order shown on the public page.</p>
      <p v-if="reorderError" class="mt-2 text-xs text-coral">{{ reorderError }}</p>

      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <div
        v-for="img in images"
        :key="img.id"
        :data-gallery-id="img.id"
        class="relative overflow-hidden rounded-3xl border border-ink/10 bg-cream shadow-card transition-opacity"
        :class="dragId === img.id ? 'opacity-40' : ''"
      >
        <input
          type="checkbox"
          class="absolute left-2 top-2 z-10 h-5 w-5 rounded border-ink/30 bg-cream/90 text-coral focus:ring-coral"
          :checked="selectedIds.has(img.id)"
          :aria-label="`Select photo ${img.caption || img.id}`"
          @change="toggleSelected(img.id)"
        />
        <button
          type="button"
          class="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full bg-cream/90 text-sm text-ink/50 active:cursor-grabbing"
          aria-label="Drag to reorder"
          @pointerdown="onDragStart($event, img.id)"
        >
          ⠿
        </button>
        <div class="aspect-square w-full bg-cover bg-center" :style="{ backgroundImage: `url(${img.imageUrl})` }" />
        <div class="space-y-2 p-3">
          <p class="truncate text-xs font-semibold text-ink">{{ img.caption || CATEGORY_LABELS[img.category] }}</p>
          <div class="flex items-center justify-between text-[0.65rem]">
            <button type="button" class="rounded-full px-2 py-0.5 font-semibold uppercase tracking-widest2" :class="img.includedInTicket ? 'bg-seafoam/50 text-ink' : 'bg-blush/30 text-ink/70'" @click="toggle(img, 'includedInTicket')">
              {{ img.includedInTicket ? 'Included' : 'Add at event' }}
            </button>
            <button type="button" class="rounded-full px-2 py-0.5 font-semibold uppercase tracking-widest2" :class="img.isActive ? 'bg-shell text-ink/60' : 'bg-ink/10 text-ink/40'" @click="toggle(img, 'isActive')">
              {{ img.isActive ? 'Visible' : 'Hidden' }}
            </button>
          </div>
          <button type="button" class="text-[0.65rem] font-semibold text-coral hover:underline" @click="remove(img)">Delete</button>
        </div>
      </div>
      </div>
    </template>

    <!-- bulk delete confirm -->
    <AdminBulkDeleteConfirmModal
      :open="bulkDeleteConfirmOpen"
      :count="selectedCount"
      :busy="bulkDeleting"
      :error="bulkDeleteError"
      singular-noun="photo"
      plural-noun="photos"
      @confirm="doBulkDelete"
      @cancel="bulkDeleteConfirmOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { mockGalleryImages } from '~/data/bikiniMixAdminMock.js'
import { reorderList } from '~/utils/reorderList.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Swimsuit Mixer Gallery — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const CATEGORIES = [
  { value: 'strap', label: 'Strap' },
  { value: 'bead', label: 'Bead' },
  { value: 'charm', label: 'Charm' },
  { value: 'rhinestone', label: 'Rhinestone' },
  { value: 'iron_on', label: 'Iron-on design' },
  { value: 'finished_swimsuit', label: 'Finished swimsuit' }
]
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

function isNotConfigured(err) {
  return err?.statusCode === 503 || err?.data?.configured === false
}

const previewMode = ref(false)

const { data, pending, error: loadError, refresh } = useLazyAsyncData('admin-bikini-mix-gallery', () => authedFetch('/api/admin/bikini-mix/gallery'), {
  server: false
})
watch(loadError, (err) => {
  if (err && isNotConfigured(err)) {
    previewMode.value = true
    data.value = { images: mockGalleryImages() }
  }
})
const images = computed(() => data.value?.images ?? [])

// ── bulk selection — scoped to whatever photos are CURRENTLY displayed ─────
const {
  selectedIds,
  selectedCount,
  toggle: toggleSelected,
  clear: clearSelection,
  remove: removeFromSelection,
  allSelected,
  indeterminate,
  toggleAll
} = useAdminBulkSelection(images)

const fileInput = ref(null)
const uploading = ref(false)
const uploadError = ref('')
const uploadForm = reactive({ category: 'strap', caption: '', includedInTicket: false })

async function onUpload() {
  const file = fileInput.value?.files?.[0]
  if (!file) {
    uploadError.value = 'Choose a photo first.'
    return
  }
  uploading.value = true
  uploadError.value = ''

  // Preview mode: the gallery table doesn't exist to insert into yet — add
  // a mock row using a local blob URL for the selected file, so the grid
  // genuinely shows the photo just picked, never a real upload attempt.
  if (previewMode.value) {
    const image = {
      id: `mock-${Date.now()}`,
      imageUrl: URL.createObjectURL(file),
      caption: uploadForm.caption,
      category: uploadForm.category,
      includedInTicket: uploadForm.includedInTicket,
      sortOrder: null,
      isActive: true,
      createdAt: new Date().toISOString()
    }
    data.value.images = [...data.value.images, image]
    uploadForm.caption = ''
    uploadForm.includedInTicket = false
    if (fileInput.value) fileInput.value.value = ''
    uploading.value = false
    return
  }

  try {
    const token = await getAccessToken()
    const body = new FormData()
    body.append('file', file)
    body.append('category', uploadForm.category)
    body.append('caption', uploadForm.caption)
    body.append('includedInTicket', String(uploadForm.includedInTicket))
    const res = await $fetch('/api/admin/bikini-mix/gallery/image', {
      method: 'POST',
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (data.value) data.value.images = [...data.value.images, res.image]
    uploadForm.caption = ''
    uploadForm.includedInTicket = false
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    uploadError.value = err?.data?.error || 'Upload failed — please try again.'
  } finally {
    uploading.value = false
  }
}

async function toggle(img, field) {
  const next = !img[field]
  if (previewMode.value) {
    img[field] = next
    return
  }
  try {
    const res = await authedFetch(`/api/admin/bikini-mix/gallery/${img.id}`, { method: 'PATCH', body: { [field]: next } })
    Object.assign(img, res.image)
  } catch {
    // left unchanged on failure — no silent local mutation
  }
}

async function remove(img) {
  if (previewMode.value) {
    data.value.images = data.value.images.filter((i) => i.id !== img.id)
    removeFromSelection(img.id)
    return
  }
  try {
    await authedFetch(`/api/admin/bikini-mix/gallery/${img.id}`, { method: 'DELETE' })
    if (data.value) data.value.images = data.value.images.filter((i) => i.id !== img.id)
    removeFromSelection(img.id)
  } catch {
    /* leave it listed if deletion failed */
  }
}

// ── drag-and-drop reorder — pointer events (not native HTML5 DnD) so the
// same code path drives both mouse and touch dragging, including mobile.
// Reorders live, in the local list, as the pointer passes over another
// card; the final order is only persisted once, on release. ───────────────
const dragId = ref(null)
const reorderError = ref('')
let dragHandleEl = null

function onDragStart(e, id) {
  e.preventDefault()
  dragId.value = id
  reorderError.value = ''
  dragHandleEl = e.currentTarget
  dragHandleEl.setPointerCapture?.(e.pointerId)
  dragHandleEl.addEventListener('pointermove', onDragMove)
  dragHandleEl.addEventListener('pointerup', onDragEnd)
  dragHandleEl.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e) {
  if (!dragId.value || !data.value) return
  const el = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(e.clientX, e.clientY) : null
  const targetId = el?.closest('[data-gallery-id]')?.getAttribute('data-gallery-id')
  if (!targetId) return
  const next = reorderList(data.value.images, dragId.value, targetId)
  if (next !== data.value.images) data.value.images = next
}

async function onDragEnd() {
  if (dragHandleEl) {
    dragHandleEl.removeEventListener('pointermove', onDragMove)
    dragHandleEl.removeEventListener('pointerup', onDragEnd)
    dragHandleEl.removeEventListener('pointercancel', onDragEnd)
    dragHandleEl = null
  }
  const wasDragging = dragId.value != null
  dragId.value = null
  if (!wasDragging) return

  const order = images.value.map((img) => img.id)
  if (previewMode.value) {
    data.value.images.forEach((img, i) => { img.sortOrder = i })
    return
  }
  try {
    await authedFetch('/api/admin/bikini-mix/gallery/reorder', { method: 'POST', body: { order } })
  } catch {
    reorderError.value = 'Could not save the new order — please try again.'
    await refresh()
  }
}

// ── bulk delete — each photo owns its own Storage object, no cross-table
// safety check needed (unlike fabrics/products) ──────────────────────────
const bulkDeleteConfirmOpen = ref(false)
const bulkDeleting = ref(false)
const bulkDeleteError = ref('')
const bulkResultMessage = ref('')
let bulkResultTimer = null
function flashBulkResult(msg) {
  clearTimeout(bulkResultTimer)
  bulkResultMessage.value = msg
  bulkResultTimer = setTimeout(() => (bulkResultMessage.value = ''), 6000)
}

async function doBulkDelete() {
  if (selectedCount.value === 0) return
  bulkDeleting.value = true
  bulkDeleteError.value = ''
  const ids = [...selectedIds.value]

  if (previewMode.value) {
    data.value.images = data.value.images.filter((i) => !ids.includes(i.id))
    bulkDeleteConfirmOpen.value = false
    clearSelection()
    bulkDeleting.value = false
    flashBulkResult(`Deleted ${ids.length} photo${ids.length === 1 ? '' : 's'}.`)
    return
  }

  try {
    const res = await authedFetch('/api/admin/bikini-mix/gallery/bulk-delete', { method: 'POST', body: { ids } })
    bulkDeleteConfirmOpen.value = false
    clearSelection()
    await refresh()
    flashBulkResult(`Deleted ${res.deletedCount} of ${res.requestedCount} selected.`)
  } catch (err) {
    bulkDeleteError.value = err?.data?.error || 'Could not delete the selected photos. Please try again.'
  } finally {
    bulkDeleting.value = false
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
