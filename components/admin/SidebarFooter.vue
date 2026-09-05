<template>
  <div class="mt-6 space-y-3 border-t border-ink/10 pt-5">
    <p v-if="user?.email" class="truncate text-xs text-ink/40">{{ user.email }}</p>
    <NuxtLink to="/" class="block text-xs font-semibold uppercase tracking-widest2 text-ink/45 hover:text-ink">
      ← Back to site
    </NuxtLink>
    <button
      type="button"
      class="text-xs font-semibold uppercase tracking-widest2 text-ink/45 transition-colors hover:text-coral"
      :disabled="signingOut"
      @click="onSignOut"
    >
      {{ signingOut ? 'Signing out…' : 'Sign out' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const { user, signOut } = useAuth()
const signingOut = ref(false)

async function onSignOut() {
  signingOut.value = true
  await signOut()
  await navigateTo('/')
}
</script>
