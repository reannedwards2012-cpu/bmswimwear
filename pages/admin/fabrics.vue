<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Fabric *Inventory*" size="sm" as="h1" />
      <button type="button" class="btn-primary" @click="openCreate">Add fabric</button>
    </div>

    <p v-if="deleteSuccessMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">
      {{ deleteSuccessMessage }}
    </p>

    <p v-if="pending" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading fabrics…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load fabrics.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!fabrics.length" class="mt-8 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">No fabrics yet.</p>
      <button type="button" class="btn-primary mt-6" @click="openCreate">Add your first fabric</button>
    </div>

    <div v-else class="mt-8 overflow-x-auto rounded-4xl bg-cream shadow-card">
      <table class="w-full min-w-[50rem] text-left text-sm">
        <thead>
          <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
            <th class="px-5 py-4">Fabric</th>
            <th class="px-5 py-4">Type</th>
            <th class="px-5 py-4">Qty</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Active</th>
            <th class="px-5 py-4">Products</th>
            <th class="px-5 py-4" />
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr
            v-for="f in fabrics"
            :key="f.id"
            tabindex="0"
            role="button"
            :aria-label="`Edit ${f.name}`"
            class="cursor-pointer transition-colors hover:bg-shell/50 focus-visible:bg-shell/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral"
            @click="rowActivate($event, () => openEdit(f))"
            @keydown="rowKeydown($event, () => openEdit(f))"
          >
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                <img v-if="f.imageUrl" :src="f.imageUrl" :alt="f.name" class="h-8 w-8 shrink-0 rounded-full object-cover" />
                <span
                  v-else
                  class="h-8 w-8 shrink-0 rounded-full border border-ink/10"
                  :style="{ backgroundColor: f.hexColor || '#e5e0d8' }"
                />
                <div class="min-w-0">
                  <p class="truncate font-medium text-ink">{{ f.name }}</p>
                  <p class="truncate text-xs text-ink/40">{{ f.slug }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-4 capitalize text-ink/70">{{ f.type }}</td>
            <td class="px-5 py-4 text-ink/70">{{ f.quantity != null ? `${f.quantity} ${f.unit || ''}`.trim() : '—' }}</td>
            <td class="px-5 py-4">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(f.status)">
                {{ statusLabel(f.status) }}
              </span>
            </td>
            <td class="px-5 py-4">
              <span :class="f.isActive ? 'text-ink/70' : 'text-ink/30'">{{ f.isActive ? 'Active' : 'Inactive' }}</span>
            </td>
            <td class="max-w-[16rem] px-5 py-4 text-xs text-ink/50">
              <span v-if="f.productIds.length">{{ f.productIds.map(productTitle).join(', ') }}</span>
              <span v-else class="text-ink/30">Not linked to any product</span>
            </td>
            <td class="px-5 py-4 text-right">
              <button
                data-row-action
                type="button"
                class="text-ink/35 transition-colors hover:text-coral"
                :aria-label="`Delete ${f.name}`"
                :title="`Delete ${f.name}`"
                @click.stop="confirmDelete(f)"
              >
                <IconTrash class="h-4 w-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminFabricForm
      v-if="formOpen"
      :key="editingFabric?.id || 'new'"
      :fabric="editingFabric"
      :product-options="productOptions"
      :saving="saving"
      :form-error="formError"
      :form-issues="formIssues"
      @submit="handleSubmit"
      @cancel="closeForm"
    />

    <!-- delete confirmation — intentionally a separate, explicit step -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="deleteTarget = null"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Delete “{{ deleteTarget.name }}”?</h2>
        <p class="mt-2 text-sm text-ink/60">
          This permanently deletes the fabric and removes it from any products currently using it. This can’t be undone.
        </p>
        <p v-if="deleteError" class="mt-3 text-sm text-coral">{{ deleteError }}</p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="deleting" @click="deleteTarget = null">Cancel</button>
          <button
            type="button"
            class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deleting"
            @click="doDelete"
          >
            {{ deleting ? 'Deleting…' : 'Delete fabric' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { rowActivate, rowKeydown } from '~/utils/adminRowClick.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Fabric inventory — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
  })
}

