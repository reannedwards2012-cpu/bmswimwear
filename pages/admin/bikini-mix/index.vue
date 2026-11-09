<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Swimsuit *Mixer*" size="sm" as="h1" />
    </div>

    <AdminBikiniMixSubNav class="mt-6" />

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

    <div v-if="previewMode" class="mt-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-ink/70">
      🔧 <strong>Preview mode</strong> — the Swimsuit Mixer database migration hasn't been applied yet, so this page is
      showing local mock data instead of a load error. Every control here is fully interactive, but "Save" only
      updates this mock data in memory (nothing is written to the database).
    </div>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading event settings…</p>

    <div v-else-if="loadError && !previewMode" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
      <p class="text-sm text-coral">Couldn’t load event settings.</p>
      <button type="button" class="btn-outline mt-4" @click="refresh">Try again</button>
    </div>

    <form v-else-if="form" class="mt-8 space-y-8" novalidate @submit.prevent="onSave">
      <!-- booking status banner -->
      <section class="rounded-4xl p-6 shadow-card" :class="form.isBookingsOpen ? 'bg-cream' : 'bg-coral/10'">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="font-display text-lg font-semibold text-ink">Booking Status</h2>
            <p class="mt-1 text-xs text-ink/55">
              {{ form.isBookingsOpen ? 'Open — bookings are publicly accepted (once the live page launches).' : 'Closed — the manual kill-switch is on.' }}
            </p>
          </div>
          <label class="inline-flex cursor-pointer items-center gap-2">
            <input v-model="form.isBookingsOpen" type="checkbox" class="h-5 w-5 accent-coral" />
            <span class="text-sm font-semibold text-ink">Bookings open</span>
          </label>
        </div>
        <p v-if="!data.event.sizeGuideComplete" class="mt-3 text-xs font-semibold text-coral">
          ⚠ Bottom size guide is incomplete — the live booking page must not launch until every waist/hip measurement
          below is filled in.
        </p>
      </section>

      <!-- event details -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Event Details</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="lbl">Event name</span>
            <input v-model.trim="form.eventName" type="text" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Event date</span>
            <input v-model="form.eventDate" type="date" class="inp" />
          </label>
          <label class="flex items-end pb-2.5">
            <span class="flex items-center gap-2 text-sm text-ink/70">
              <input v-model="form.eventDateIsTentative" type="checkbox" class="h-4 w-4 accent-coral" />
              Date is tentative
            </span>
          </label>
          <label class="block">
            <span class="lbl">Venue</span>
            <input v-model.trim="form.venue" type="text" placeholder="The Closet, Grenada" class="inp" />
          </label>
          <label class="flex items-end pb-2.5">
            <span class="flex items-center gap-2 text-sm text-ink/70">
              <input v-model="form.venueIsConfirmed" type="checkbox" class="h-4 w-4 accent-coral" />
              Venue is confirmed
            </span>
          </label>
          <label class="block">
            <span class="lbl">Booking deadline</span>
            <input v-model="form.bookingDeadline" type="date" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Cancellation deadline</span>
            <input v-model="form.cancellationDeadline" type="date" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Capacity <span class="text-ink/35">(private — never shown publicly)</span></span>
            <input v-model="form.capacity" type="number" min="1" step="1" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Hold duration (minutes)</span>
            <input v-model="form.holdMinutes" type="number" min="1" step="1" class="inp" />
          </label>
        </div>
      </section>

      <!-- ticket pricing & early bird -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Ticket Pricing</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <label class="block">
            <span class="lbl">Regular price (EC$)</span>
            <input v-model="form.regularPriceXcdCents" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Early Bird price (EC$)</span>
            <input v-model="form.earlyBirdPriceXcdCents" type="number" min="0" step="0.01" class="inp" />
          </label>
          <label class="block">
            <span class="lbl">Early Bird slots</span>
            <input v-model="form.earlyBirdSlots" type="number" min="1" step="1" class="inp" />
          </label>
        </div>

        <div class="mt-5">
          <span class="lbl">Ticket inclusions</span>
          <p class="mt-1 text-xs text-ink/45">
            Keep this general until exact bead/charm/strap/rhinestone counts are finalized — never promise specific
            quantities or "unlimited" materials here.
          </p>
          <ul class="mt-2 space-y-1.5">
            <li v-for="(line, i) in form.ticketInclusions" :key="i" class="flex items-center gap-2 text-sm text-ink/70">
              <span class="flex-1 rounded-xl bg-shell/60 px-3 py-1.5">{{ line }}</span>
              <button type="button" class="text-ink/35 hover:text-coral" @click="form.ticketInclusions.splice(i, 1)">✕</button>
            </li>
          </ul>
          <div class="mt-2 flex gap-2">
            <input v-model.trim="inclusionDraft" type="text" placeholder="e.g. Access to the event" class="inp flex-1 !mt-0" @keydown.enter.prevent="addInclusion" />
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" @click="addInclusion">Add</button>
          </div>
        </div>

        <p v-if="earlyBirdStatus" class="mt-5 text-xs text-ink/55">
          {{ earlyBirdStatus.applied }} of {{ form.earlyBirdSlots }} Early Bird tickets claimed so far.
          <span v-if="earlyBirdStatus.mismatches"> {{ earlyBirdStatus.mismatches }} honored right at the cutoff — see the bookings list.</span>
        </p>
      </section>

      <!-- size guide -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Size Guide</h2>
        <p class="mt-1 text-xs text-ink/50">
          From your actual swimwear patterns — nothing here is pre-filled with invented measurements. Leave a field blank
          until you have the real number.
        </p>

        <div class="mt-5">
          <p class="lbl">Top (bust / underbust) <span class="font-normal normal-case text-ink/35">— optional, supplementary detail</span></p>
          <p class="mt-1 text-xs text-ink/40">
            Customers see the approved fixed cup-size guide (XS=A, S=B, M=C, L=D, XL=DD) on the booking page — this
            table is optional extra detail and is never required to launch.
          </p>
          <div class="mt-2 overflow-x-auto rounded-2xl border border-ink/10">
            <table class="w-full min-w-[26rem] text-left text-sm">
              <thead>
                <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/45">
                  <th class="px-3 py-2">Size</th>
                  <th class="px-3 py-2">Bust</th>
                  <th class="px-3 py-2">Underbust</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink/10">
                <tr v-for="row in form.topSizeGuide" :key="row.size">
                  <td class="px-3 py-2 font-semibold text-ink">{{ row.size }}</td>
                  <td class="px-3 py-2"><input v-model.trim="row.bust" type="text" placeholder="—" class="inp !mt-0" /></td>
                  <td class="px-3 py-2"><input v-model.trim="row.underbust" type="text" placeholder="—" class="inp !mt-0" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-5">
          <p class="lbl">Bottom (waist / hip)</p>
          <div class="mt-2 overflow-x-auto rounded-2xl border border-ink/10">
            <table class="w-full min-w-[26rem] text-left text-sm">
              <thead>
                <tr class="border-b border-ink/10 text-xs font-semibold uppercase tracking-widest2 text-ink/45">
                  <th class="px-3 py-2">Size</th>
                  <th class="px-3 py-2">Waist</th>
                  <th class="px-3 py-2">Hip</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ink/10">
                <tr v-for="row in form.bottomSizeGuide" :key="row.size">
                  <td class="px-3 py-2 font-semibold text-ink">{{ row.size }}</td>
                  <td class="px-3 py-2"><input v-model.trim="row.waist" type="text" placeholder="—" class="inp !mt-0" /></td>
                  <td class="px-3 py-2"><input v-model.trim="row.hip" type="text" placeholder="—" class="inp !mt-0" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- promo video -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Promotional Video</h2>
        <div class="mt-4 flex flex-wrap items-center gap-4">
          <video
            v-if="form.promoVideoUrl"
            :src="form.promoVideoUrl"
            :poster="form.promoVideoThumbnailUrl || undefined"
            controls
            class="h-32 w-48 rounded-2xl bg-ink/5 object-cover"
          />
          <span v-else class="grid h-32 w-48 place-items-center rounded-2xl border border-dashed border-ink/25 text-xs text-ink/40">
            No video yet
          </span>
          <div class="space-y-2">
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="uploadingVideo" @click="fileInput?.click()">
              {{ uploadingVideo ? `Uploading… ${videoElapsedLabel}` : form.promoVideoUrl ? 'Replace video' : 'Upload video' }}
            </button>
            <p v-if="uploadingVideo" class="text-[0.65rem] text-ink/40">Larger videos can take a few minutes — this won't hang forever.</p>
            <button v-if="form.promoVideoUrl && !uploadingVideo" type="button" class="block text-xs text-ink/45 hover:text-coral" @click="form.promoVideoUrl = ''">
              Remove
            </button>
            <input ref="fileInput" type="file" accept="video/mp4,video/webm,video/quicktime" class="hidden" @change="onVideoFile" />
            <p v-if="videoError" class="text-xs text-coral">{{ videoError }}</p>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-4 border-t border-ink/10 pt-5">
          <div>
            <img
              v-if="form.promoVideoThumbnailUrl"
              :src="form.promoVideoThumbnailUrl"
              alt=""
              class="h-20 w-32 rounded-2xl bg-ink/5 object-cover"
            />
            <span v-else class="grid h-20 w-32 place-items-center rounded-2xl border border-dashed border-ink/25 text-xs text-ink/40">
              No thumbnail
            </span>
          </div>
          <div class="space-y-2">
            <p class="text-xs font-semibold text-ink/70">Video thumbnail</p>
            <p class="max-w-xs text-[0.65rem] text-ink/45">
              Shown as the video's poster image, with a play button, before a visitor presses play.
            </p>
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="uploadingThumbnail" @click="thumbnailFileInput?.click()">
              {{ uploadingThumbnail ? 'Uploading…' : form.promoVideoThumbnailUrl ? 'Replace thumbnail' : 'Upload thumbnail' }}
            </button>
            <button
              v-if="form.promoVideoThumbnailUrl && !uploadingThumbnail"
              type="button"
              class="block text-xs text-ink/45 hover:text-coral"
              @click="form.promoVideoThumbnailUrl = ''"
            >
              Remove
            </button>
            <input ref="thumbnailFileInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onThumbnailFile" />
            <p v-if="thumbnailError" class="text-xs text-coral">{{ thumbnailError }}</p>
          </div>
        </div>
      </section>

      <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
      <ul v-if="formIssues.length" class="list-disc space-y-1 pl-5 text-xs text-coral">
        <li v-for="(msg, i) in formIssues" :key="i">{{ msg }}</li>
      </ul>

      <div class="flex justify-end">
        <button type="submit" class="btn-primary disabled:cursor-not-allowed disabled:opacity-60" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { mockEvent, mockBookings } from '~/data/bikiniMixAdminMock.js'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Swimsuit Mixer — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

