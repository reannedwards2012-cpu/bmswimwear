<template>
  <div>
    <NuxtLink to="/admin/inquiries" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
      ← Back to inquiries
    </NuxtLink>

    <p v-if="pending" class="mt-6 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading inquiry…</p>

    <div v-else-if="loadError" class="mt-6 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">{{ notFound ? 'That inquiry could not be found.' : 'Couldn’t load this inquiry.' }}</p>
      <button v-if="!notFound" type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
      <NuxtLink v-else to="/admin/inquiries" class="btn-outline mt-4 inline-block">Back to inquiries</NuxtLink>
    </div>

    <template v-else-if="inquiry">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="font-display text-2xl font-semibold text-ink md:text-3xl">{{ fullName }}</h1>
            <AdminInquiryStatusBadge :status="inquiry.status" />
          </div>
          <p class="mt-1 text-sm text-ink/50">{{ formatDate(inquiry.createdAt) }} · {{ inquiry.subject }}</p>
        </div>
        <button
          type="button"
          class="text-ink/35 transition-colors hover:text-coral"
          :aria-label="`Delete inquiry from ${fullName}`"
          :title="`Delete inquiry from ${fullName}`"
          @click="confirmDelete = true"
        >
          <IconTrash class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div class="space-y-8">
          <!-- message -->
          <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
            <h2 class="font-display text-lg font-semibold text-ink">Message</h2>
            <p class="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/75">{{ inquiry.message }}</p>
          </section>

          <!-- admin notes — private -->
          <section class="rounded-4xl bg-shell/60 p-6 shadow-card ring-1 ring-coral/15 md:p-7">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-display text-lg font-semibold text-ink">Admin Notes</h2>
              <span class="rounded-full bg-coral/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest2 text-coral">
                Private
              </span>
            </div>
            <p class="mt-1 text-xs text-ink/45">Private note — the customer never sees this.</p>

            <textarea
              v-model="notesDraft"
              rows="5"
              maxlength="5000"
              placeholder="Internal notes about this inquiry…"
              class="mt-3 w-full rounded-2xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
            />

            <div class="mt-3 flex items-center gap-3">
              <button
                type="button"
                class="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savingNotes || notesDraft === (inquiry.adminNotes ?? '')"
                @click="saveNotes"
              >
                {{ savingNotes ? 'Saving…' : 'Save notes' }}
              </button>
              <span v-if="notesSuccess" class="text-xs text-ink/50">Saved.</span>
            </div>
            <p v-if="notesError" class="mt-2 text-xs text-coral">{{ notesError }}</p>
          </section>
        </div>

        <aside class="space-y-6">
          <!-- status control -->
          <section class="rounded-4xl bg-cream p-6 shadow-card">
            <h2 class="font-display text-lg font-semibold text-ink">Status</h2>
            <p class="mt-1 text-xs text-ink/45">
              Currently <span class="font-semibold text-ink">{{ statusLabel(inquiry.status) }}</span>
            </p>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                v-for="s in STATUSES"
                :key="s.value"
                type="button"
                class="rounded-full px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="s.value === inquiry.status
                  ? 'bg-ink text-cream'
                  : 'border border-ink/15 text-ink/60 hover:border-ink/40'"
                :disabled="updating || s.value === inquiry.status"
                @click="applyStatus(s.value)"
              >
                {{ updating && pendingStatus === s.value ? '…' : s.label }}
              </button>
            </div>
            <p v-if="statusError" class="mt-3 text-xs text-coral">{{ statusError }}</p>
          </section>

          <!-- contact -->
          <section class="rounded-4xl bg-cream p-6 shadow-card">
            <h2 class="font-display text-lg font-semibold text-ink">Contact</h2>
            <p class="mt-3 text-sm text-ink">{{ fullName }}</p>
            <a :href="`mailto:${inquiry.email}`" class="mt-1 block break-all text-xs text-coral link-underline">{{ inquiry.email }}</a>
            <a v-if="inquiry.phone" :href="`tel:${inquiry.phone.replace(/\s+/g, '')}`" class="mt-1 block text-xs text-coral link-underline">
              {{ inquiry.phone }}
            </a>
            <p class="mt-3 text-xs text-ink/45">Received {{ formatDateTime(inquiry.createdAt) }}</p>
          </section>
        </aside>
      </div>
    </template>

    <!-- delete confirmation -->
    <div
      v-if="confirmDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
      @click.self="confirmDelete = false"
    >
      <div class="w-full max-w-sm rounded-4xl bg-cream p-7 shadow-card">
        <h2 class="font-display text-lg font-semibold text-ink">Delete this inquiry?</h2>
        <p class="mt-2 text-sm text-ink/60">
          The message from <span class="font-semibold text-ink">{{ fullName }}</span>
          ({{ formatDate(inquiry?.createdAt) }}) will be permanently removed. This can’t be undone.
        </p>
        <p v-if="deleteError" class="mt-3 text-xs text-coral">{{ deleteError }}</p>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button type="button" class="btn-outline" :disabled="deleting" @click="confirmDelete = false">Keep it</button>
          <button
            type="button"
            class="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-coral/90 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deleting"
            @click="doDelete"
          >
            {{ deleting ? 'Deleting…' : 'Delete inquiry' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const { getAccessToken } = useAuth()

async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const notFound = ref(false)

const { data, pending, error: loadError, refresh } = useLazyAsyncData(
  `admin-inquiry-${route.params.id}`,
  () => {
    notFound.value = false
    return authedFetch(`/api/admin/inquiries/${route.params.id}`).catch((err) => {
      if (err?.statusCode === 404 || err?.response?.status === 404) notFound.value = true
      throw err
    })
  },
  { server: false }
)

const inquiry = computed(() => data.value?.inquiry ?? null)
const fullName = computed(() =>
  [inquiry.value?.firstName, inquiry.value?.lastName].filter(Boolean).join(' ') || '—'
)

useHead(() => ({
  title: inquiry.value ? `Inquiry — ${fullName.value} — Admin` : 'Inquiry — Admin — Bahama Mama Swimwear',
  meta: [{ name: 'robots', content: 'noindex' }]
}))

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'open', label: 'Open' },
  { value: 'responded', label: 'Responded' },
  { value: 'closed', label: 'Closed' }
]
const statusLabel = (s) => STATUSES.find((x) => x.value === s)?.label ?? s