const {
  data,
  pending,
  error: loadError,
  refresh
} = useLazyAsyncData('admin-fabrics', () => authedFetch('/api/admin/fabrics'), { server: false })

const fabrics = computed(() => data.value?.fabrics ?? [])

// Product-compatibility options — the live Supabase catalogue (Phase C).
// The Test Product is excluded, matching the server-side validation. `id`
// here is the product SLUG (what product_fabrics.product_id stores).
const { data: productData } = useLazyAsyncData('admin-fabrics-products', () => authedFetch('/api/admin/products'), {
  server: false
})
const productOptions = computed(() =>
  (productData.value?.products ?? [])
    .filter((p) => p.slug !== 'test-product')
    .map((p) => ({ id: p.slug, title: p.name, category: p.category }))
)
const productTitle = (id) => productOptions.value.find((p) => p.id === id)?.title ?? id

const STATUS_STYLES = {
  available: 'bg-shell text-ink/70',
  low: 'bg-blush/30 text-ink',
  unavailable: 'bg-coral/15 text-coral'
}
const statusClass = (s) => STATUS_STYLES[s] || 'bg-shell text-ink/70'
const statusLabel = (s) => (s === 'low' ? 'Low' : s === 'unavailable' ? 'Unavailable' : 'Available')

const formOpen = ref(false)
const editingFabric = ref(null) // null = creating
const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

function openCreate() {
  editingFabric.value = null
  formError.value = ''
  formIssues.value = []
  formOpen.value = true
}
function openEdit(fabric) {
  editingFabric.value = fabric
  formError.value = ''
  formIssues.value = []
  formOpen.value = true
}
function closeForm() {
  formOpen.value = false
}

async function handleSubmit(payload) {
  saving.value = true
  formError.value = ''
  formIssues.value = []
  // Captured before the save so we know whether the image actually changed
  // (replaced or removed) — cleanup only fires once the new state is
  // confirmed persisted, never before.
  const previousImageUrl = editingFabric.value?.imageUrl ?? null
  try {
    const res = editingFabric.value
      ? await authedFetch(`/api/admin/fabrics/${editingFabric.value.id}`, { method: 'PATCH', body: payload })
      : await authedFetch('/api/admin/fabrics', { method: 'POST', body: payload })

    formOpen.value = false
    await refresh()

    // Best-effort: delete the now-unreferenced Storage object if the image
    // changed. Never blocks or fails the save — this is cleanup, not a
    // user-facing action.
    const newImageUrl = res?.fabric?.imageUrl ?? null
    if (previousImageUrl && previousImageUrl !== newImageUrl) {
      authedFetch('/api/admin/fabrics/image', { method: 'DELETE', body: { url: previousImageUrl } }).catch(() => {})
    }
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving this fabric.'
    formIssues.value = err?.data?.issues || []
  } finally {
    saving.value = false
  }
}

// ── delete (permanent — distinct from isActive, which just hides a fabric) ──
const deleteTarget = ref(null) // the fabric object, or null
const deleting = ref(false)
const deleteError = ref('')
const deleteSuccessMessage = ref('')
let successTimer = null

function confirmDelete(fabric) {
  deleteTarget.value = fabric
  deleteError.value = ''
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await authedFetch(`/api/admin/fabrics/${deleteTarget.value.id}`, { method: 'DELETE' })
    const name = deleteTarget.value.name
    deleteTarget.value = null
    await refresh()

    clearTimeout(successTimer)
    deleteSuccessMessage.value = `“${name}” was deleted.`
    successTimer = setTimeout(() => {
      deleteSuccessMessage.value = ''
    }, 4000)
  } catch (err) {
    deleteError.value = err?.data?.error || 'Could not delete this fabric. Please try again.'
  } finally {
    deleting.value = false
  }
}
</script>
