<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-md text-center">
      <p class="eyebrow">Account</p>
      <h1 class="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">
        {{ state === 'error' ? 'Link problem' : 'Confirming your account' }}
      </h1>

      <div class="mt-6 rounded-4xl bg-cream p-7 shadow-card md:p-9">
        <p v-if="state === 'working'" class="text-sm text-ink/60">Hang tight — finishing up…</p>
        <template v-else>
          <p class="text-sm leading-relaxed text-ink/70">{{ message }}</p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <NuxtLink to="/register" class="btn-primary">Create an account</NuxtLink>
            <NuxtLink to="/login" class="btn-outline">Sign in</NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

useHead({ title: 'Confirming your account — Bahama Mama Swimwear' })

const { isLoggedIn, authReady } = useAuth()
const route = useRoute()

const state = ref('working') // 'working' | 'error'
const message = ref('')

function urlError() {
  if (!import.meta.client) return null
  const fromHash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const code = fromHash.get('error_code') || route.query.error_code
  const desc =
    fromHash.get('error_description') ||
    route.query.error_description ||
    fromHash.get('error') ||
    route.query.error
  if (!code && !desc) return null
  return typeof desc === 'string'
    ? decodeURIComponent(String(desc).replace(/\+/g, ' '))
    : 'This confirmation link is invalid or has expired.'
}

onMounted(async () => {
  const err = urlError()
  if (err) {
    state.value = 'error'
    message.value = err
    return
  }

  // A recovery link should never land here, but route it correctly if it does.
  if ((window.location.hash || '').toLowerCase().includes('type=recovery')) {
    await navigateTo('/auth/reset-password')
    return
  }

  // The async auth plugin has supabase-js process the URL and settle `authReady`
  // before the app mounts; wait a little longer only as a safety net.
  const deadline = Date.now() + 5000
  while (!authReady.value && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 80))
  }

  if (isLoggedIn.value) {
    await navigateTo('/account')
    return
  }

  state.value = 'error'
  message.value =
    'We couldn’t confirm your account from that link — it may have expired. Try creating your account again.'
})
</script>
