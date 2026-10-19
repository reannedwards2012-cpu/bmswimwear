<template>
  <div class="mx-auto max-w-2xl">
    <FancyHeading eyebrow="Step 5" title="Review & *Pay*" center>
      Please check everything below carefully before paying.
    </FancyHeading>

    <!-- selections-final notice, shown again before payment -->
    <div class="mt-8 rounded-3xl bg-blush/15 p-5 text-sm leading-relaxed text-ink/75">
      Your bikini pieces will be prepared based on your booking selections, so please choose carefully. Selections
      are final once payment is completed. Limited swaps may be possible at the event, subject to availability.
    </div>

    <div class="mt-6 space-y-6 rounded-4xl bg-cream p-6 shadow-card sm:p-8">
      <section>
        <h2 class="font-display text-base font-semibold text-ink">Your Bikini</h2>
        <div class="mt-3 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div class="w-full max-w-[14rem] shrink-0 sm:w-52">
            <BikiniMixPreview
              :left-colour="leftHex"
              :right-colour="rightHex"
              :bottom-style="build.bottomStyle"
              :bottom-colour="bottomHex"
              :preview-width="190"
              :show-hint="false"
              compact
            />
          </div>
          <dl class="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 text-sm text-ink/70 sm:grid-cols-2">
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

      <section class="border-t border-ink/10 pt-6">
        <h2 class="font-display text-base font-semibold text-ink">Your Package</h2>
        <div class="mt-3 flex items-center justify-between text-sm text-ink/70">
          <span>{{ packageLabel }}</span>
          <span class="font-semibold text-ink">{{ formatMoney(packagePriceXcdCents, 'XCD') }}</span>
        </div>
        <div v-if="selectedPackage === 'the_works'" class="mt-2 flex justify-between gap-3 text-sm">
          <span class="text-ink/45">Personalization name</span>
          <span class="text-ink/70">{{ personalizationName || '—' }}</span>
        </div>
      </section>

      <section class="border-t border-ink/10 pt-6">
        <div class="flex items-baseline justify-between">
          <span class="font-display text-base font-semibold text-ink">Total</span>
          <span class="font-display text-2xl font-semibold text-ink">{{ formatMoney(packagePriceXcdCents, 'XCD') }}</span>
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
      <NuxtLink to="/bikini-mix/terms" target="_blank" class="mt-3 inline-block text-xs font-semibold text-coral link-underline">
        Read the complete booking terms
      </NuxtLink>

      <label class="mt-5 flex items-start gap-3 text-sm text-ink/75">
        <input
          type="checkbox"
          :checked="policyAccepted"
          class="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/25 text-coral focus:ring-coral"
          @change="$emit('update:policyAccepted', $event.target.checked)"
        />
        I have read and agree to the cancellation and refund policy above.
      </label>
    </section>

    <p v-if="errorMessage" class="mt-6 rounded-2xl bg-coral/10 px-4 py-3 text-center text-sm text-coral">{{ errorMessage }}</p>

    <div class="mt-8 flex flex-col items-center gap-2">
      <button
        type="button"
        class="btn-primary w-full max-w-sm px-10 py-4 text-base shadow-soft disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!policyAccepted || paying"
        @click="payNow"
      >
        {{ paying ? 'Starting payment…' : testMode ? 'Start Test Payment (USD$1.00)' : `Pay ${usdLabel}` }}
      </button>
      <p class="text-xs text-ink/40">
        <template v-if="testMode">Admin test mode — charges a fixed USD$1.00 test amount, never the real package price.</template>
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
  selectedPackage: { type: String, default: null },
  classicMixPriceXcdCents: Number,
  theWorksPriceXcdCents: Number,
  personalizationName: { type: String, default: '' },
  policyAccepted: { type: Boolean, default: false },
  marketingOptIn: { type: Boolean, default: false },
  // Admin-only — set by pages/bikini-mix/index.vue ONLY after a real
  // requireAdmin()-verified session confirms the current viewer is an
  // admin. Routes checkout to the admin-gated test endpoint instead of the
  // public one; never reachable by a real customer.
  testMode: { type: Boolean, default: false }
})
defineEmits(['update:policyAccepted'])

const { checkoutId } = useBikiniMixCheckout()
const paying = ref(false)
const errorMessage = ref('')

async function payNow() {
  if (!props.policyAccepted || paying.value) return
  paying.value = true
  errorMessage.value = ''

  try {
    const id = checkoutId(props.build, props.selectedPackage, props.personalizationName, props.details)
    const body = {
      checkoutIdempotencyKey: id,
      package: props.selectedPackage,
      topSize: props.build.topSize,
      bottomSize: props.build.bottomSize,
      leftFabricId: props.build.leftFabricId,
      rightFabricId: props.build.rightFabricId,
      bottomFabricId: props.build.bottomFabricId,
      bottomStyle: props.build.bottomStyle,
      bottomCoverage: props.build.bottomCoverage,
      fullName: props.details.fullName,
      email: props.details.email,
      whatsapp: props.details.whatsapp,
      personalizationName: props.personalizationName || null,
      marketingOptIn: props.marketingOptIn === true,
      termsAccepted: props.policyAccepted === true
    }

    const res = props.testMode
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

    if (res.paymentUrl) {
      window.location.href = res.paymentUrl
      return
    }
    if (res.alreadyPaid) {
      await navigateTo(`/bikini-mix/return?checkout=${encodeURIComponent(id)}`)
      return
    }
    errorMessage.value = 'Something unexpected happened. Please try again.'
  } catch (err) {
    errorMessage.value = err?.data?.error || "We couldn't start payment right now. Please try again in a moment."
  } finally {
    paying.value = false
  }
}

const fabricById = (id) => props.fabrics.find((f) => f.id === id) ?? null
const leftFabric = computed(() => fabricById(props.build.leftFabricId))
const rightFabric = computed(() => fabricById(props.build.rightFabricId))
const bottomFabric = computed(() => fabricById(props.build.bottomFabricId))

const FALLBACK_HEX = '#c9a98a'
const leftHex = computed(() => leftFabric.value?.hexColor || FALLBACK_HEX)
const rightHex = computed(() => rightFabric.value?.hexColor || FALLBACK_HEX)
const bottomHex = computed(() => bottomFabric.value?.hexColor || FALLBACK_HEX)

const packageLabel = computed(() => (props.selectedPackage === 'the_works' ? 'The Works' : 'Classic Mix'))
const packagePriceXcdCents = computed(() =>
  props.selectedPackage === 'the_works' ? props.theWorksPriceXcdCents : props.classicMixPriceXcdCents
)
const usdCents = computed(() => xcdCentsToUsdCents(packagePriceXcdCents.value))
// "USD$X.XX" per the approved customer-facing format — no payment-provider
// name shown, amount always derived from the selected package.
const usdLabel = computed(() => `USD$${(usdCents.value / 100).toFixed(2)}`)
</script>
