/**
 * Phase 4 security hardening — Content-Security-Policy, computed per
 * rendered page rather than hardcoded, so Nuxt's one inline script (the
 * public runtime-config injection, `window.__NUXT__=...`) is allowed by an
 * exact SHA-256 hash instead of 'unsafe-inline'. That script's content is
 * static per build/request (it's just `supabaseUrl`/`turnstileSiteKey`/etc,
 * all already public) but recomputing the hash from the actual rendered
 * HTML — rather than hardcoding a value — means this never silently goes
 * stale if that content, or Nuxt's own injected script format, ever changes.
 *
 * style-src keeps 'unsafe-inline': this app has several `:style` bindings
 * (decorative transforms, a progress-bar width) whose values are arbitrary
 * per-render, so hash/nonce-listing every one isn't practical. This is a
 * deliberate, scoped exception — there is no `v-html` anywhere in the
 * codebase (confirmed via audit), so there's no realistic way for an
 * attacker to get content into that position in the first place, and a
 * malicious inline STYLE (the actual residual risk) can only cause visual
 * spoofing, not code execution — a materially smaller risk than
 * 'unsafe-inline' on script-src would be.
 *
 * Go2Pay and Supabase Auth need NO entry at all here: Go2Pay is a plain
 * top-level navigation (`window.location.href = paymentUrl`), and Supabase
 * Auth/Storage calls are same-origin from the browser's point of view only
 * in the sense that they're normal cross-origin fetches CSP's connect-src
 * governs — both are covered below by the Supabase project origin and,
 * for Go2Pay specifically, by the fact that CSP never restricts top-level
 * navigation targets at all.
 */

const SCRIPT_TAG_RE = /<script(?![^>]*\stype=)[^>]*>([\s\S]*?)<\/script>/g

/** Every inline (no `type=`) <script>'s content, hashed for a script-src
 * 'sha256-...' allowlist. Ignores empty/whitespace-only matches. */
export function extractInlineScriptHashes(html, hashFn) {
  if (typeof html !== 'string') return []
  const hashes = []
  let match
  const re = new RegExp(SCRIPT_TAG_RE)
  while ((match = re.exec(html))) {
    const content = match[1]
    if (content && content.trim()) hashes.push(hashFn(content))
  }
  return hashes
}

/**
 * @param {string[]} scriptHashes base64 sha256 digests (no quoting/prefix)
 * @param {{ supabaseUrl: string }} config
 */
export function buildContentSecurityPolicy(scriptHashes, { supabaseUrl }) {
  const supabaseOrigin = (supabaseUrl || '').replace(/\/+$/, '')
  const scriptSrc = ["'self'", 'https://challenges.cloudflare.com', ...scriptHashes.map((h) => `'sha256-${h}'`)]

  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', supabaseOrigin].filter(Boolean),
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'connect-src': ["'self'", supabaseOrigin, 'https://challenges.cloudflare.com'].filter(Boolean),
    'frame-src': ['https://challenges.cloudflare.com'],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  }

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
  parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}
