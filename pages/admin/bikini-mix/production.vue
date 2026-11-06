<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Swimsuit *Mixer*" size="sm" as="h1" />
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

    <div v-if="previewMode" class="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-ink/70">
      🔧 <strong>Preview mode</strong> — the Swimsuit Mixer database migration hasn't been applied yet, so this page
      is showing a production summary derived from local mock bookings. The "Prepared" checklist is fully
      interactive (updates in memory only); CSV export still requires the real database.
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading…</p>

    <div v-else-if="loadError && !previewMode" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load the production summary.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <template v-else-if="data">
      <AdminMetricCard class="mt-6 max-w-xs" label="Confirmed Guests" :value="String(data.confirmedCount)" />

      <div v-if="!data.confirmedCount" class="mt-6 rounded-4xl bg-cream p-8 text-center shadow-card">
        <p class="text-sm text-ink/70">No confirmed bookings yet.</p>
      </div>

      <div v-else class="mt-6 grid gap-6 lg:grid-cols-4">
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
          <h2 class="font-display text-base font-semibold text-ink">Bikini Bottoms</h2>
          <ul class="mt-3 space-y-2 text-sm">
            <li v-for="(row, i) in data.bottoms" :key="i" class="flex items-center justify-between gap-2">
              <span class="text-ink/70">{{ row.style }}, {{ row.coverage }}, {{ row.scrunch }}, size {{ row.size }}, {{ row.colour }}</span>
              <span class="shrink-0 font-semibold text-ink">{{ row.count }}</span>
            </li>
          </ul>
        </section>
        <section class="rounded-4xl bg-cream p-6 shadow-card">
          <h2 class="font-display text-base font-semibold text-ink">One-Pieces</h2>
          <ul v-if="data.onePieces?.length" class="mt-3 space-y-2 text-sm">
            <li v-for="(row, i) in data.onePieces" :key="i" class="flex items-center justify-between gap-2">
              <span class="text-ink/70">{{ row.coverage }}, size {{ row.size }}, {{ row.colour }}</span>
              <span class="shrink-0 font-semibold text-ink">{{ row.count }}</span>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-ink/45">None yet.</p>
        </section>
      </div>

      <!-- Production Checklist — one card per confirmed guest, separate from
           the grouped cutting totals above. The "Prepared" checkbox is
           purely an operational flag (base_prepared_at), never read by any
           payment/booking/capacity logic. -->
      <div v-if="data.confirmedCount" class="mt-10">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-semibold text-ink">Production Checklist</h2>
            <p class="mt-1 text-sm text-ink/60">Check off each guest's base once it's prepared. Saved automatically.</p>
          </div>
          <label class="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-ink/60">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-ink/30 text-coral focus:ring-coral"
              :checked="allSelected"
              :indeterminate="indeterminate"
              aria-label="Select all checklist entries"
              @change="toggleAll"
            />
            Select all
          </label>
        </div>

        <!-- bulk-selection action bar — appears only while something is selected -->
        <AdminBulkActionBar :count="selectedCount" @clear="clearSelection">
          <button
            type="button"
            class="rounded-full border border-cream/30 px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-cream/10"
            @click="openBulkPreparedConfirm(false)"
          >
            Mark Not Prepared
          </button>
          <button
            type="button"
            class="rounded-full bg-coral px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-coral/90"
            @click="openBulkPreparedConfirm(true)"
          >
            Mark Prepared
          </button>
        </AdminBulkActionBar>
        <p v-if="bulkResultMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ bulkResultMessage }}</p>

        <div class="mt-4 space-y-3">
          <section
            v-for="row in data.bookings"
            :key="row.id"
            class="rounded-3xl bg-cream p-5 shadow-card transition-colors"
            :class="row.basePreparedAt ? 'ring-2 ring-emerald-400/60' : ''"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 shrink-0 rounded border-ink/30 text-coral focus:ring-coral"
                  :checked="selectedIds.has(row.id)"
                  :aria-label="`Select ${row.bookingNumber}`"
                  @change="toggleSelected(row.id)"
                />
                <div>
                  <p class="font-semibold text-ink">{{ row.bookingNumber }} — {{ row.fullName }}</p>
                  <p class="text-xs text-ink/50">{{ row.garmentType === 'onepiece' ? 'One-Piece' : 'Bikini' }} · {{ row.ticketTier }}</p>
                </div>
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

            <dl v-if="row.garmentType === 'onepiece'" class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Size</dt><dd class="text-ink">{{ row.onepieceSize }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Coverage</dt><dd class="text-ink">{{ row.onepieceCoverage }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Fabric</dt><dd class="text-ink">{{ row.onepieceFabricName }}</dd></div>
            </dl>
            <dl v-else class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Top size</dt><dd class="text-ink">{{ row.topSize }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Left triangle</dt><dd class="text-ink">{{ row.leftFabricName }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Right triangle</dt><dd class="text-ink">{{ row.rightFabricName }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Bottom size</dt><dd class="text-ink">{{ row.bottomSize }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Bottom fabric</dt><dd class="text-ink">{{ row.bottomFabricName }}</dd></div>
              <div><dt class="text-[0.65rem] uppercase tracking-widest2 text-ink/40">Style / Coverage</dt><dd class="text-ink">{{ row.bottomStyle }}, {{ row.bottomCoverage }}{{ row.bottomScrunch ? ', scrunch' : '' }}</dd></div>
            </dl>
            <p v-if="prepareError[row.id]" class="mt-2 text-xs text-coral">{{ prepareError[row.id] }}</p>
          </section>
        </div>
      </div>
    </template>

    <!-- bulk prepared / not-prepared confirm -->
    <div
      v-if="bulkPreparedConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="closeBulkPreparedConfirm"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">
          {{ bulkPreparedTarget ? 'Mark' : 'Unmark' }} {{ selectedCount }} entr{{ selectedCount === 1 ? 'y' : 'ies' }}
          {{ bulkPreparedTarget ? 'prepared' : 'as not prepared' }}?
        </h2>
        <p class="mt-2 text-sm text-ink/60">
          This only updates the production checklist flag — nothing about payment, booking status, or guest details changes.
        </p>
        <p v-if="bulkPreparedError" class="mt-3 text-sm text-coral">{{ bulkPreparedError }}</p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="bulkPreparedUpdating" @click="closeBulkPreparedConfirm">Cancel</button>
          <button
            type="button"
            class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="bulkPreparedUpdating"
            @click="doBulkPrepared"
          >
            {{ bulkPreparedUpdating ? 'Working…' : 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { mockProductionSummary } from '~/data/bikiniMixAdminMock.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Swimsuit Mixer Production — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

function isNotConfigured(err) {
  return err?.statusCode === 503 || err?.data?.configured === false
}
const previewMode = ref(false)

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  'bikini-mix-production',
  () => authedFetch('/api/admin/bikini-mix/production-summary'),
  { server: false }
)
watch(loadError, (err) => {
  if (err && isNotConfigured(err)) {
    previewMode.value = true
    data.value = mockProductionSummary()
  }
})

// ── CSV export ───────────────────────────────────────────────────────────
const exporting = ref(false)
const exportError = ref('')

async function exportCsv() {
  if (exporting.value) return
  if (previewMode.value) {
    exportError.value = 'CSV export requires the real database — not available in preview mode.'
    return
  }
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
    a.download = `swimsuit-mixer-bookings-${new Date().toISOString().slice(0, 10)}.csv`
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

// ── bulk selection — scoped to the checklist rows currently shown. Every
// row here is already a confirmed booking (the only kind this checklist
// ever lists), so the bulk endpoint's "only confirmed" guard is always
// satisfied in practice — kept server-side anyway as the real guarantee.
const checklistRows = computed(() => data.value?.bookings ?? [])
const { selectedIds, selectedCount, toggle: toggleSelected, clear: clearSelection, allSelected, indeterminate, toggleAll } =
  useAdminBulkSelection(checklistRows)

const bulkResultMessage = ref('')
let bulkResultTimer = null
function flashBulkResult(msg) {
  clearTimeout(bulkResultTimer)
  bulkResultMessage.value = msg
  bulkResultTimer = setTimeout(() => (bulkResultMessage.value = ''), 6000)
}

const bulkPreparedConfirmOpen = ref(false)
const bulkPreparedTarget = ref(true)
const bulkPreparedUpdating = ref(false)
const bulkPreparedError = ref('')

function openBulkPreparedConfirm(target) {
  if (selectedCount.value === 0) return
  bulkPreparedTarget.value = target
  bulkPreparedError.value = ''
  bulkPreparedConfirmOpen.value = true
}
function closeBulkPreparedConfirm() {
  if (bulkPreparedUpdating.value) return
  bulkPreparedConfirmOpen.value = false
}
async function doBulkPrepared() {
  if (selectedCount.value === 0) return
  bulkPreparedUpdating.value = true
  bulkPreparedError.value = ''
  const ids = [...selectedIds.value]
  const target = bulkPreparedTarget.value

  // Preview mode: optimistic local update only — no real booking rows to PATCH.
  if (previewMode.value) {
    for (const row of checklistRows.value) {
      if (ids.includes(row.id)) row.basePreparedAt = target ? new Date().toISOString() : null
    }
    bulkPreparedConfirmOpen.value = false
    clearSelection()
    bulkPreparedUpdating.value = false
    flashBulkResult(`${target ? 'Marked' : 'Unmarked'} ${ids.length} as prepared.`)
    return
  }

  try {
    const res = await authedFetch('/api/admin/bikini-mix/bookings/bulk-prepared', {
      method: 'POST',
      body: { ids, prepared: target }
    })
    bulkPreparedConfirmOpen.value = false
    clearSelection()
    await refresh()
    const skippedNote = res.skipped?.length ? ` ${res.skipped.length} skipped (not confirmed).` : ''
    flashBulkResult(`${target ? 'Marked' : 'Unmarked'} ${res.updatedCount} of ${res.requestedCount}.${skippedNote}`)
  } catch (err) {
    bulkPreparedError.value = err?.data?.error || 'Could not update the selected entries. Please try again.'
  } finally {
    bulkPreparedUpdating.value = false
  }
}

// ── Production Checklist: per-row "prepared" toggle ─────────────────────
const togglingId = ref(null)
const prepareError = reactive({})

async function togglePrepared(row, checked) {
  togglingId.value = row.id
  prepareError[row.id] = ''
  const previous = row.basePreparedAt
  row.basePreparedAt = checked ? new Date().toISOString() : null // optimistic

  // Preview mode: base_prepared_at predates this migration and would
  // normally still work, but there's no real booking row behind this mock
  // id to PATCH — keep the optimistic local update as the final state.
  if (previewMode.value) {
    togglingId.value = null
    return
  }

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
