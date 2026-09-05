<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="*Products*" size="sm" as="h1" />
      <button type="button" class="btn-primary" @click="openCreate">Add product</button>
    </div>

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

    <p v-if="pending" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading products…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load products.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else-if="!products.length" class="mt-8 rounded-4xl bg-cream p-8 text-center shadow-card">
      <p class="text-sm text-ink/70">No products yet.</p>
      <button type="button" class="btn-primary mt-6" @click="openCreate">Add your first product</button>
    </div>

    <div v-else class="mt-8 overflow-x-auto rounded-4xl bg-cream shadow-card">
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
          <tr v-for="p in products" :key="p.id">
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
              <button type="button" class="text-xs font-semibold text-coral link-underline" @click="openEdit(p)">Edit</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminProductForm
      v-if="formOpen"
      :key="editingId || 'new'"
      :product-id="editingId"
      :product="editingProduct"
      :fabrics="allFabrics"
      @saved="onSaved"
      @cancel="closeForm"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatUsd } from '~/utils/money'

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

// All fabrics (active + inactive) for the compatibility checklist.
const { data: fabricData } = useLazyAsyncData('admin-products-fabrics', () => authedFetch('/api/admin/fabrics'), {
  server: false
})
const allFabrics = computed(() => fabricData.value?.fabrics ?? [])

const formOpen = ref(false)
const editingId = ref(null)
const editingProduct = ref(null) // full detail object, or null when creating / still loading
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
</script>
