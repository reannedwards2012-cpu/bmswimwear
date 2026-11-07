<template>
  <div class="space-y-4">
    <p class="text-sm leading-relaxed text-ink/70">
      Enter the 6-digit code from your authenticator app to finish signing in.
    </p>

    <form novalidate @submit.prevent="onSubmit">
      <label class="block">
        <span class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Authentication code</span>
        <input
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="123456"
          autofocus
          class="mt-1.5 w-full rounded-2xl border border-ink/15 bg-sand/60 px-4 py-2.5 text-center text-lg tracking-[0.3em] text-ink focus:border-coral focus:outline-none"
          :class="{ 'border-coral': error }"
          @input="error = ''"
        >
      </label>
      <p v-if="error" class="mt-2 text-xs text-coral">{{ error }}</p>

      <button type="submit" class="btn-primary mt-4 w-full shadow-soft" :disabled="loading || code.length !== 6">
        {{ loading ? 'Verifying…' : 'Verify and continue' }}
      </button>
    </form>

    <button type="button" class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-coral" :disabled="signingOut" @click="onUseDifferentAccount">
      {{ signingOut ? 'Signing out…' : 'Not you? Sign in with a different account' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { friendlyAuthError } from '~/utils/authErrors'

const emit = defineEmits(['verified'])

const { listTotpFactors, verifyTotp, signOut } = useAuth()

const code = ref('')
const error = ref('')
const loading = ref(false)
const signingOut = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    const { factors, error: listError } = await listTotpFactors()
    const verifiedFactor = factors.find((f) => f.status === 'verified')
    if (listError || !verifiedFactor) {
      error.value = 'Couldn’t find your authenticator — please sign in again.'
      return
    }

    const { error: verifyError } = await verifyTotp(verifiedFactor.id, code.value.trim())
    if (verifyError) {
      error.value = friendlyAuthError(verifyError)
      code.value = ''
      return
    }
    emit('verified')
  } finally {
    loading.value = false
  }
}

async function onUseDifferentAccount() {
  signingOut.value = true
  await signOut()
  await navigateTo('/login')
}
</script>