// A 503 with configured:false means the Swimsuit Mixer migration hasn't
// been applied to this database yet (see server/utils/
// bikiniMixMigrationGuard.js) — every admin section falls back to local
// mock data in that case, rather than a dead-end "couldn't load" screen.
function isNotConfigured(err) {
  return err?.statusCode === 503 || err?.data?.configured === false
}

const previewMode = ref(false)

const { data, pending, error: loadError, refresh } = useLazyAsyncData('bikini-mix-event', () => authedFetch('/api/admin/bikini-mix/event'), {
  server: false
})
watch(loadError, (err) => {
  if (err && isNotConfigured(err)) {
    previewMode.value = true
    data.value = { event: mockEvent() }
  }
})

const earlyBirdStatus = ref(null)
authedFetch('/api/admin/bikini-mix/bookings')
  .then((res) => {
    earlyBirdStatus.value = res.earlyBird
  })
  .catch((err) => {
    if (isNotConfigured(err)) {
      const bookings = mockBookings()
      earlyBirdStatus.value = {
        applied: bookings.filter((b) => b.status === 'confirmed' && !b.isTest && b.earlyBirdApplied).length,
        mismatches: bookings.filter((b) => b.earlyBirdMismatch).length
      }
    }
  })

const inclusionDraft = ref('')
function addInclusion() {
  const v = inclusionDraft.value.trim()
  if (!v || !form.value) return
  form.value.ticketInclusions.push(v)
  inclusionDraft.value = ''
}

