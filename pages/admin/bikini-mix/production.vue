<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Bikini *Mix*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <p class="mt-6 text-sm text-ink/60">
      Cutting/sewing quantities from confirmed bookings only — a payment flagged "needs review" never counts here
      until an admin resolves it.
    </p>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load the production summary.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <template v-else-if="data">
      <AdminMetricCard class="mt-6 max-w-xs" label="Confirmed Guests" :value="String(data.confirmedCount)" />

      <div v-if="!data.confirmedCount" class="mt-6 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">No confirmed bookings yet.</p>
      </div>

      <div v-else class="mt-6 grid gap-6 lg:grid-cols-3">
        <section class="rounded-4xl bg-cream p-6 shadow-card">
          <h2 class="font-display text-base font-semibold text-ink">Left Triangles</h2>
          <ul class="mt-3 space-y-2 text-sm">
            <li v-for="(row, i) in data.leftTriangles" :key="i" class="flex items-center justify-between">
              <span class="text-ink/70">{{ row.colour }}, size {{ row.size }}</span>
              <span class="font-semibold text-ink">{{ row.count }}</span>
            </li>
          </ul>
        </section>
        <section class="rounded-4xl bg-cream p-6 shadow-card">
          <h2 class="font-display text-base font-semibold text-ink">Right Triangles</h2>
          <ul class="mt-3 space-y-2 text-sm">
            <li v-for="(row, i) in data.rightTriangles" :key="i" class="flex items-center justify-between">
              <span class="text-ink/70">{{ row.colour }}, size {{ row.size }}</span>
              <span class="font-semibold text-ink">{{ row.count }}</span>
            </li>
          </ul>
        </section>
        <section class="rounded-4xl bg-cream p-6 shadow-card">
          <h2 class="font-display text-base font-semibold text-ink">Bottoms</h2>
          <ul class="mt-3 space-y-2 text-sm">
            <li v-for="(row, i) in data.bottoms" :key="i" class="flex items-center justify-between gap-2">
              <span class="text-ink/70">{{ row.style }}, {{ row.coverage }}, size {{ row.size }}, {{ row.colour }}</span>
              <span class="shrink-0 font-semibold text-ink">{{ row.count }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Bikini Mix Production — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'bikini-mix-production',
  () => authedFetch('/api/admin/bikini-mix/production-summary'),
  { server: false }
)
</script>
