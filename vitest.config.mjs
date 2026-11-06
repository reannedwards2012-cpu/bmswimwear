import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Resolve Nuxt's `~` / `@` aliases so unit tests can import modules that use
// them (e.g. middleware/auth.js → `~/utils/idleSession`). Tests otherwise use
// plain relative paths and are unaffected.
const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
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
