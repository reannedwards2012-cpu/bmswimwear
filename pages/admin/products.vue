<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Product *Management*" size="sm" as="h1" />
      <button type="button" class="btn-primary" @click="openCreate">Add product</button>
    </div>

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

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
      <!-- filters -->
      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
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

        <div class="scrollbar-hide flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
          <button
            v-for="c in CATEGORY_FILTERS"
            :key="c.value"
            type="button"
            class="shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest2 transition-colors"
            :class="activeCategory === c.value ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/60 hover:border-ink/40'"
            @click="activeCategory = c.value"
          >
            {{ c.label }}
          </button>
        </div>
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
              <th class="px-5 py-4">Product</th>
              <th class="px-5 py-4">Category</th>
              <th class="px-5 py-4">USD</th>
              <th class="px-5 py-4">XCD</th>
              <th class="px-5 py-4">Active</th>
              <th class="px-5 py-4" />
            </tr>
          </thead>
          <tbody class="divide-y divide-ink/10">
            <tr v-for="p in filtered" :key="p.id">
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
                <div class="flex flex-col items-end gap-2">
                  <button type="button" class="text-xs font-semibold text-coral link-underline" @click="openEdit(p)">Edit</button>
                  <button
                    type="button"
                    class="text-ink/35 transition-colors hover:text-coral"
                    :aria-label="`Delete ${p.name}`"
                    :title="`Delete ${p.name}`"
                    @click="deleteTarget = p"
                  >
                    <IconTrash class="h-4 w-4" />
                  </button>
                </div>
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
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatUsd } from '~/utils/money'
import { CATEGORIES } from '~/data/constants.js'

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
    deleteTarget.value = null
    await refresh()
    flash(`“${name}” was permanently deleted.`)
  } catch (err) {
    deleteError.value = err?.data?.error || 'Could not delete this product. Please try again.'
  } finally {
    deleting.value = false
  }
}
</script>
