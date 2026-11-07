import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Resolve Nuxt's `~` / `@` aliases so unit tests can import modules that use
// them (e.g. middleware/auth.js → `~/utils/idleSession`). Tests otherwise use
// plain relative paths and are unaffected.
const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // import.meta.client/.server are Nuxt-injected compile-time constants
  // (not real import.meta properties) — undefined under plain Vite/vitest,
  // which makes any `if (import.meta.client)` guard always take the
  // server/false branch. composables/useAuth.js uses this guard to decide
  // whether to construct its browser Supabase client; test/useAuthMfa.test.js
  // needs it true to exercise that path. No other file in this suite reads
  // either constant today.
  define: { 'import.meta.client': 'true' },
  // Only affects .vue imports (e.g. test/adminIdleWarningModal.test.js
  // mounting a real component with @vue/test-utils) — every other test file
  // in this suite imports plain .js and is unaffected.
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^~\//, replacement: `${root}/` },
      { find: /^@\//, replacement: `${root}/` },
      { find: /^~~\//, replacement: `${root}/` },
      { find: /^@@\//, replacement: `${root}/` }
    ]
  }
})
