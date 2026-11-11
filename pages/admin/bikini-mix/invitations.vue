<template>
  <div>
    <FancyHeading eyebrow="Admin" title="Swimsuit *Mixer*" size="sm" as="h1" />
    <AdminBikiniMixSubNav class="mt-6" />

    <p class="mt-6 text-sm text-ink/60">
      Complimentary invitation codes for Event Assistants, Giveaway winners, and other non-paying guests. Each code
      is single-use and never counts against the paid capacity. Category caps are set on the Event Settings tab.
    </p>

    <div v-if="previewMode" class="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-ink/70">
      🔧 <strong>Preview mode</strong> — the Swimsuit Mixer database migration hasn't been applied yet, so this page
      is showing local mock data. Generating/revoking codes is interactive but only updates this mock data in memory.
    </div>

    <section class="mt-6 rounded-4xl bg-cream p-6 shadow-card">
      <h2 class="font-display text-base font-semibold text-ink">Generate a code</h2>
      <form class="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="onGenerate">
        <label class="block">
          <span class="lbl">Category</span>
          <select v-model="genForm.category" class="inp">
            <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>
        <label class="block">
          <span class="lbl">Note (optional)</span>
          <input v-model.trim="genForm.notes" type="text" class="inp" placeholder="e.g. for Shanice" />
        </label>
        <div class="flex items-end">
          <button type="submit" class="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" :disabled="generating">
            {{ generating ? 'Generating…' : 'Generate code' }}
          </button>
        </div>
      </form>
      <p v-if="genError" class="mt-2 text-sm text-coral">{{ genError }}</p>

      <div v-if="justGenerated" class="mt-5 rounded-3xl bg-seafoam/40 p-5">
        <p class="text-sm font-semibold text-ink">
          Code generated for {{ justGenerated.categoryLabel }} — copy it now, it will never be shown again:
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-3">
          <code class="rounded-xl bg-cream px-4 py-2 text-base font-semibold tracking-wide text-ink">{{ justGenerated.code }}</code>
          <button type="button" class="btn-outline px-4 py-1.5 text-xs" @click="copyCode">{{ copied ? 'Copied!' : 'Copy' }}</button>
        </div>
        <p class="mt-2 text-xs text-ink/50">If this is lost, revoke it below and generate a new one — it cannot be retrieved.</p>
      </div>
    </section>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading invitation codes…</p>
    <div v-else-if="loadError && !previewMode" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load invitation codes.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>
    <p v-else-if="!codes.length" class="mt-8 rounded-4xl bg-cream p-7 text-center text-sm text-ink/50 shadow-card">No codes generated yet.</p>

    <div v-else class="mt-8 overflow-x-auto rounded-4xl bg-cream shadow-card">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/50">
            <th class="px-5 py-4">Category</th>
            <th class="px-5 py-4">Status</th>
            <th class="px-5 py-4">Note</th>
            <th class="px-5 py-4">Created</th>
            <th class="px-5 py-4">Redeemed</th>
            <th class="px-5 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr v-for="c in codes" :key="c.id">
            <td class="px-5 py-4 text-ink">{{ CATEGORY_LABELS[c.category] || c.category }}</td>
            <td class="px-5 py-4">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="STATUS_STYLES[c.status]">{{ STATUS_LABELS[c.status] || c.status }}</span>
            </td>
            <td class="px-5 py-4 text-ink/60">{{ c.notes || '—' }}</td>
            <td class="px-5 py-4 text-ink/60">{{ formatDate(c.createdAt) }}</td>
            <td class="px-5 py-4 text-ink/60">{{ c.redeemedAt ? formatDate(c.redeemedAt) : '—' }}</td>
            <td class="px-5 py-4 text-right">
              <button
                v-if="c.status === 'active'"
                type="button"
                class="text-xs font-semibold text-coral hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="revokingId === c.id"
                @click="revoke(c)"
              >
                {{ revokingId === c.id ? 'Revoking…' : 'Revoke' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { mockInvitationCodes } from '~/data/bikiniMixAdminMock.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Swimsuit Mixer Invitations — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const CATEGORIES = [
  { value: 'event_assistant', label: 'Event Assistant' },
  { value: 'giveaway', label: 'Giveaway' },
  { value: 'other', label: 'Other' }
]
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))
const STATUS_STYLES = {
  active: 'bg-shell text-ink/70',
  redeemed: 'bg-seafoam/60 text-ink',
  revoked: 'bg-ink/10 text-ink/50'
}
const STATUS_LABELS = { active: 'Active', redeemed: 'Redeemed', revoked: 'Revoked' }

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
  'admin-bikini-mix-invitation-codes',
  async () => {
    try {
      return await authedFetch('/api/admin/bikini-mix/invitation-codes')
    } catch (err) {
      if (isNotConfigured(err)) {
        previewMode.value = true
        return { codes: mockInvitationCodes() }
      }
      throw err
    }
  },
  { server: false }
)
const codes = computed(() => data.value?.codes ?? [])

const genForm = reactive({ category: 'event_assistant', notes: '' })
const generating = ref(false)
const genError = ref('')
const justGenerated = ref(null)
const copied = ref(false)

async function onGenerate() {
  generating.value = true
  genError.value = ''
  justGenerated.value = null
  copied.value = false

  if (previewMode.value) {
    const mockCode = `MOCK-${Math.random().toString(36).slice(2, 6).toUpperCase()}-CODE`
    const row = {
      id: `mock-${Date.now()}`,
      category: genForm.category,
      status: 'active',
      notes: genForm.notes || null,
      redeemedByBookingId: null,
      redeemedAt: null,
      createdAt: new Date().toISOString()
    }
    data.value.codes = [row, ...data.value.codes]
    justGenerated.value = { code: mockCode, categoryLabel: CATEGORY_LABELS[genForm.category] }
    genForm.notes = ''
    generating.value = false
    return
  }

  try {
    const res = await authedFetch('/api/admin/bikini-mix/invitation-codes', {
      method: 'POST',
      body: { category: genForm.category, notes: genForm.notes || undefined }
    })
    justGenerated.value = { code: res.code, categoryLabel: res.categoryLabel }
    genForm.notes = ''
    await refresh()
  } catch (err) {
    genError.value = err?.data?.error || 'Could not generate a code — please try again.'
  } finally {
    generating.value = false
  }
}

async function copyCode() {
  if (!justGenerated.value) return
  try {
    await navigator.clipboard.writeText(justGenerated.value.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 2500)
  } catch {
    /* clipboard unavailable — the code is still shown on screen to copy by hand */
  }
}

const revokingId = ref(null)
async function revoke(c) {
  revokingId.value = c.id
  if (previewMode.value) {
    const row = data.value.codes.find((r) => r.id === c.id)
    if (row) row.status = 'revoked'
    revokingId.value = null
    return
  }
  try {
    const res = await authedFetch(`/api/admin/bikini-mix/invitation-codes/${c.id}/revoke`, { method: 'POST' })
    const row = data.value.codes.find((r) => r.id === c.id)
    if (row) Object.assign(row, res.code)
  } catch {
    /* left unchanged on failure */
  } finally {
    revokingId.value = null
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
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
