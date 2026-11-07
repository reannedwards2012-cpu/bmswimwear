<template>
  <div class="mx-auto max-w-2xl">
    <FancyHeading eyebrow="Step 4" title="Review & *Pay*" center>
      Please check everything below carefully before paying.
    </FancyHeading>

    <!-- selections-final notice, shown again before payment -->
    <div class="mt-8 rounded-3xl bg-blush/15 p-5 text-sm leading-relaxed text-ink/75">
      Your swimsuit pieces will be prepared based on your booking selections, so please choose carefully. Selections
      are final once payment is completed. Limited swaps may be possible at the event, subject to availability.
    </div>

    <div class="mt-6 space-y-6 rounded-4xl bg-cream p-6 shadow-card sm:p-8">
      <section>
        <h2 class="font-display text-base font-semibold text-ink">Your {{ build.garmentType === 'onepiece' ? 'One-Piece' : 'Bikini' }}</h2>
        <div class="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div class="w-full max-w-[14rem] shrink-0 sm:w-52">
            <BikiniMixPreview
              :garment-type="build.garmentType"
              :left-colour="leftHex"
              :right-colour="rightHex"
              :left-image-url="leftFabric?.imageUrl || null"
              :right-image-url="rightFabric?.imageUrl || null"
              :bottom-style="build.bottomStyle"
              :bottom-colour="bottomHex"
              :bottom-image-url="bottomFabric?.imageUrl || null"
              :bottom-coverage="build.bottomCoverage"
              :bottom-scrunch="build.bottomScrunch"
              :onepiece-colour="onepieceHex"
              :onepiece-image-url="onepieceFabric?.imageUrl || null"
              :onepiece-coverage="build.onepieceCoverage"
              :preview-width="190"
              :show-hint="false"
              :show-flip="false"
              compact
            />
          </div>
          <dl v-if="build.garmentType === 'onepiece'" class="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 text-sm text-ink/70 sm:grid-cols-2">
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Size</dt>
              <dd>{{ build.onepieceSize }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Coverage</dt>
              <dd>{{ build.onepieceCoverage === 'cheeky' ? 'Cheeky' : 'Bikini' }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Fabric</dt>
              <dd>{{ onepieceFabric?.name || '—' }}</dd>
            </div>
          </dl>
          <dl v-else class="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 text-sm text-ink/70 sm:grid-cols-2">
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Top size</dt>
              <dd>{{ build.topSize }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Bottom size</dt>
              <dd>{{ build.bottomSize }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Left triangle</dt>
              <dd>{{ leftFabric?.name || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Right triangle</dt>
              <dd>{{ rightFabric?.name || '—' }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Bottom style</dt>
              <dd>{{ build.bottomStyle === 'tie-side' ? 'Tie-Side' : 'Classic' }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Bottom coverage</dt>
              <dd>{{ build.bottomCoverage === 'cheeky' ? 'Cheeky' : 'Bikini' }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Scrunch</dt>
              <dd>{{ build.bottomScrunch ? 'Yes' : 'No' }}</dd>
            </div>
            <div class="flex justify-between gap-3 sm:block">
              <dt class="text-ink/45">Bottom colour</dt>
              <dd>{{ bottomFabric?.name || '—' }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="border-t border-ink/10 pt-6">
        <h2 class="font-display text-base font-semibold text-ink">Your Details</h2>
        <dl class="mt-3 space-y-2 text-sm text-ink/70">
          <div class="flex justify-between gap-3"><dt class="text-ink/45">Name</dt><dd>{{ details.fullName || '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink/45">Email</dt><dd>{{ details.email || '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink/45">Phone</dt><dd>{{ details.whatsapp || '—' }}</dd></div>
        </dl>
      </section>

      <section v-if="hasMeasurements" class="border-t border-ink/10 pt-6">
        <h2 class="font-display text-base font-semibold text-ink">Your Measurements</h2>
        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink/70 sm:grid-cols-4">
          <div v-if="details.bust"><dt class="text-ink/45">Bust</dt><dd>{{ details.bust }}"</dd></div>
          <div v-if="details.underbust"><dt class="text-ink/45">Underbust</dt><dd>{{ details.underbust }}"</dd></div>
          <div v-if="details.waist"><dt class="text-ink/45">Waist</dt><dd>{{ details.waist }}"</dd></div>
          <div v-if="details.hips"><dt class="text-ink/45">Hips</dt><dd>{{ details.hips }}"</dd></div>
        </dl>
      </section>

      <section class="border-t border-ink/10 pt-6">
        <h2 class="font-display text-base font-semibold text-ink">Your Ticket</h2>
        <div class="mt-3 flex items-center justify-between text-sm text-ink/70">
          <span>{{ displayIsEarlyBird ? 'Early Bird Ticket' : 'Ticket' }}</span>
          <span class="font-semibold text-ink">{{ formatMoney(displayPriceXcdCents, 'XCD') }}</span>
        </div>
      </section>

      <section class="border-t border-ink/10 pt-6">
        <div class="flex items-baseline justify-between">
          <span class="font-display text-base font-semibold text-ink">Total</span>
          <span class="font-display text-2xl font-semibold text-ink">{{ formatMoney(displayPriceXcdCents, 'XCD') }}</span>
        </div>
        <p class="mt-1 text-right text-sm text-ink/55">
          Charged as <strong class="text-ink">{{ usdLabel }}</strong>
        </p>
      </section>
    </div>

    <!-- cancellation & refund policy -->
    <section class="mt-6 rounded-4xl bg-cream p-6 shadow-card sm:p-8">
      <h2 class="font-display text-base font-semibold text-ink">Cancellation &amp; Refund Policy</h2>
      <div class="mt-3 space-y-2.5 text-sm leading-relaxed text-ink/70">
        <p>Full payment is required to secure a booking.</p>
        <p><strong class="text-ink">Cancellations on or before November 20, 2026:</strong> Customers receive a 50% refund of their ticket price.</p>
        <p><strong class="text-ink">Cancellations after November 20, 2026:</strong> No refund will be issued.</p>
        <p><strong class="text-ink">Refund processing:</strong> Approved refunds will be initiated within 7 business days. The time taken for funds to appear in your account may vary depending on your bank or payment provider.</p>
      </div>
      <NuxtLink to="/swimsuit-mixer/terms" target="_blank" class="mt-3 inline-block text-xs font-semibold text-coral link-underline">
        Read the complete booking terms
      </NuxtLink>

      <label class="mt-5 flex items-start gap-3 text-sm text-ink/75">
        <input
          type="checkbox"
          :checked="policyAccepted"
          class="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/25 text-coral focus:ring-coral"
          @change="$emit('update:policyAccepted', $event.target.checked)"
        />
        I have read and agree to the cancellation and refund policy above, and to the
        <NuxtLink to="/privacy-policy" target="_blank" class="font-semibold text-coral link-underline" @click.stop>Privacy Policy</NuxtLink>.
      </label>
    </section>

    <p v-if="errorMessage" class="mt-6 rounded-2xl bg-coral/10 px-4 py-3 text-center text-sm text-coral">{{ errorMessage }}</p>

    <!-- Guarantee 2: if early-bird pricing was displayed/expected but the
         checkout response came back regular-priced (slots filled between
         page load and the click), stop here and get explicit confirmation
         before redirecting to Go2Pay — the customer is never silently sent
         to pay more than what they saw. -->
    <div v-if="priceChangeConfirm" class="mt-6 rounded-3xl bg-coral/10 p-5 text-center">
      <p class="text-sm font-semibold text-ink">Early Bird pricing is no longer available</p>
      <p class="mt-1 text-sm text-ink/70">
        Your total is now {{ formatMoney(priceChangeConfirm.retailPriceXcdCents, 'XCD') }}
        ({{ usdFor(priceChangeConfirm.retailPriceXcdCents) }}). Continue to payment?
      </p>
      <div class="mt-4 flex items-center justify-center gap-3">
        <button type="button" class="btn-outline px-5 py-2 text-sm" @click="priceChangeConfirm = null">Go Back</button>
        <button type="button" class="btn-primary px-5 py-2 text-sm" @click="confirmPriceChangeAndPay">Continue to Payment</button>
      </div>
    </div>

    <div v-else-if="previewMode && previewResult" class="mt-8 rounded-3xl bg-seafoam/20 p-5 text-center">
      <p class="text-sm font-semibold text-ink">Preview mode — no payment was made</p>
      <p class="mt-1 text-sm text-ink/70">
        This would redirect to Go2Pay to charge
        {{ formatMoney(previewResult.retailPriceXcdCents, 'XCD') }} ({{ usdFor(previewResult.retailPriceXcdCents) }}),
        {{ previewResult.isEarlyBird ? 'at the Early Bird rate.' : 'at the regular rate.' }}
      </p>
    </div>

    <div v-else class="mt-8 flex flex-col items-center gap-2">
      <!-- Cloudflare Turnstile — skipped entirely in preview/test mode (no real
           checkout call either way) and when no site key is configured. -->
      <div v-if="turnstileSiteKey && !previewMode && !testMode" ref="turnstileEl" class="w-full max-w-sm" />

      <button
        type="button"
        class="btn-primary w-full max-w-sm px-10 py-4 text-base shadow-soft disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!policyAccepted || paying || requiresTurnstile"
        @click="payNow"
      >
        {{ paying ? 'Starting payment…' : previewMode ? `Preview Pay ${usdLabel}` : testMode ? 'Start Test Payment (USD$1.00)' : `Pay ${usdLabel}` }}
      </button>
      <p class="text-xs text-ink/40">
        <template v-if="previewMode">Preview mode — clicking this never charges anything or contacts Go2Pay.</template>
        <template v-else-if="testMode">Admin test mode — charges a fixed USD$1.00 test amount, never the real ticket price.</template>
        <template v-else>You'll be taken to Go2Pay to complete your payment securely.</template>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { formatMoney, xcdCentsToUsdCents } from '~/utils/money'
import { useBikiniMixCheckout } from '~/composables/useBikiniMixCheckout'

const props = defineProps({
  build: { type: Object, required: true },
  details: { type: Object, required: true },
  fabrics: { type: Array, default: () => [] },
  regularPriceXcdCents: Number,
  earlyBirdPriceXcdCents: Number,
  earlyBirdAvailable: { type: Boolean, default: false },
  ticketInclusions: { type: Array, default: () => [] },
  policyAccepted: { type: Boolean, default: false },
  marketingOptIn: { type: Boolean, default: false },
  // Admin-only — set by pages/swimsuit-mixer/index.vue ONLY after a real
  // requireAdmin()-verified session confirms the current viewer is an
  // admin. Routes checkout to the admin-gated test endpoint instead of the
  // public one; never reachable by a real customer.
  testMode: { type: Boolean, default: false },
  // Internal-preview-only — set ONLY by pages/dev/swimsuit-mixer-preview.vue.
  // Skips the network call entirely (no checkout endpoint, no Go2Pay
  // redirect, no booking row) and simulates the outcome locally, so the
  // full flow can be reviewed before the new schema is live without ever
  // touching the real database or initiating a real payment. Never set by
  // the real customer-facing page.
  previewMode: { type: Boolean, default: false }
})
defineEmits(['update:policyAccepted'])

const { checkoutId } = useBikiniMixCheckout()
const paying = ref(false)
const errorMessage = ref('')
const priceChangeConfirm = ref(null) // { paymentUrl, retailPriceXcdCents } while awaiting Guarantee-2 confirmation
const previewResult = ref(null) // preview-mode-only simulated outcome, see payNow()

// Cloudflare Turnstile — never needed in preview/test mode, since neither
// ever calls the real checkout endpoint.
const { siteKey: turnstileSiteKey, containerEl: turnstileEl, token: turnstileToken, reset: resetTurnstile } = useTurnstile()
const requiresTurnstile = computed(
  () => !props.previewMode && !props.testMode && !!turnstileSiteKey && !turnstileToken.value
)

// Display-only price before checkout actually runs — a hint, never a
// guarantee (the true, reservation-backed price is only known once the
// checkout endpoint responds).
const hasMeasurements = computed(() => Boolean(props.details.bust || props.details.underbust || props.details.waist || props.details.hips))

const displayIsEarlyBird = computed(() => checkoutResultIsEarlyBird.value ?? props.earlyBirdAvailable)
const displayPriceXcdCents = computed(() => checkoutResultPrice.value ?? (displayIsEarlyBird.value ? props.earlyBirdPriceXcdCents : props.regularPriceXcdCents))
const checkoutResultIsEarlyBird = ref(null)
const checkoutResultPrice = ref(null)

function buildCheckoutBody() {
  const id = checkoutId(props.build, props.details)
  return {
    checkoutIdempotencyKey: id,
    garmentType: props.build.garmentType,
    topSize: props.build.topSize,
    bottomSize: props.build.bottomSize,
    leftFabricId: props.build.leftFabricId,
    rightFabricId: props.build.rightFabricId,
    bottomFabricId: props.build.bottomFabricId,
    bottomStyle: props.build.bottomStyle,
    bottomCoverage: props.build.bottomCoverage,
    bottomScrunch: props.build.bottomScrunch === true,
    onepieceSize: props.build.onepieceSize,
    onepieceCoverage: props.build.onepieceCoverage,
    onepieceFabricId: props.build.onepieceFabricId,
    fullName: props.details.fullName,
    email: props.details.email,
    whatsapp: props.details.whatsapp,
    bustInches: props.details.bust === '' ? null : Number(props.details.bust),
    underbustInches: props.details.underbust === '' ? null : Number(props.details.underbust),
    waistInches: props.details.waist === '' ? null : Number(props.details.waist),
    hipsInches: props.details.hips === '' ? null : Number(props.details.hips),
    marketingOptIn: props.marketingOptIn === true,
    termsAccepted: props.policyAccepted === true,
    company: props.details.company || '',
    turnstileToken: turnstileToken.value
  }
}

async function submitCheckout(body) {
  return props.testMode
    ? await (async () => {
        const { getAccessToken } = useAuth()
        const token = await getAccessToken()
        return $fetch('/api/admin/bikini-mix/test-checkout', {
          method: 'POST',
          body,
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        })
      })()
    : await $fetch('/api/bikini-mix/checkout', { method: 'POST', body })
}

async function payNow() {
  if (!props.policyAccepted || paying.value || requiresTurnstile.value) return
  paying.value = true
  errorMessage.value = ''

  // Preview mode: never calls the checkout endpoint, never touches the
  // database, never redirects to Go2Pay — simulates a plausible outcome
  // locally using the display price already computed above, purely so the
  // review screen's "what happens when you click Pay" moment can be seen.
  if (props.previewMode) {
    await new Promise((r) => setTimeout(r, 400)) // mirrors the real button's brief loading state
    previewResult.value = {
      isEarlyBird: displayIsEarlyBird.value,
      retailPriceXcdCents: displayPriceXcdCents.value
    }
    paying.value = false
    return
  }

  try {
    const expectedEarlyBird = props.earlyBirdAvailable
    const id = checkoutId(props.build, props.details)
    const body = buildCheckoutBody()
    const res = await submitCheckout(body)

    if (res.alreadyPaid) {
      await navigateTo(`/swimsuit-mixer/return?checkout=${encodeURIComponent(id)}`)
      return
    }
    if (!res.paymentUrl) {
      errorMessage.value = 'Something unexpected happened. Please try again.'
      return
    }

    checkoutResultIsEarlyBird.value = res.isEarlyBird === true
    checkoutResultPrice.value = res.retailPriceXcdCents ?? null

    // Guarantee 2 — never redirect to pay more than what was shown.
    if (expectedEarlyBird && res.isEarlyBird === false) {
      priceChangeConfirm.value = { paymentUrl: res.paymentUrl, retailPriceXcdCents: res.retailPriceXcdCents }
      return
    }

    window.location.href = res.paymentUrl
  } catch (err) {
    errorMessage.value = err?.data?.error || "We couldn't start payment right now. Please try again in a moment."
    // A used/expired/invalid token can't be retried as-is — reset so the
    // widget issues a fresh one before the next attempt.
    resetTurnstile()
  } finally {
    paying.value = false
  }
}

function confirmPriceChangeAndPay() {
  if (!priceChangeConfirm.value) return
  window.location.href = priceChangeConfirm.value.paymentUrl
}

const fabricById = (id) => props.fabrics.find((f) => f.id === id) ?? null
const leftFabric = computed(() => fabricById(props.build.leftFabricId))
const rightFabric = computed(() => fabricById(props.build.rightFabricId))
const bottomFabric = computed(() => fabricById(props.build.bottomFabricId))
const onepieceFabric = computed(() => fabricById(props.build.onepieceFabricId))

const FALLBACK_HEX = '#c9a98a'
const leftHex = computed(() => leftFabric.value?.hexColor || FALLBACK_HEX)
const rightHex = computed(() => rightFabric.value?.hexColor || FALLBACK_HEX)
const bottomHex = computed(() => bottomFabric.value?.hexColor || FALLBACK_HEX)
const onepieceHex = computed(() => onepieceFabric.value?.hexColor || FALLBACK_HEX)

const usdFor = (xcdCents) => `USD$${(xcdCentsToUsdCents(xcdCents) / 100).toFixed(2)}`
const usdLabel = computed(() => usdFor(displayPriceXcdCents.value))
</script>
