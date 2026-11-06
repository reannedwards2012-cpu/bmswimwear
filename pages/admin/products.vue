<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Product *Management*" size="sm" as="h1" />
      <button type="button" class="btn-primary" @click="openCreate">Add product</button>
    </div>

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

    <!-- bulk-selection action bar — appears only while something is selected -->
    <AdminBulkActionBar :count="selectedCount" @clear="clearSelection">
      <button
        type="button"
        class="rounded-full border border-cream/30 px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-cream/10"
        @click="openBulkStatusConfirm(true)"
      >
        Activate Selected
      </button>
      <button
        type="button"
        class="rounded-full border border-cream/30 px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-cream/10"
        @click="openBulkStatusConfirm(false)"
      >
        Deactivate Selected
      </button>
      <button
        type="button"
        class="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-coral/90"
        @click="bulkDeleteConfirmOpen = true"
      >
        Delete Selected
      </button>
    </AdminBulkActionBar>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading products…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load products.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!products.length" class="mt-8 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">No products yet.</p>
      <button type="button" class="btn-primary mt-6" @click="openCreate">Add your first product</button>
    </div>

    <template v-else>
      <!-- filters — search + a compact labelled Category dropdown -->
      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="relative flex-1 sm:max-w-xs">
          <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" stroke-linecap="round" />
          </svg>
          <input
            v-model.trim="search"
            type="search"
            placeholder="Search by name or slug…"
            class="w-full rounded-full border border-ink/15 bg-cream py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink/35 focus:border-coral focus:outline-none"
          />
        </div>

        <AdminFilterSelect label="Category" v-model="activeCategory" :options="CATEGORY_FILTERS" class="sm:w-52" />
      </div>

      <p class="mt-5 text-xs font-medium text-ink/40">
        {{ filtered.length }} product{{ filtered.length === 1 ? '' : 's' }}{{ hasActiveFilters ? ' found' : '' }}
      </p>

      <div v-if="!filtered.length" class="mt-3 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">No products match these filters.</p>
        <button type="button" class="btn-outline mt-5" @click="clearFilters">Clear filters</button>
      </div>

      <div v-else class="mt-3 overflow-x-auto rounded-4xl bg-cream shadow-card">
        <table class="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
              <th class="w-10 px-5 py-4">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-ink/30 text-coral focus:ring-coral"
                  :checked="allSelected"
                  :indeterminate="indeterminate"
                  aria-label="Select all displayed products"
                  @change="toggleAll"
                />
              </th>
              <th class="px-5 py-4">Product</th>
              <th class="px-5 py-4">Category</th>
              <th class="px-5 py-4">USD</th>
              <th class="px-5 py-4">XCD</th>
              <th class="px-5 py-4">Active</th>
              <th class="px-5 py-4" />
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr
              v-for="p in filtered"
              :key="p.id"
              tabindex="0"
              role="button"
              :aria-label="`Edit ${p.name}`"
              class="cursor-pointer transition-colors hover:bg-shell/50 focus-visible:bg-shell/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-coral"
              @click="rowActivate($event, () => openEdit(p))"
              @keydown="rowKeydown($event, () => openEdit(p))"
            >
              <td class="px-5 py-4">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-ink/30 text-coral focus:ring-coral"
                  :checked="selectedIds.has(p.id)"
                  :aria-label="`Select ${p.name}`"
                  @click.stop
                  @change="toggleSelected(p.id)"
                />
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <span class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-sand/40">
                    <img v-if="p.image" :src="p.image" :alt="p.name" class="h-full w-full object-cover" />
                  </span>
                  <div class="min-w-0">
                    <p class="truncate font-medium text-ink">{{ p.name }}</p>
                    <p class="truncate text-xs text-ink/40">{{ p.slug }}</p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-4 text-ink/70">{{ p.category }}</td>
              <td class="px-5 py-4 text-ink/70">{{ money(p.priceUsdCents / 100) }}</td>
              <td class="px-5 py-4 text-ink/70">XCD ${{ (p.priceXcdCents / 100).toFixed(2) }}</td>
              <td class="px-5 py-4">
                <span :class="p.isActive ? 'text-ink/70' : 'text-ink/30'">{{ p.isActive ? 'Active' : 'Inactive' }}</span>
              </td>
              <td class="px-5 py-4 text-right">
                <button
                  data-row-action
                  type="button"
                  class="text-ink/35 transition-colors hover:text-coral"
                  :aria-label="`Delete ${p.name}`"
                  :title="`Delete ${p.name}`"
                  @click.stop="deleteTarget = p"
                >
                  <IconTrash class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <AdminProductForm
      v-if="formOpen"
      :key="editingId || 'new'"
      :product-id="editingId"
      :product="editingProduct"
      :fabrics="allFabrics"
      @saved="onSaved"
      @cancel="closeForm"
    />

    <!-- permanent delete — explicit, product named, distinct from Inactive -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="deleteTarget = null"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Permanently delete “{{ deleteTarget.name }}”?</h2>
        <p class="mt-2 text-sm text-ink/60">
          This removes it from the catalogue. Existing customer orders will not be affected. To simply stop selling it,
          set it to <span class="font-semibold text-ink">Inactive</span> instead.
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
            {{ deleting ? 'Deleting…' : 'Delete product' }}
          </button>
        </div>
      </div>
    </div>

    <!-- bulk activate / deactivate confirm -->
    <div
      v-if="bulkStatusConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="closeBulkStatusConfirm"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">
          {{ bulkTargetActive ? 'Activate' : 'Deactivate' }} {{ selectedCount }} product{{ selectedCount === 1 ? '' : 's' }}?
        </h2>
        <p class="mt-2 text-sm text-ink/60">
          {{ bulkTargetActive ? 'They’ll be available to customers again.' : 'They’ll stop appearing for customers until reactivated. Nothing is deleted.' }}
        </p>
        <p v-if="bulkStatusError" class="mt-3 text-sm text-coral">{{ bulkStatusError }}</p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="bulkStatusUpdating" @click="closeBulkStatusConfirm">Cancel</button>
          <button
            type="button"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="bulkStatusUpdating"
            @click="doBulkStatusUpdate"
          >
            {{ bulkStatusUpdating ? 'Working…' : bulkTargetActive ? 'Activate' : 'Deactivate' }}
          </button>
        </div>
      </div>
    </div>

    <!-- bulk delete confirm -->
    <AdminBulkDeleteConfirmModal
      :open="bulkDeleteConfirmOpen"
      :count="selectedCount"
      :busy="bulkDeleting"
      :error="bulkDeleteError"
      singular-noun="product"
      plural-noun="products"
      @confirm="doBulkDelete"
      @cancel="bulkDeleteConfirmOpen = false"
    >
      <template #description>
        The Test Product and anything referenced by a stockist’s inventory will be skipped and kept — deactivate
        those instead. Existing customer orders are never affected. This can’t be undone for anything that is deleted.
      </template>
    </AdminBulkDeleteConfirmModal>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { formatUsd } from '~/utils/money'
