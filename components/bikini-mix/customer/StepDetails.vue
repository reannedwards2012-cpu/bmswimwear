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
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { isValidEmail, isValidPhone } from '~/utils/validate'

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
</script>
