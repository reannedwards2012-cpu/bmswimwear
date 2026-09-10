<template>
  <div class="section container-bm">
    <p
      v-if="idleNotice"
      class="mx-auto mb-6 max-w-md rounded-2xl bg-shell/60 p-4 text-center text-sm leading-relaxed text-ink/70"
    >
      You were signed out after being inactive for 24 hours. Please sign in again.
    </p>
    <AuthForm mode="signin" @authenticated="onAuthenticated" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

useHead({ title: 'Sign in — Bahama Mama Swimwear' })

const route = useRoute()

const idleNotice = computed(() => route.query.reason === 'idle')

function onAuthenticated() {
  const r = route.query.redirect
  const dest = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/account'
  return navigateTo(dest)
}
</script>
