import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client, authenticated with the SECRET (service) key.
 *
 * Credentials are read straight from process.env here — they are never placed
 * in Nuxt runtimeConfig (public or private), never rendered, and never sent to
 * the browser. Only code under server/ imports this module, and server/ is
 * bundled into the Nitro function, not the client.
 *
 * The secret key bypasses RLS by design; that is precisely why it must stay
 * on the server. RLS remains enabled with no public policies.
 */
let client

export function supabaseAdmin() {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  // Fail safe if misconfigured — the caller turns this into a generic 500.
  // Note: variable *names* only, never their values.
  if (!url || !secretKey) {
    throw new Error('Supabase server env not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)')
  }

  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return client
}
