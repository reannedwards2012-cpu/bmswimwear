<template>
  <div class="relative min-h-screen bg-sand">
    <BikiniMixDecor />

    <div class="relative z-10">
      <p v-if="testMode" class="bg-coral py-2 text-center text-[0.7rem] font-semibold uppercase tracking-widest2 text-cream">
        🧪 Admin test mode — no real guest sees this, and any payment here is a small fixed test charge, never a real booking
      </p>

      <div class="section container-bm !pb-28">
        <BikiniMixCustomerProgressBar :current="currentStep" class="mb-10" />

      <p v-if="pending" class="text-center text-sm text-ink/50">Loading…</p>

      <div v-else-if="loadError || !event" class="mx-auto max-w-md rounded-3xl bg-cream p-8 text-center shadow-card">
        <p class="font-display text-lg font-semibold text-ink">We couldn't load this page</p>
        <p class="mt-2 text-sm text-ink/60">
          Something went wrong fetching the latest Bikini Mixer details. Please check your connection and try again.
        </p>
        <button type="button" class="btn-primary mt-5" @click="retryLoad">Try again</button>
      </div>

      <template v-else>
        <template v-if="currentStep === 1">
          <BikiniMixCustomerStepInvitation
            :event-name="event.eventName"
            :event-date="event.eventDate"
            :event-date-is-tentative="event.eventDateIsTentative"
            :venue="event.venue"
            :venue-is-confirmed="event.venueIsConfirmed"
            :booking-deadline="event.bookingDeadline"
            :is-bookings-open="event.isBookingsOpen"
            :promo-video-url="event.promoVideoUrl"
            :classic-mix-price-xcd-cents="event.classicMixPriceXcdCents"
            :the-works-price-xcd-cents="event.theWorksPriceXcdCents"
            @continue="goTo(2)"
          />

          <!-- Admin-only test-mode entry point. Only ever rendered after a
               real, server-verified admin session is confirmed (isAdminTester) —
               a signed-out visitor or non-admin account never sees this, and
               the approved StepInvitation design above is completely untouched. -->
          <div v-if="!event.isBookingsOpen && isAdminTester" class="mx-auto mt-6 max-w-sm text-center">
            <button type="button" class="text-xs font-semibold text-ink/40 underline decoration-dotted underline-offset-4 hover:text-coral" @click="enterTestMode">
              Admin: enter test mode →
            </button>
          </div>
        </template>

        <template v-else-if="currentStep === 2">
          <BikiniMixCustomerStepBuild v-model="build" :fabrics="fabrics" :bottom-size-guide="event.bottomSizeGuide" />
          <div class="mx-auto mt-10 flex max-w-3xl items-center justify-between">
            <button type="button" class="btn-outline" @click="goTo(1)">← Back</button>
            <button type="button" class="btn-primary" @click="goTo(3)">Continue</button>
          </div>
        </template>

        <template v-else-if="currentStep === 3">
          <BikiniMixCustomerStepDetails v-model="details" />
          <div class="mx-auto mt-10 flex max-w-xl items-center justify-between">
            <button type="button" class="btn-outline" @click="goTo(2)">← Back</button>
            <button
              type="button"
              class="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!detailsComplete"
              @click="goTo(4)"
            >
              Continue
            </button>
          </div>
        </template>

        <template v-else-if="currentStep === 4">
          <BikiniMixCustomerStepPackage
            v-model="selectedPackage"
            :classic-mix-price-xcd-cents="event.classicMixPriceXcdCents"
            :classic-mix-inclusions="event.classicMixInclusions"
            :the-works-price-xcd-cents="event.theWorksPriceXcdCents"
            :the-works-inclusions="event.theWorksInclusions"
            :personalization-name="personalizationName"
            @update:personalization-name="personalizationName = $event"
          />
          <div class="mx-auto mt-10 flex max-w-3xl items-center justify-between">
            <button type="button" class="btn-outline" @click="goTo(3)">← Back</button>
            <button
              type="button"
              class="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!packageComplete"
              @click="goTo(5)"
            >
              Continue
            </button>
          </div>
        </template>

        <template v-else>
          <BikiniMixCustomerStepReview
            :build="build"
            :details="details"
            :fabrics="fabrics"
            :selected-package="selectedPackage"
            :classic-mix-price-xcd-cents="event.classicMixPriceXcdCents"
            :the-works-price-xcd-cents="event.theWorksPriceXcdCents"
            :personalization-name="personalizationName"
            :policy-accepted="policyAccepted"
            :marketing-opt-in="marketingOptIn"
            :test-mode="testMode"
            @update:policy-accepted="policyAccepted = $event"
          />
          <div class="mx-auto mt-6 flex max-w-2xl items-center justify-start">
            <button type="button" class="btn-outline" @click="goTo(4)">← Back</button>
          </div>
        </template>
      </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { isValidEmail, isValidPhone } from '~/utils/validate'

useHead({ title: 'The Bikini Mixer — Bahama Mama Swimwear' })

const { event, pending: eventPending, error: eventError, refresh: refreshEvent } = await useBikiniMixEvent()
const { fabrics, pending: fabricsPending, error: fabricsError, refresh: refreshFabrics } = await useBikiniMixFabrics()
const { currentStep, build, details, selectedPackage, personalizationName, policyAccepted, marketingOptIn } =
  useBikiniMixBooking()

// No mock fallback for either fetch — a failure on either one blocks the
// whole flow behind the error state in the template (real event + real
// fabric data are both required for the booking flow to mean anything),
// rather than silently substituting placeholder data.
const pending = computed(() => eventPending.value || fabricsPending.value)
const loadError = computed(() => Boolean(eventError.value) || Boolean(fabricsError.value))

function retryLoad() {
  refreshEvent()
  refreshFabrics()
}

function goTo(step) {
  currentStep.value = step
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── Admin-only test mode ──────────────────────────────────────────────────
// isAdminTester is set ONLY by a successful call to a real requireAdmin()
// endpoint — never trusted from anything client-side-only — so a non-admin
// visitor can never see or reach the test-mode entry point below, and the
// approved customer design is never altered for them.
const isAdminTester = ref(false)
const testMode = ref(false)

onMounted(async () => {
  try {
    const { getAccessToken } = useAuth()
    const token = await getAccessToken()
    if (!token) return
    await $fetch('/api/admin/bikini-mix/event', { headers: { Authorization: `Bearer ${token}` } })
    isAdminTester.value = true
  } catch {
    isAdminTester.value = false
  }
})

function enterTestMode() {
  testMode.value = true
  goTo(2)
}

const detailsComplete = computed(
  () => Boolean(details.value.fullName.trim()) && isValidEmail(details.value.email) && isValidPhone(details.value.whatsapp)
)

const packageComplete = computed(() => {
  if (!selectedPackage.value) return false
  if (selectedPackage.value === 'the_works') return Boolean(personalizationName.value.trim())
  return true
})
</script>
