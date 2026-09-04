/**
 * Auth session bootstrap — client only.
 *
 * Async so Nuxt awaits it: by the time route middleware runs, the session has
 * been restored from storage and `authReady` is true. Session persistence and
 * token refresh are handled by supabase-js itself (see composables/useAuth.js).
 */
import { initAuthClient } from '~/composables/useAuth'

export default defineNuxtPlugin(async () => {
  await initAuthClient()
})
