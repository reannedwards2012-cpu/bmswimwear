<template>
  <div class="relative min-h-screen overflow-hidden bg-mixer-ivory">
    <!-- one subtle, shared blush wash — replaces the busier decorative
         overlay this page used to carry; visible across all four steps -->
    <div class="pointer-events-none absolute -right-32 -top-40 -z-0 h-96 w-96 rounded-full bg-mixer-blush opacity-50 blur-3xl" aria-hidden="true" />

    <div class="relative z-10">
      <p class="bg-ink py-2 text-center text-[0.7rem] font-semibold uppercase tracking-widest2 text-cream">
        🔧 PREVIEW MODE — mock event/fabric/gallery data, zero network calls, no real booking or payment is ever possible here
      </p>
      <div class="flex flex-wrap items-center justify-center gap-3 bg-shell/70 py-2 text-xs text-ink/60">
        <span>Early Bird available:</span>
        <button type="button" class="rounded-full border px-3 py-1" :class="earlyBirdAvailable ? 'border-ink bg-ink text-cream' : 'border-ink/20'" @click="earlyBirdAvailable = true">On</button>
        <button type="button" class="rounded-full border px-3 py-1" :class="!earlyBirdAvailable ? 'border-ink bg-ink text-cream' : 'border-ink/20'" @click="earlyBirdAvailable = false">Off (sold out)</button>
        <span class="ml-4">Spots left:</span>
        <button v-for="n in [1, 2, 3]" :key="n" type="button" class="rounded-full border px-3 py-1" :class="earlyBirdRemaining === n ? 'border-ink bg-ink text-cream' : 'border-ink/20'" @click="earlyBirdRemaining = n">{{ n }}</button>
        <span class="ml-4">Bookings open:</span>
        <button type="button" class="rounded-full border px-3 py-1" :class="isBookingsOpen ? 'border-ink bg-ink text-cream' : 'border-ink/20'" @click="isBookingsOpen = true">On</button>
        <button type="button" class="rounded-full border px-3 py-1" :class="!isBookingsOpen ? 'border-ink bg-ink text-cream' : 'border-ink/20'" @click="isBookingsOpen = false">Off</button>
        <button type="button" class="ml-4 rounded-full border border-coral px-3 py-1 text-coral" @click="resetFlow">Reset flow</button>
      </div>

      <div class="section container-bm !pb-28">
        <BikiniMixCustomerProgressBar :current="currentStep" class="mb-10" />

        <template v-if="currentStep === 1">
          <BikiniMixCustomerStepInvitation
            :event-name="event.eventName"
            :event-date="event.eventDate"
            :event-date-is-tentative="event.eventDateIsTentative"
            :venue="event.venue"
            :venue-is-confirmed="event.venueIsConfirmed"
            :booking-deadline="event.bookingDeadline"
            :is-bookings-open="isBookingsOpen"
            :promo-video-url="event.promoVideoUrl"
            :regular-price-xcd-cents="event.regularPriceXcdCents"
            :early-bird-price-xcd-cents="event.earlyBirdPriceXcdCents"
            :early-bird-slots="event.earlyBirdSlots"
            :early-bird-remaining="earlyBirdRemaining"
            :early-bird-available="earlyBirdAvailable"
            :ticket-inclusions="event.ticketInclusions"
            @continue="goTo(2)"
            @open-gallery="galleryOpen = true"
          />
        </template>

        <template v-else-if="currentStep === 2">
          <BikiniMixCustomerStepBuild
            v-model="build"
            :fabrics="fabrics"
            :bottom-size-guide="event.bottomSizeGuide"
            @set-garment-type="setGarmentType"
            @open-gallery="galleryOpen = true"
          />
          <div class="mx-auto mt-10 flex max-w-3xl items-center justify-between">
            <button type="button" class="btn-outline" @click="goTo(1)">← Back</button>
            <button type="button" class="btn-primary disabled:cursor-not-allowed disabled:opacity-40" :disabled="!buildComplete" @click="goTo(3)">Continue</button>
          </div>
        </template>

        <template v-else-if="currentStep === 3">
          <BikiniMixCustomerStepDetails v-model="details" />
          <div class="mx-auto mt-10 flex max-w-xl items-center justify-between">
            <button type="button" class="btn-outline" @click="goTo(2)">← Back</button>
            <button type="button" class="btn-primary disabled:cursor-not-allowed disabled:opacity-40" :disabled="!detailsComplete" @click="goTo(4)">Continue</button>
          </div>
        </template>

        <template v-else>
          <BikiniMixCustomerStepReview
            :build="build"
            :details="details"
            :fabrics="fabrics"
            :regular-price-xcd-cents="event.regularPriceXcdCents"
            :early-bird-price-xcd-cents="event.earlyBirdPriceXcdCents"
            :early-bird-available="earlyBirdAvailable"
            :ticket-inclusions="event.ticketInclusions"
            :policy-accepted="policyAccepted"
            :marketing-opt-in="marketingOptIn"
            preview-mode
            @update:policy-accepted="policyAccepted = $event"
          />
          <div class="mx-auto mt-6 flex max-w-2xl items-center justify-start">
            <button type="button" class="btn-outline" @click="goTo(3)">← Back</button>
          </div>
        </template>
      </div>
    </div>

    <BikiniMixCustomerCustomizationGallery v-model="galleryOpen" :preview-images="galleryImages" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { isValidEmail, isValidPhone, isValidMeasurement } from '~/utils/validate'