const centsToInput = (c) => (typeof c === 'number' ? (c / 100).toFixed(2) : '')

function fromEvent(e) {
  return {
    eventName: e.eventName ?? '',
    eventDate: e.eventDate ?? '',
    eventDateIsTentative: e.eventDateIsTentative ?? true,
    venue: e.venue ?? '',
    venueIsConfirmed: e.venueIsConfirmed ?? true,
    bookingDeadline: e.bookingDeadline ?? '',
    cancellationDeadline: e.cancellationDeadline ?? '',
    capacity: e.capacity ?? 12,
    holdMinutes: e.holdMinutes ?? 15,
    isBookingsOpen: e.isBookingsOpen ?? false,
    promoVideoUrl: e.promoVideoUrl ?? '',
    promoVideoThumbnailUrl: e.promoVideoThumbnailUrl ?? '',
    regularPriceXcdCents: centsToInput(e.regularPriceXcdCents),
    earlyBirdPriceXcdCents: centsToInput(e.earlyBirdPriceXcdCents),
    earlyBirdSlots: e.earlyBirdSlots ?? 3,
    ticketInclusions: [...(e.ticketInclusions ?? [])],
    topSizeGuide: (e.topSizeGuide ?? []).map((r) => ({ ...r })),
    bottomSizeGuide: (e.bottomSizeGuide ?? []).map((r) => ({ ...r }))
  }
}

