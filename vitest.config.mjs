import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Resolve Nuxt's `~` / `@` aliases so unit tests can import modules that use
// them (e.g. middleware/auth.js → `~/utils/idleSession`). Tests otherwise use
// plain relative paths and are unaffected.
const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\//, replacement: `${root}/` },
      { find: /^@\//, replacement: `${root}/` },
      { find: /^~~\//, replacement: `${root}/` },
      { find: /^@@\//, replacement: `${root}/` }
    ]
  }
})