definePageMeta({ layout: false, middleware: ['dev-only', 'admin'] })
useHead({ title: 'Swimsuit Mixer Preview (dev) — Bahama Mama Swimwear', meta: [{ name: 'robots', content: 'noindex' }] })

// ── mock data — mirrors the shape server/utils/bikiniMixMappers.js's
// mapPublicEvent()/mapBikiniMixFabric()/mapGalleryImage() return, so every
// prop passed to the real step components below is exactly what they'd
// receive once the real API is live. Nothing here is fetched; nothing here
// ever reaches the network. ──
const earlyBirdAvailable = ref(true)
const earlyBirdRemaining = ref(3)
const isBookingsOpen = ref(true)

const event = ref({
  eventName: 'The Swimsuit Mixer by Bahama Mama',
  eventDate: '2026-12-12',
  eventDateIsTentative: false,
  venue: 'The Closet, Grenada',
  venueIsConfirmed: true,
  bookingDeadline: '2026-12-05',
  promoVideoUrl: null,
  regularPriceXcdCents: 25000,
  earlyBirdPriceXcdCents: 22500,
  earlyBirdSlots: 3,
  ticketInclusions: [
    'Your choice of bikini or one-piece swimsuit',
    'Straps included',
    'Up to 6 premium beads',
    'Up to 4 pony beads',
    '1 premium charm',
    '2 basic charms',
    '1 iron-on decal',
    'Up to 20 rhinestones',
    'Wine',
    'Finger foods'
  ],
  bottomSizeGuide: [
    { size: 'XS', waist: '24–26', hip: '34–36' },
    { size: 'S', waist: '26–28', hip: '36–38' },
    { size: 'M', waist: '28–30', hip: '38–40' },
    { size: 'L', waist: '30–32', hip: '40–42' },
    { size: 'XL', waist: '32–34', hip: '42–44' }
  ]
})

