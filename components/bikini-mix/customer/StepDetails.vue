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
</script>
