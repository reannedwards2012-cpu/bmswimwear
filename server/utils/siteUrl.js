/**
 * The public origin used to build Go2Pay callback + return URLs.
 *
 * Prefer an explicit SITE_URL; fall back to Netlify's injected `URL`. Trailing
 * slashes are stripped. Throws (caught upstream -> generic error) if neither is
 * set. Go2Pay requires HTTPS, non-loopback endpoints — that is only satisfiable
 * on the deployed site, not local dev.
 */
export function siteUrl() {
  const raw = (process.env.SITE_URL || process.env.URL || '').trim()
  const origin = raw.replace(/\/+$/, '')
  if (!origin) {
    throw new Error('Public site URL not configured (SITE_URL / URL)')
  }
  return origin
}
