<template>
  <div
    v-if="needsMfaEnrollment && route.path !== '/admin/security'"
    class="flex flex-wrap items-center justify-center gap-2 bg-coral px-4 py-2.5 text-center text-sm font-medium text-cream"
  >
    <span>Two-factor authentication isn’t set up on your account yet.</span>
    <NuxtLink to="/admin/security" class="underline underline-offset-2">Set it up now →</NuxtLink>
  </div>
</template>

<script setup>
/**
 * Phase 3 (MFA) follow-up — only ever rendered while
 * ADMIN_MFA_ENFORCEMENT=grace is temporarily letting an unenrolled admin
 * use the dashboard (middleware/admin.js would otherwise have already
 * redirected them to /admin/security in strict mode, so this banner would
 * never get a chance to render there). Deliberately NOT dismissible — the
 * point is to keep nudging towards closing the gap quickly, not to let it
 * be ignored indefinitely.
 */
const { needsMfaEnrollment } = useAuth()
const route = useRoute()
</script>
