<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-md">
      <FancyHeading
        :eyebrow="sent ? 'Almost there' : 'Account'"
        :title="sent ? 'Check your *inbox*' : 'Reset your *password*'"
        center
        size="sm"
        as="h1"
      />

      <div class="mt-7 rounded-4xl bg-cream p-7 shadow-card md:p-9">
        <template v-if="!sent">
          <p class="text-sm leading-relaxed text-ink/65">
            Enter the email you use for your account and we’ll send you a link to set a new password.
          </p>
          <form class="mt-5 space-y-4" novalidate @submit.prevent="onSubmit">
            <label class="block">
              <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Email</span>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                required
                :class="[
                  'mt-1.5 w-full rounded-2xl border bg-sand/60 px-4 py-2.5 text-sm text-ink focus:outline-none',
                  error ? 'border-coral' : 'border-ink/15 focus:border-coral'
                ]"
                @input="error = ''"
              >
              <p v-if="error" class="mt-1 text-xs text-coral">{{ error }}</p>
            </label>
            <button type="submit" class="btn-primary w-full shadow-soft" :disabled="loading">
              {{ loading ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>
        </template>

        <template v-else>
          <p class="text-sm leading-relaxed text-ink/70">
            If an account exists for
            <span class="font-medium text-ink">{{ email }}</span>, a password-reset link is on its
            way. It expires soon, so use it while it’s fresh.
          </p>
        </template>

        <p class="mt-5 text-center text-sm">
          <NuxtLink to="/login" class="text-coral link-underline">Back to sign in</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

useHead({ title: 'Reset your password — Bahama Mama Swimwear' })

const { sendPasswordReset } = useAuth()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
  error.value = ''
  if (!EMAIL_RE.test(email.value.trim())) {
    error.value = 'Enter a valid email address.'
    return
  }
  loading.value = true
  try {
    // Fire the request; always show the same success state afterwards so we
    // never reveal whether an account exists for this email.
    await sendPasswordReset(email.value)
    sent.value = true
  } finally {
    loading.value = false
  }
}
</script>
