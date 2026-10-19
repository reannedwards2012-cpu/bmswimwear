<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <FancyHeading eyebrow="Admin" title="Bikini *Mix*" size="sm" as="h1" />
    </div>

    <AdminBikiniMixSubNav class="mt-6" />

    <p v-if="savedMessage" class="mt-4 rounded-2xl bg-shell/60 px-4 py-3 text-sm text-ink/70">{{ savedMessage }}</p>

    <p v-if="pending && !data" class="mt-8 rounded-4xl bg-cream p-7 text-sm text-ink/50 shadow-card">Loading event settings…</p>

    <div v-else-if="loadError" class="mt-8 rounded-4xl bg-cream p-7 text-center shadow-card">
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

      <!-- packages -->
      <section class="rounded-4xl bg-cream p-6 shadow-card md:p-7">
        <h2 class="font-display text-lg font-semibold text-ink">Packages</h2>
        <div class="mt-5 grid gap-6 lg:grid-cols-2">
          <AdminBikiniMixPackageEditor label="Classic Mix" v-model:price="form.classicMixPriceXcdCents" v-model:inclusions="form.classicMixInclusions" />
          <AdminBikiniMixPackageEditor label="The Works" v-model:price="form.theWorksPriceXcdCents" v-model:inclusions="form.theWorksInclusions" />
        </div>
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
          <video v-if="form.promoVideoUrl" :src="form.promoVideoUrl" controls class="h-32 w-48 rounded-2xl bg-ink/5 object-cover" />
          <span v-else class="grid h-32 w-48 place-items-center rounded-2xl border border-dashed border-ink/25 text-xs text-ink/40">
            No video yet
          </span>
          <div class="space-y-2">
            <button type="button" class="btn-outline px-4 py-1.5 text-xs" :disabled="uploadingVideo" @click="fileInput?.click()">
              {{ uploadingVideo ? 'Uploading…' : form.promoVideoUrl ? 'Replace video' : 'Upload video' }}
            </button>
            <button v-if="form.promoVideoUrl" type="button" class="block text-xs text-ink/45 hover:text-coral" @click="form.promoVideoUrl = ''">
              Remove
            </button>
            <input ref="fileInput" type="file" accept="video/mp4,video/webm,video/quicktime" class="hidden" @change="onVideoFile" />
            <p v-if="videoError" class="text-xs text-coral">{{ videoError }}</p>
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

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Bikini Mix — Admin — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

const { getAccessToken } = useAuth()
async function authedFetch(url, opts = {}) {
  const token = await getAccessToken()
  return $fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: token ? `Bearer ${token}` : '' } })
}

const { data, pending, error: loadError, refresh } = useLazyAsyncData('bikini-mix-event', () => authedFetch('/api/admin/bikini-mix/event'), {
  server: false
})

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
    classicMixPriceXcdCents: centsToInput(e.classicMixPriceXcdCents),
    classicMixInclusions: [...(e.classicMixInclusions ?? [])],
    theWorksPriceXcdCents: centsToInput(e.theWorksPriceXcdCents),
    theWorksInclusions: [...(e.theWorksInclusions ?? [])],
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
const fileInput = ref(null)
const uploadingVideo = ref(false)
const videoError = ref('')
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_VIDEO_BYTES = 80 * 1024 * 1024

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
    videoError.value = 'Video is too large — under 80MB please.'
    return
  }
  uploadingVideo.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const { url } = await authedFetch('/api/admin/bikini-mix/video', { method: 'POST', body })
    form.value.promoVideoUrl = url
  } catch (err) {
    videoError.value = err?.data?.error || 'Upload failed — try again.'
  } finally {
    uploadingVideo.value = false
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
    classicMixPriceXcdCents: toCentsOrNull(form.value.classicMixPriceXcdCents),
    classicMixInclusions: form.value.classicMixInclusions,
    theWorksPriceXcdCents: toCentsOrNull(form.value.theWorksPriceXcdCents),
    theWorksInclusions: form.value.theWorksInclusions,
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
