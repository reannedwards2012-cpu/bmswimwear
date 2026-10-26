<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Custom *Quotes*" size="sm" as="h1" />
    </div>

    <AdminQuoteSubNav class="mt-6" />

    <p v-if="pending" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load pricing settings.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <div v-else class="mt-8">
      <AdminQuoteCalculatorForm
        :settings="data.settings.settings"
        :fabrics="data.fabrics.fabrics"
        :saving="saving"
        :form-error="formError"
        :form-issues="formIssues"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'New Quote — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'quote-new-prereqs',
  () => Promise.all([authedFetch('/api/admin/quotes/settings'), authedFetch('/api/admin/fabrics')]).then(([settings, fabrics]) => ({ settings, fabrics })),
  { server: false }
)

const saving = ref(false)
const formError = ref('')
const formIssues = ref([])

async function onSubmit(payload) {
  saving.value = true
  formError.value = ''
  formIssues.value = []
  try {
    const res = await authedFetch('/api/admin/quotes', { method: 'POST', body: payload })
    await navigateTo(`/admin/quotes/${res.quote.id}`)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving this quote.'
    formIssues.value = err?.data?.issues || []
  } finally {
    saving.value = false
  }
}
</script>
