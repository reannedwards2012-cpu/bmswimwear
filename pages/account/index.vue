<template>
  <div class="section container-bm">
    <div class="mx-auto max-w-lg">
      <FancyHeading eyebrow="Account" title="Your *account*" center size="sm" as="h1" />

      <div class="mt-7 rounded-4xl bg-cream p-7 shadow-card md:p-9">
        <template v-if="authReady && isLoggedIn">
          <p class="text-xs font-semibold uppercase tracking-widest2 text-ink/60">Signed in as</p>
          <p class="mt-1 break-all text-sm text-ink">{{ user?.email }}</p>

          <div class="mt-6 border-t border-ink/10 pt-6">
            <NuxtLink
              to="/account/orders"
              class="flex items-center justify-between text-sm font-medium text-ink transition-colors hover:text-coral"
            >
              <span>My orders</span>
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </NuxtLink>
            <p class="mt-1 text-xs text-ink/40">Orders you place while signed in.</p>
          </div>

          <button
            type="button"
            class="btn-outline mt-8 w-full"
            :disabled="signingOut"
            @click="onSignOut"
          >
            {{ signingOut ? 'Signing out…' : 'Sign out' }}
          </button>
        </template>

        <p v-else class="text-sm text-ink/50">Loading your account…</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Your account — Bahama Mama Swimwear' })

const { user, isLoggedIn, authReady, signOut } = useAuth()

const signingOut = ref(false)

async function onSignOut() {
  signingOut.value = true
  await signOut()
  await navigateTo('/')
}
</script>