// Mirrors the REAL, currently-active bikini-mix fabric inventory (pulled
// read-only from production: bikini_mix_fabrics.is_active=true joined to
// fabrics, same filter server/api/bikini-mix/fabrics.get.js applies) so
// this preview's "missing fabrics" risk is eliminated — every colour and
// pattern a real customer would see today is represented here too.
// eligibleForOnepiece mirrors the client's confirmed 10-colour one-piece
// list, matched against these exact fabric names (see the migration's
// matching `update bikini_mix_fabrics` for the same set + the "Blue" note —
// no fabric here is named plain "Blue", so it's left unmarked, same as there).
const fabrics = ref([
  { id: 'fd0daacf-b09e-4e31-8285-9b9a83aa09ea', name: 'Abstract Multicolour', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/babee695-45ae-4389-8883-c4a2add593fd.jpg', eligibleForOnepiece: false },
  { id: 'df1f272c-2dd9-4ee5-9a7c-c6fcbc5848a6', name: 'Animal Print', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/7046b779-4f91-4e2c-92e7-deb61a8987a3.jpg', eligibleForOnepiece: false },
  { id: '4a5837ed-b4e6-46c9-ad33-b35a58cccd68', name: 'Baby Blue', hexColor: '#7BC9EF', imageUrl: null, eligibleForOnepiece: true },
  { id: '98f24fde-5b29-45c0-aa00-0406d6139ce4', name: 'Baby Pink', hexColor: '#FFB2C6', imageUrl: null, eligibleForOnepiece: false },
  { id: '4b7ead52-b5af-4604-87e7-198f80ca1e30', name: 'Black', hexColor: '#111111', imageUrl: null, eligibleForOnepiece: true },
  { id: '8250c369-3860-46b5-a470-37ed74b5b901', name: 'Chocolate', hexColor: '#704336', imageUrl: null, eligibleForOnepiece: true },
  { id: 'f2c75d60-3621-472c-83d8-a268bb6aae0f', name: 'Coral', hexColor: '#EF5284', imageUrl: null, eligibleForOnepiece: true },
  { id: '50e4417f-d2b9-42ed-a81f-17b68f71218d', name: 'Fluorescent Green', hexColor: '#7FF22C', imageUrl: null, eligibleForOnepiece: false },
  { id: 'cd17b481-304a-4bc8-b922-23e2de5504bd', name: 'Hot Pink', hexColor: '#F62BAD', imageUrl: null, eligibleForOnepiece: true },
  { id: 'bd7de9e3-4f3f-46d2-9b20-7c9b0244a01d', name: 'Ivory', hexColor: '#F6E7D8', imageUrl: null, eligibleForOnepiece: false },
  { id: '44c6a609-d934-4686-8134-4c98c40b78c5', name: 'Metallic Pineapple', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/5c702b4e-6a11-4307-99b1-a855fcfe6310.webp', eligibleForOnepiece: false },
  { id: '0abaff0d-01aa-4474-9173-e28ff48e862e', name: 'Mosaic Lines', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/711b3dd7-36d5-4a84-b97b-f35d5e795641.jpg', eligibleForOnepiece: true },
  { id: '09470e3e-c7f9-43cc-9fee-a17314b31519', name: 'Polka Dot', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/ce07e15f-5df7-458c-956b-7a1e4b73a7f3.jpg', eligibleForOnepiece: false },
  { id: 'e4f53a7e-1953-4ec9-81aa-12ce23107638', name: 'Red', hexColor: '#D9021F', imageUrl: null, eligibleForOnepiece: true },
  { id: '66d41852-404e-4dae-8dbd-7e3fd156669d', name: 'Royal Blue', hexColor: '#2252E5', imageUrl: null, eligibleForOnepiece: false },
  { id: '82a8ec4b-d654-4700-a06a-8b86c2c9d123', name: 'Teal', hexColor: '#0F9EA8', imageUrl: null, eligibleForOnepiece: false },
  { id: '2715953b-52e5-4a62-b640-4d2f84e4cc16', name: 'Tie-Dye', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/50c81e37-a8e9-4622-9f77-885444c16b10.webp', eligibleForOnepiece: false },
  { id: '03897b58-dc53-4a7e-8016-dedc883f7035', name: 'Tropical Floral', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/4c3d5675-442c-43db-ac1b-f6046c7c246b.jpg', eligibleForOnepiece: false },
  { id: 'c917f4d4-6c70-4e5d-b8f4-8418fddd194d', name: 'White', hexColor: '#FFFFFF', imageUrl: null, eligibleForOnepiece: true },
  { id: 'bc047091-78dd-4256-934e-ab62dadfcd97', name: 'Yellow', hexColor: '#FFED29', imageUrl: null, eligibleForOnepiece: true }
])

// Solid-colour placeholder "photos" (data URIs) so the gallery grid has
// something real to lay out, without depending on any uploaded asset.
function swatch(hex) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='${hex}'/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}
const galleryImages = ref([
  { id: 'g1', imageUrl: swatch('%23E6397C'), caption: 'Gold chain strap', category: 'strap', includedInTicket: false },
  { id: 'g2', imageUrl: swatch('%23F3EFE8'), caption: 'Pearl beads', category: 'bead', includedInTicket: false },
  { id: 'g3', imageUrl: swatch('%2326408B'), caption: 'Shell charm', category: 'charm', includedInTicket: false },
  { id: 'g4', imageUrl: swatch('%232A8C82'), caption: 'Finished bikini example', category: 'finished_swimsuit', includedInTicket: true }
])

// ── local booking state — deliberately PLAIN local refs, not
// useBikiniMixBooking() (which uses Nuxt useState keys shared with the
// real /bikini-mix page — reusing it here would let preview selections
// leak into the real page's state across client-side navigation in the
// same tab). Same shape/clearing logic as the real composable, fully
// isolated; purely client-side either way, never touches the database. ──
const BIKINI_ONLY_DEFAULTS = () => ({
  topSize: 'M', leftFabricId: null, rightFabricId: null, bottomStyle: 'tie-side', bottomSize: 'M', bottomCoverage: 'bikini', bottomScrunch: false, bottomFabricId: null
})
const ONEPIECE_ONLY_DEFAULTS = () => ({ onepieceSize: 'M', onepieceCoverage: 'bikini', onepieceFabricId: null })

const currentStep = ref(1)
const build = ref({ garmentType: null, ...BIKINI_ONLY_DEFAULTS(), ...ONEPIECE_ONLY_DEFAULTS() })
const details = ref({ fullName: '', email: '', whatsapp: '', bust: '', underbust: '', waist: '', hips: '' })
const marketingOptIn = ref(false)
const policyAccepted = ref(false)

function setGarmentType(type) {
  if (build.value.garmentType === type) return
  if (build.value.garmentType === 'bikini') Object.assign(build.value, BIKINI_ONLY_DEFAULTS())
  else if (build.value.garmentType === 'onepiece') Object.assign(build.value, ONEPIECE_ONLY_DEFAULTS())
  build.value.garmentType = type
}

function goTo(step) {
  currentStep.value = step
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function resetFlow() {
  currentStep.value = 1
  build.value = { garmentType: null, ...BIKINI_ONLY_DEFAULTS(), ...ONEPIECE_ONLY_DEFAULTS() }
  details.value = { fullName: '', email: '', whatsapp: '', bust: '', underbust: '', waist: '', hips: '' }
  policyAccepted.value = false
}

const galleryOpen = ref(false)

const buildComplete = computed(() => {
  const b = build.value
  if (b.garmentType === 'bikini') {
    return Boolean(b.topSize && b.bottomSize && b.leftFabricId && b.rightFabricId && b.bottomFabricId && b.bottomStyle && b.bottomCoverage)
  }
  if (b.garmentType === 'onepiece') {
    return Boolean(b.onepieceSize && b.onepieceCoverage && b.onepieceFabricId)
  }
  return false
})

const detailsComplete = computed(
  () =>
    Boolean(details.value.fullName.trim()) &&
    isValidEmail(details.value.email) &&
    isValidPhone(details.value.whatsapp) &&
    isValidMeasurement(details.value.bust) &&
    isValidMeasurement(details.value.underbust) &&
    isValidMeasurement(details.value.waist) &&
    isValidMeasurement(details.value.hips)
)
</script>