// ── status ──
const updating = ref(false)
const pendingStatus = ref('')
const statusError = ref('')

async function applyStatus(target) {
  updating.value = true
  pendingStatus.value = target
  statusError.value = ''
  try {
    const res = await authedFetch(`/api/admin/inquiries/${route.params.id}`, {
      method: 'PATCH',
      body: { status: target }
    })
    data.value = { inquiry: res.inquiry }
  } catch (err) {
    statusError.value = err?.data?.error || 'Could not update the status. Please try again.'
  } finally {
    updating.value = false
    pendingStatus.value = ''
  }
}

// ── private notes ──
const notesDraft = ref('')
const savingNotes = ref(false)
const notesError = ref('')
const notesSuccess = ref(false)
let notesSuccessTimer = null

watch(
  inquiry,
  (q) => {
    if (q) notesDraft.value = q.adminNotes ?? ''
  },
  { immediate: true }
)

async function saveNotes() {
  savingNotes.value = true
  notesError.value = ''
  notesSuccess.value = false
  try {
    const res = await authedFetch(`/api/admin/inquiries/${route.params.id}`, {
      method: 'PATCH',
      body: { adminNotes: notesDraft.value }
    })
    data.value = { inquiry: res.inquiry }
    notesDraft.value = res.inquiry.adminNotes ?? ''
    notesSuccess.value = true
    clearTimeout(notesSuccessTimer)
    notesSuccessTimer = setTimeout(() => {
      notesSuccess.value = false
    }, 3000)
  } catch (err) {
    notesError.value = err?.data?.error || 'Could not save notes. Please try again.'
  } finally {
    savingNotes.value = false
  }
}

// ── delete ──
const confirmDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')

async function doDelete() {
  deleting.value = true
  deleteError.value = ''
  try {
    await authedFetch(`/api/admin/inquiries/${route.params.id}`, { method: 'DELETE' })
    await router.push('/admin/inquiries')
  } catch (err) {
    deleteError.value = err?.data?.error || 'Could not delete this inquiry. Please try again.'
    deleting.value = false
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}
function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
  } catch {
    return ''
  }
}
</script>