const form = ref(null)
watch(
  () => data.value?.event,
  (e) => {
    if (e && !form.value) form.value = reactive(fromEvent(e))
  },
  { immediate: true }
)

// ── video upload ──
// Direct-to-Storage via a signed upload URL (composables/useBikiniMixMediaUpload.js)
// — large video files never pass through our own Netlify function, which is
// what previously made uploads hang indefinitely (see video-upload-url.post.js's
// header comment for the full root-cause explanation).
const { uploadToSignedUrl } = useBikiniMixMediaUpload()
const fileInput = ref(null)
const uploadingVideo = ref(false)
const videoError = ref('')
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
// Matches the bucket's own 50MB file_size_limit and the server's allowed
// types — was previously (incorrectly) 80MB here, which let the UI accept
// files the backend could never actually store.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000 // generous for 50MB on a slow connection, but never hangs forever

const videoElapsedSeconds = ref(0)
const videoElapsedLabel = computed(() => {
  const s = videoElapsedSeconds.value
  return s < 60 ? `(${s}s)` : `(${Math.floor(s / 60)}m ${s % 60}s)`
})
let videoElapsedTimer = null

async function onVideoFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  videoError.value = ''
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    videoError.value = 'Please choose an MP4, WebM or MOV video.'
    return
  }
  if (file.size > MAX_VIDEO_BYTES) {
    videoError.value = 'Video is too large — under 50MB please.'
    return
  }
  uploadingVideo.value = true
  videoElapsedSeconds.value = 0
  videoElapsedTimer = setInterval(() => { videoElapsedSeconds.value++ }, 1000)
  try {
    // Step 1: ask the server for a short-lived, direct-to-storage upload URL.
    // Tiny request/response, independent of the file's size.
    const { token, path, publicUrl } = await authedFetch('/api/admin/bikini-mix/video-upload-url', {
      method: 'POST',
      body: { contentType: file.type }
    })
    // Step 2: upload the actual bytes straight to Supabase Storage from the
    // browser — never touches our server.
    await uploadToSignedUrl('bikini-mix-media', path, token, file, { contentType: file.type, timeoutMs: UPLOAD_TIMEOUT_MS })
    form.value.promoVideoUrl = publicUrl
  } catch (err) {
    videoError.value = err?.data?.error || err?.message || 'Upload failed — try again.'
  } finally {
    uploadingVideo.value = false
    if (videoElapsedTimer) { clearInterval(videoElapsedTimer); videoElapsedTimer = null }
  }
}

