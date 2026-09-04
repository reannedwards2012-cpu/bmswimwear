<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-md">
      <FancyHeading
        eyebrow="Account"
        :title="done ? 'Password *updated*' : 'Set a new *password*'"
        center
        size="sm"
        as="h1"
      />

      <div class="mt-7 rounded-4xl bg-cream p-7 shadow-card md:p-9">
        <p v-if="phase === 'checking'" class="text-sm text-ink/60">Checking your link…</p>

        <template v-else-if="phase === 'invalid'">
          <p class="text-sm leading-relaxed text-ink/70">
            This password-reset link is invalid or has expired. Request a fresh one and we’ll email
            it right over.
          </p>
          <NuxtLink to="/forgot-password" class="btn-primary mt-5">Request a new link</NuxtLink>
        </template>

        <p v-else-if="done" class="text-sm leading-relaxed text-ink/70">
          Your password has been updated. Taking you to your account…
        </p>

        <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">New password</span>
            <input
              v-model="pw"
              type="password"
              autocomplete="new-password"
              required
              :class="inputClass(errPw)"
              @input="errPw = ''"
            >
            <p v-if="errPw" class="mt-1 text-xs text-coral">{{ errPw }}</p>
            <p v-else class="mt-1 text-xs text-ink/40">{{ PASSWORD_HINT }}</p>
          </label>

          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Confirm new password</span>
            <input
              v-model="pw2"
              type="password"
              autocomplete="new-password"
              required
              :class="inputClass(errPw2)"
              @input="errPw2 = ''"
            >
            <p v-if="errPw2" class="mt-1 text-xs text-coral">{{ errPw2 }}</p>
          </label>

          <button type="submit" class="btn-primary w-full shadow-soft" :disabled="loading">
            {{ loading ? 'Updating…' : 'Update password' }}
          </button>

          <p v-if="formError" class="text-sm text-coral">{{ formError }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { PASSWORD_HINT, friendlyAuthError } from '~/utils/authErrors'

useHead({ title: 'Set a new password — Bahama Mama Swimwear' })

const { isLoggedIn, authReady, updatePassword } = useAuth()
const route = useRoute()

const phase = ref('checking') // 'checking' | 'invalid' | 'form'
const done = ref(false)
const pw = ref('')
const pw2 = ref('')
const errPw = ref('')
const errPw2 = ref('')
const formError = ref('')
const loading = ref(false)

const inputClass = (err) => [
  'mt-1.5 w-full rounded-2xl border bg-sand/60 px-4 py-2.5 text-sm text-ink focus:outline-none',
  err ? 'border-coral' : 'border-ink/15 focus:border-coral'
]

function urlHasError() {
  if (!import.meta.client) return false
  const hash = (window.location.hash || '').toLowerCase()
  return /error|denied|expired/.test(hash) || !!route.query.error || !!route.query.error_code
}

onMounted(async () => {
  if (urlHasError()) {
    phase.value = 'invalid'
    return
  }

  // The recovery link creates a session via supabase-js (the async auth plugin
  // settles `authReady` before mount). Password update is only allowed while
  // that recovery session exists.
  const deadline = Date.now() + 5000
  while (!authReady.value && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 80))
  }
  phase.value = isLoggedIn.value ? 'form' : 'invalid'
})

async function onSubmit() {
  errPw.value = ''
  errPw2.value = ''
  formError.value = ''

  if (pw.value.length < 8) {
    errPw.value = 'Use at least 8 characters.'
    return
  }
  if (pw.value !== pw2.value) {
    errPw2.value = 'Those passwords don’t match.'
    return
  }

  loading.value = true
  try {
    const { error } = await updatePassword(pw.value)
    if (error) {
      formError.value = friendlyAuthError(error)
      return
    }
    done.value = true
    setTimeout(() => navigateTo('/account'), 1200)
  } finally {
    loading.value = false
  }
}
</script>
