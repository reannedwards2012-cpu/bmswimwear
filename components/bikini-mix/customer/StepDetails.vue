<template>
  <div class="mx-auto max-w-xl">
    <FancyHeading eyebrow="Step 3" title="Your *Details*" center>
      Just a few details before we get you on the list.
    </FancyHeading>

    <div class="mt-9 space-y-5 rounded-4xl bg-cream p-7 shadow-card sm:p-9">
      <CheckoutField
        label="Full Name"
        :model-value="modelValue.fullName"
        autocomplete="name"
        required
        @update:model-value="update({ fullName: $event })"
      />
      <CheckoutField
        label="Email"
        type="email"
        :model-value="modelValue.email"
        autocomplete="email"
        required
        :error="emailError"
        @update:model-value="update({ email: $event })"
      />
      <CheckoutField
        label="Phone Number"
        type="tel"
        :model-value="modelValue.whatsapp"
        autocomplete="tel"
        required
        :error="phoneError"
        @update:model-value="update({ whatsapp: $event })"
      />

      <!-- honeypot: hidden from real guests, tempting to bots. -->
      <div class="hidden" aria-hidden="true">
        <label>Company
          <input :value="modelValue.company" type="text" tabindex="-1" autocomplete="off" @input="update({ company: $event.target.value })" />
        </label>
      </div>

      <div class="border-t border-ink/10 pt-6">
        <button
          v-if="!codeOpen && !modelValue.invitationCategory"
          type="button"
          class="text-xs font-semibold text-ink/50 underline decoration-dotted underline-offset-4 hover:text-coral"
          @click="codeOpen = true"
        >
          Have an invitation code?
        </button>

        <div v-if="codeOpen || modelValue.invitationCategory">
          <span class="lbl block text-xs font-semibold uppercase tracking-widest2 text-ink/50">Invitation code</span>
          <div class="mt-2 flex gap-2">
            <input
              :value="modelValue.invitationCode"
              type="text"
              placeholder="e.g. ABCD-EFGH-JKLM"
              class="flex-1 rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-sm text-ink focus:border-coral focus:outline-none"
              :disabled="checkingCode"
              @input="onCodeInput($event.target.value)"
            />
            <button
              type="button"
              class="btn-outline shrink-0 px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="checkingCode || !modelValue.invitationCode.trim()"
              @click="applyCode"
            >
              {{ checkingCode ? 'Checking…' : 'Apply' }}
            </button>
          </div>
          <p v-if="modelValue.invitationCategory" class="mt-2 rounded-xl bg-seafoam/40 px-3 py-2 text-xs font-semibold text-ink">
            ✓ {{ categoryLabel }} invitation applied — this registration will be complimentary, no payment needed.
          </p>
          <p v-else-if="codeError" class="mt-2 text-xs text-coral">{{ codeError }}</p>
        </div>
      </div>

      <div class="border-t border-ink/10 pt-6">
        <div class="flex items-center gap-2">
          <h2 class="font-display text-lg font-semibold text-ink">Your Measurements</h2>
          <button
            type="button"
            class="text-xs font-semibold text-coral underline decoration-dotted underline-offset-4 hover:text-coral-dark"
            @click="guideOpen = true"
          >
            How to Measure
          </button>
        </div>
        <p class="mt-1 text-xs text-ink/45">Optional, but helpful for achieving your best fit.</p>

        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CheckoutField
            label="Bust (inches)"
            type="number"
            optional
            step="0.1"
            min="10"
            max="120"
            placeholder="e.g. 34.5"
            :model-value="modelValue.bust"
            :error="bustError"
            @update:model-value="update({ bust: $event })"
          />
          <CheckoutField
            label="Underbust (inches)"
            type="number"
            optional
            step="0.1"
            min="10"
            max="120"
            placeholder="e.g. 30"
            :model-value="modelValue.underbust"
            :error="underbustError"
            @update:model-value="update({ underbust: $event })"
          />
          <CheckoutField
            label="Waist (inches)"
            type="number"
            optional
            step="0.1"
            min="10"
            max="120"
            placeholder="e.g. 28"
            :model-value="modelValue.waist"
            :error="waistError"
            @update:model-value="update({ waist: $event })"
          />
          <CheckoutField
            label="Hips (inches)"
            type="number"
            optional
            step="0.1"
            min="10"
            max="120"
            placeholder="e.g. 39"
            :model-value="modelValue.hips"
            :error="hipsError"
            @update:model-value="update({ hips: $event })"
          />
        </div>
      </div>
    </div>

    <BikiniMixCustomerMeasurementGuide v-model="guideOpen" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { isValidEmail, isValidPhone, isValidMeasurement, MEASUREMENT_MIN_INCHES, MEASUREMENT_MAX_INCHES } from '~/utils/validate'

const props = defineProps({
  modelValue: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

function update(patch) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const emailError = computed(() => {
  const value = props.modelValue.email.trim()
  return value && !isValidEmail(value) ? 'Enter a valid email address.' : ''
})
const phoneError = computed(() => {
  const value = props.modelValue.whatsapp.trim()
  return value && !isValidPhone(value) ? 'Enter a valid phone number.' : ''
})

// Measurements are entirely optional — only validated (positive, realistic
// range) when the customer actually types something in.
function measurementError(value) {
  if (isValidMeasurement(value)) return ''
  return `Enter a realistic measurement (${MEASUREMENT_MIN_INCHES}–${MEASUREMENT_MAX_INCHES} in), or leave this blank.`
}
const bustError = computed(() => measurementError(props.modelValue.bust))
const underbustError = computed(() => measurementError(props.modelValue.underbust))
const waistError = computed(() => measurementError(props.modelValue.waist))
const hipsError = computed(() => measurementError(props.modelValue.hips))

const guideOpen = ref(false)

// ── Complimentary invitation code ───────────────────────────────────────
// A lightweight, read-only pre-check so the guest gets immediate feedback
// — the actual redemption only ever happens server-side, atomically,
// inside claim_bikini_mix_comp_booking() at final submission (StepReview's
// payNow()). This endpoint never marks anything as used.
const codeOpen = ref(false)
const checkingCode = ref(false)
const codeError = ref('')
const CATEGORY_LABELS = { event_assistant: 'Event Assistant', giveaway: 'Giveaway', other: 'Complimentary' }
const categoryLabel = computed(() => CATEGORY_LABELS[props.modelValue.invitationCategory] || '')

// Any edit to the code AFTER it was applied immediately clears the
// "applied" state — an edited-but-not-reapplied code must never keep
// showing as valid.
function onCodeInput(value) {
  codeError.value = ''
  update({ invitationCode: value, invitationCategory: null })
}

async function applyCode() {
  const code = props.modelValue.invitationCode.trim()
  if (!code || checkingCode.value) return
  checkingCode.value = true
  codeError.value = ''
  try {
    const res = await $fetch('/api/bikini-mix/invitation-code/check', { method: 'POST', body: { code } })
    if (res.valid) {
      update({ invitationCategory: res.category })
    } else {
      codeError.value = 'That code is invalid, expired, or has already been used.'
    }
  } catch (err) {
    codeError.value = err?.data?.error || 'Could not check that code right now — please try again.'
  } finally {
    checkingCode.value = false
  }
}
</script>