// ── thumbnail upload ──
// Plain server-side multipart upload (mirrors server/api/admin/fabrics/
// image.post.js) — a poster image is capped at 5MB, safely under Netlify's
// synchronous-function payload ceiling, so this doesn't need the video's
// signed-URL direct-to-Storage flow.
const thumbnailFileInput = ref(null)
const uploadingThumbnail = ref(false)
const thumbnailError = ref('')
const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024

async function onThumbnailFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  thumbnailError.value = ''
  if (!ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
    thumbnailError.value = 'Please choose a JPEG, PNG or WebP image.'
    return
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    thumbnailError.value = 'Image is too large — under 5MB please.'
    return
  }
  uploadingThumbnail.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const { url } = await authedFetch('/api/admin/bikini-mix/video-thumbnail-image', { method: 'POST', body })
    form.value.promoVideoThumbnailUrl = url
  } catch (err) {
    thumbnailError.value = err?.data?.error || err?.message || 'Upload failed — try again.'
  } finally {
    uploadingThumbnail.value = false
  }
}

// ── save ──
const saving = ref(false)
const formError = ref('')
const formIssues = ref([])
const savedMessage = ref('')
let savedTimer = null

function toCentsOrNull(v) {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

async function onSave() {
  saving.value = true
  formError.value = ''
  formIssues.value = []

  // Preview mode: nothing exists to PATCH (the columns aren't there yet) —
  // just keep the in-memory form as the new "saved" state, so the UI still
  // demonstrates a real save round-trip.
  if (previewMode.value) {
    data.value = { event: { ...data.value.event, ...fromEvent(form.value) } }
    clearTimeout(savedTimer)
    savedMessage.value = 'Saved (preview only — not persisted).'
    savedTimer = setTimeout(() => (savedMessage.value = ''), 3000)
    saving.value = false
    return
  }

  const payload = {
    eventName: form.value.eventName,
    eventDate: form.value.eventDate || null,
    eventDateIsTentative: form.value.eventDateIsTentative,
    venue: form.value.venue || null,
    venueIsConfirmed: form.value.venueIsConfirmed,
    bookingDeadline: form.value.bookingDeadline || null,
    cancellationDeadline: form.value.cancellationDeadline || null,
    capacity: form.value.capacity === '' ? undefined : Number(form.value.capacity),
    holdMinutes: form.value.holdMinutes === '' ? undefined : Number(form.value.holdMinutes),
    isBookingsOpen: form.value.isBookingsOpen,
    promoVideoUrl: form.value.promoVideoUrl || null,
    promoVideoThumbnailUrl: form.value.promoVideoThumbnailUrl || null,
    regularPriceXcdCents: toCentsOrNull(form.value.regularPriceXcdCents),
    earlyBirdPriceXcdCents: toCentsOrNull(form.value.earlyBirdPriceXcdCents),
    earlyBirdSlots: form.value.earlyBirdSlots === '' ? undefined : Number(form.value.earlyBirdSlots),
    ticketInclusions: form.value.ticketInclusions,
    topSizeGuide: form.value.topSizeGuide,
    bottomSizeGuide: form.value.bottomSizeGuide
  }

  try {
    const res = await authedFetch('/api/admin/bikini-mix/event', { method: 'PATCH', body: payload })
    form.value = reactive(fromEvent(res.event))
    data.value = { event: res.event }
    clearTimeout(savedTimer)
    savedMessage.value = 'Saved.'
    savedTimer = setTimeout(() => (savedMessage.value = ''), 3000)
  } catch (err) {
    formError.value = err?.data?.error || 'Something went wrong saving these settings.'
    formIssues.value = err?.data?.issues || []
  } finally {
    saving.value = false
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
