/**
 * Phase 4 security hardening — sets Content-Security-Policy on every
 * rendered PAGE response (this hook doesn't fire for /api/* routes, which
 * never render HTML — see server/middleware/securityHeaders.js for the
 * headers that apply everywhere). Logic lives in
 * server/utils/contentSecurityPolicy.js so it's unit-testable without a
 * running Nitro instance.
 */
import { createHash } from 'node:crypto'
import { extractInlineScriptHashes, buildContentSecurityPolicy } from '../utils/contentSecurityPolicy.js'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response) => {
    if (typeof response.body !== 'string') return

    const hashes = extractInlineScriptHashes(response.body, (content) =>
      createHash('sha256').update(content, 'utf8').digest('base64')
    )
    const csp = buildContentSecurityPolicy(hashes, { supabaseUrl: process.env.SUPABASE_URL })

    response.headers = { ...(response.headers || {}), 'content-security-policy': csp }
  })
})