import { CATEGORIES } from '~/data/constants.js'
import { rowActivate, rowKeydown } from '~/utils/adminRowClick.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Products — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
const money = formatUsd

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' }
  })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'admin-products',
  () => authedFetch('/api/admin/products'),
  { server: false }
)
const products = computed(() => data.value?.products ?? [])

const { data: fabricData } = useLazyAsyncData('admin-products-fabrics', () => authedFetch('/api/admin/fabrics'), {
  server: false
})
const allFabrics = computed(() => fabricData.value?.fabrics ?? [])

// ── filters (client-side — only 15 products, no backend needed) ──
const CATEGORY_FILTERS = [{ value: 'all', label: 'All Categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]
const search = ref('')
const activeCategory = ref('all')
const hasActiveFilters = computed(() => !!search.value || activeCategory.value !== 'all')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return products.value.filter((p) => {
    if (activeCategory.value !== 'all' && p.category !== activeCategory.value) return false
    if (q && !p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false
    return true
  })
})

function clearFilters() {
  search.value = ''
  activeCategory.value = 'all'
}

// ── bulk selection — scoped to whatever rows are CURRENTLY displayed
// (i.e. `filtered`, not the full unfiltered `products`) — cleared below
// whenever the filters change.
const { selectedIds, selectedCount, toggle: toggleSelected, clear: clearSelection, remove: removeFromSelection, allSelected, indeterminate, toggleAll } =
  useAdminBulkSelection(filtered)
watch([search, activeCategory], () => clearSelection())

// ── create / edit ──
const formOpen = ref(false)
const editingId = ref(null)
const editingProduct = ref(null)
const savedMessage = ref('')
let savedTimer = null

function openCreate() {
  editingId.value = null
  editingProduct.value = null
  formOpen.value = true
}

async function openEdit(listRow) {
  editingId.value = listRow.id
  editingProduct.value = null
  formOpen.value = true
  try {
    const res = await authedFetch(`/api/admin/products/${listRow.id}`)
    editingProduct.value = res.product
  } catch (err) {
    flash(err?.data?.error || 'Could not load this product.')
    formOpen.value = false
  }
}

function closeForm() {
  formOpen.value = false
}

function flash(msg) {
  clearTimeout(savedTimer)
  savedMessage.value = msg
  savedTimer = setTimeout(() => (savedMessage.value = ''), 4000)
}

async function onSaved(product) {
  formOpen.value = false
  await refresh()
  flash(`“${product?.name ?? 'Product'}” saved.`)
}

// ── permanent delete ──
const deleteTarget = ref(null)
const deleting = ref(false)
const deleteError = ref('')

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await authedFetch(`/api/admin/products/${deleteTarget.value.id}`, { method: 'DELETE' })
    const name = deleteTarget.value.name
    removeFromSelection(deleteTarget.value.id)
    deleteTarget.value = null
    await refresh()
    flash(`“${name}” was permanently deleted.`)
  } catch (err) {
    deleteError.value = err?.data?.error || 'Could not delete this product. Please try again.'
  } finally {
    deleting.value = false
  }
}

