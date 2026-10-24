<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Bikini *Mix*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-ink/60">
        Cutting/sewing quantities from confirmed bookings only — a payment flagged "needs review" never counts here
        until an admin resolves it.
      </p>
      <button type="button" class="btn-outline shrink-0 disabled:cursor-not-allowed disabled:opacity-60" :disabled="exporting" @click="exportCsv">
        {{ exporting ? 'Exporting…' : 'Export CSV' }}
      </button>
    </div>
    <p v-if="exportError" class="mt-2 text-sm text-coral">{{ exportError }}</p>

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

      <!-- Production Checklist — one card per confirmed guest, separate from
           the grouped cutting totals above. The "Prepared" checkbox is
           purely an operational flag (base_prepared_at), never read by any
           payment/booking/capacity logic. -->
      <div v-if="data.confirmedCount" class="mt-10">
        <h2 class="font-display text-lg font-semibold text-ink">Production Checklist</h2>
        <p class="mt-1 text-sm text-ink/60">Check off each guest's base once it's prepared. Saved automatically.</p>

        <div class="mt-4 space-y-3">
          <section
            v-for="row in data.bookings"
            :key="row.id"
            class="rounded-3xl bg-cream p-5 shadow-card transition-colors"
            :class="row.basePreparedAt ? 'ring-2 ring-emerald-400/60' : ''"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-ink">{{ row.bookingNumber }} — {{ row.fullName }}</p>
                <p class="text-xs text-ink/50">{{ row.package }}</p>
              </div>
              <label class="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-ink/60">
                <input
                  type="checkbox"
                  class="h-5 w-5 rounded border-ink/25 text-coral focus:ring-coral disabled:cursor-not-allowed"
                  :checked="!!row.basePreparedAt"
                  :disabled="togglingId === row.id"
                  @change="togglePrepared(row, $event.target.checked)"
                />
                {{ row.basePreparedAt ? 'Prepared' : 'Mark prepared' }}
              </label>
            </div>

            <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Top size</dt><dd class="text-ink">{{ row.topSize }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Left triangle</dt><dd class="text-ink">{{ row.leftFabricName }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Right triangle</dt><dd class="text-ink">{{ row.rightFabricName }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Bottom size</dt><dd class="text-ink">{{ row.bottomSize }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Bottom fabric</dt><dd class="text-ink">{{ row.bottomFabricName }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Style / Coverage</dt><dd class="text-ink">{{ row.bottomStyle }}, {{ row.bottomCoverage }}</dd></div>
            </dl>
            <p v-if="prepareError[row.id]" class="mt-2 text-xs text-coral">{{ prepareError[row.id] }}</p>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

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

// ── CSV export ───────────────────────────────────────────────────────────
const exporting = ref(false)
const exportError = ref('')

async function exportCsv() {
  if (exporting.value) return
  exporting.value = true
  exportError.value = ''
  try {
    const token = await getAccessToken()
    const res = await fetch('/api/admin/bikini-mix/bookings/export', {
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bikini-mix-bookings-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    exportError.value = 'Could not export bookings. Please try again.'
  } finally {
    exporting.value = false
  }
}

// ── Production Checklist: "prepared" toggle ─────────────────────────────
const togglingId = ref(null)
const prepareError = reactive({})

async function togglePrepared(row, checked) {
  togglingId.value = row.id
  prepareError[row.id] = ''
  const previous = row.basePreparedAt
  row.basePreparedAt = checked ? new Date().toISOString() : null // optimistic
  try {
    const res = await authedFetch(`/api/admin/bikini-mix/bookings/${row.id}/prepared`, {
      method: 'PATCH',
      body: { prepared: checked }
    })
    row.basePreparedAt = res.basePreparedAt
  } catch {
    row.basePreparedAt = previous // rollback
    prepareError[row.id] = 'Could not save — please try again.'
  } finally {
    togglingId.value = null
  }
}
</script>
