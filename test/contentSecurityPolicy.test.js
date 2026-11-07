import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { extractInlineScriptHashes, buildContentSecurityPolicy } from '../server/utils/contentSecurityPolicy.js'

const hashFn = (content) => createHash('sha256').update(content, 'utf8').digest('base64')

describe('extractInlineScriptHashes', () => {
  it('hashes a bare inline <script> (no type attribute) — Nuxt\'s config injection', () => {
    const html = '<html><body><script>window.__NUXT__={foo:1}</script></body></html>'
    const hashes = extractInlineScriptHashes(html, hashFn)
    expect(hashes).toEqual([hashFn('window.__NUXT__={foo:1}')])
  })

  it('ignores <script type="application/json"> data islands (Nuxt payload/devtools) — not executable', () => {
    const html = '<script type="application/json" id="__NUXT_DATA__">{"a":1}</script>'
    expect(extractInlineScriptHashes(html, hashFn)).toEqual([])
  })

  it('ignores external <script type="module" src="...">  — no inline content to hash', () => {
    const html = '<script type="module" src="/_nuxt/entry.js" crossorigin></script>'
    expect(extractInlineScriptHashes(html, hashFn)).toEqual([])
  })

  it('ignores an empty/whitespace-only inline script', () => {
    const html = '<script>   \n  </script>'
    expect(extractInlineScriptHashes(html, hashFn)).toEqual([])
  })

  it('handles multiple inline scripts, hashing each independently', () => {
    const html = '<script>a()</script><script type="application/json">{}</script><script>b()</script>'
    expect(extractInlineScriptHashes(html, hashFn)).toEqual([hashFn('a()'), hashFn('b()')])
  })

  it('matches exactly the real Nuxt production output shape (regression fixture)', () => {
    const html =
      '<script type="application/json" id="unhead:payload">{}</script>' +
      '<script>window.__NUXT__={};window.__NUXT__.config={public:{supabaseUrl:"https://proj.supabase.co"}}</script>' +
      '<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__">[]</script>' +
      '<script type="module" src="/_nuxt/YIc08z3F.js" crossorigin></script>'
    const hashes = extractInlineScriptHashes(html, hashFn)
    expect(hashes).toHaveLength(1)
    expect(hashes[0]).toBe(hashFn('window.__NUXT__={};window.__NUXT__.config={public:{supabaseUrl:"https://proj.supabase.co"}}'))
  })

  it('returns [] for non-string input rather than throwing', () => {
    expect(extractInlineScriptHashes(null, hashFn)).toEqual([])
    expect(extractInlineScriptHashes(undefined, hashFn)).toEqual([])
  })
})

describe('buildContentSecurityPolicy', () => {
  const CONFIG = { supabaseUrl: 'https://proj.supabase.co' }

  it('includes the computed script hash(es), quoted correctly', () => {
    const csp = buildContentSecurityPolicy(['abc123=='], CONFIG)
    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com 'sha256-abc123=='")
  })

  it('never includes unsafe-inline or unsafe-eval for script-src', () => {
    const csp = buildContentSecurityPolicy(['abc123=='], CONFIG)
    const scriptSrcLine = csp.split('; ').find((d) => d.startsWith('script-src'))
    expect(scriptSrcLine).not.toContain('unsafe-inline')
    expect(scriptSrcLine).not.toContain('unsafe-eval')
  })

  it('allows the Supabase project origin for img-src and connect-src (storage images, auth calls)', () => {
    const csp = buildContentSecurityPolicy([], CONFIG)
    expect(csp).toContain('img-src \'self\' data: https://proj.supabase.co')
    expect(csp).toContain('connect-src \'self\' https://proj.supabase.co https://challenges.cloudflare.com')
  })

  it('allows data: in img-src — required for the MFA enrollment QR code', () => {
    const csp = buildContentSecurityPolicy([], CONFIG)
    const imgSrcLine = csp.split('; ').find((d) => d.startsWith('img-src'))
    expect(imgSrcLine).toContain('data:')
  })

  it('allows the Turnstile host for script-src and frame-src (widget script + its iframe)', () => {
    const csp = buildContentSecurityPolicy([], CONFIG)
    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com")
    expect(csp).toContain('frame-src https://challenges.cloudflare.com')
  })

  it('allows Google Fonts for style-src and font-src', () => {
    const csp = buildContentSecurityPolicy([], CONFIG)
    expect(csp).toContain('https://fonts.googleapis.com')
    expect(csp).toContain('https://fonts.gstatic.com')
  })

  it('sets frame-ancestors none (clickjacking protection) and object-src none', () => {
    const csp = buildContentSecurityPolicy([], CONFIG)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it('never mentions Go2Pay at all — a top-level navigation target, not a subresource CSP governs', () => {
    const csp = buildContentSecurityPolicy([], CONFIG)
    expect(csp.toLowerCase()).not.toContain('go2pay')
  })

  it('degrades gracefully (no crash, no stray empty directive) if supabaseUrl is missing', () => {
    expect(() => buildContentSecurityPolicy([], { supabaseUrl: '' })).not.toThrow()
    const csp = buildContentSecurityPolicy([], { supabaseUrl: '' })
    expect(csp).toContain("img-src 'self' data:")
  })

  it('strips a trailing slash from supabaseUrl before using it as an origin', () => {
    const csp = buildContentSecurityPolicy([], { supabaseUrl: 'https://proj.supabase.co/' })
    expect(csp).toContain('https://proj.supabase.co ')
    expect(csp).not.toContain('supabase.co/ ')
  })
})