function summarizeSkips(skipped) {
  if (!skipped?.length) return ''
  const reasons = [...new Set(skipped.map((s) => s.reason))]
  return ` ${skipped.length} skipped (${reasons.join('; ')}).`
}

// ── bulk activate / deactivate ──────────────────────────────────────────────
const bulkStatusConfirmOpen = ref(false)
const bulkTargetActive = ref(true)
const bulkStatusUpdating = ref(false)
const bulkStatusError = ref('')

function openBulkStatusConfirm(targetActive) {
  if (selectedCount.value === 0) return
  bulkTargetActive.value = targetActive
  bulkStatusError.value = ''
  bulkStatusConfirmOpen.value = true
}
function closeBulkStatusConfirm() {
  if (bulkStatusUpdating.value) return
  bulkStatusConfirmOpen.value = false
}
async function doBulkStatusUpdate() {
  if (selectedCount.value === 0) return
  bulkStatusUpdating.value = true
  bulkStatusError.value = ''
  try {
    const ids = [...selectedIds.value]
    const res = await authedFetch('/api/admin/products/bulk-status', {
      method: 'POST',
      body: { ids, isActive: bulkTargetActive.value }
    })
    bulkStatusConfirmOpen.value = false
    clearSelection()
    await refresh()
    flash(`${bulkTargetActive.value ? 'Activated' : 'Deactivated'} ${res.updatedCount} of ${res.requestedCount} selected.`)
  } catch (err) {
    bulkStatusError.value = err?.data?.error || 'Could not update the selected products. Please try again.'
  } finally {
    bulkStatusUpdating.value = false
  }
}

// ── bulk delete — skips the Test Product + anything stockist-referenced ────
const bulkDeleteConfirmOpen = ref(false)
const bulkDeleting = ref(false)
const bulkDeleteError = ref('')

async function doBulkDelete() {
  if (selectedCount.value === 0) return
  bulkDeleting.value = true
  bulkDeleteError.value = ''
  try {
    const ids = [...selectedIds.value]
    const res = await authedFetch('/api/admin/products/bulk-delete', { method: 'POST', body: { ids } })
    bulkDeleteConfirmOpen.value = false
    clearSelection()
    await refresh()
    flash(`Deleted ${res.deletedCount} of ${res.requestedCount} selected.${summarizeSkips(res.skipped)}`)
  } catch (err) {
    bulkDeleteError.value = err?.data?.error || 'Could not delete the selected products. Please try again.'
  } finally {
    bulkDeleting.value = false
  }
}
</script>
