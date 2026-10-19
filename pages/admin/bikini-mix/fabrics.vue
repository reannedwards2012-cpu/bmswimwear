<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Bikini *Mix*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <p class="mt-6 text-sm text-ink/60">
      Toggle which existing fabrics customers can choose from in the Bikini Mix builder. Reuses the same fabric
      inventory used everywhere else on the site — nothing here duplicates or edits a fabric itself.
    </p>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading fabrics…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load fabrics.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else class="mt-6 overflow-x-auto rounded-4xl bg-cream shadow-card">
      <table class="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
            <th class="px-5 py-4">Fabric</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Bikini Mix</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr v-for="f in fabrics" :key="f.fabricId">
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                <span
                  class="h-8 w-8 shrink-0 rounded-full border border-ink/10 bg-cover bg-center"
                  :style="f.imageUrl ? { backgroundImage: `url(${f.imageUrl})` } : { backgroundColor: f.hexColor || '#e5e0d8' }"
                />
                <span class="font-medium text-ink">{{ f.name }}</span>
              </div>
            </td>
            <td class="px-5 py-4 capitalize text-ink/60">{{ f.status }}</td>
            <td class="px-5 py-4">
              <button
                type="button"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="f.bikiniMixActive ? 'bg-coral' : 'bg-ink/15'"
                :disabled="togglingId === f.fabricId"
                :aria-pressed="f.bikiniMixActive"
                @click="toggle(f)"
              >
                <span class="inline-block h-4 w-4 transform rounded-full bg-cream transition-transform" :class="f.bikiniMixActive ? 'translate-x-6' : 'translate-x-1'" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="toggleError" class="mt-3 text-sm text-coral">{{ toggleError }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Bikini Mix Fabrics — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData('bikini-mix-fabrics', () => authedFetch('/api/admin/bikini-mix/fabrics'), {
  server: false
})
const fabrics = computed(() => data.value?.fabrics ?? [])

const togglingId = ref(null)
const toggleError = ref('')

async function toggle(f) {
  togglingId.value = f.fabricId
  toggleError.value = ''
  const next = !f.bikiniMixActive
  try {
    await authedFetch(`/api/admin/bikini-mix/fabrics/${f.fabricId}`, { method: 'PATCH', body: { isActive: next } })
    f.bikiniMixActive = next
  } catch (err) {
    toggleError.value = err?.data?.error || 'Could not update this fabric.'
  } finally {
    togglingId.value = null
  }
}
</script>
