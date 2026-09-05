/**
 * Server-side identification of the signed-in customer.
 *
 * The only trusted source is the `Authorization: Bearer <access token>` header,
 * validated against Supabase with the SECRET key via
 * `supabaseAdmin().auth.getUser(token)` — which verifies the JWT signature and
 * expiry AND fetches the current user record live from Supabase (not a local
 * JWT decode), so admin status is always current. A client-supplied `user_id`
 * (or admin flag) is never trusted.
 */
import { supabaseAdmin } from './supabaseAdmin.js'

function bearerToken(event) {
  const header = getRequestHeader(event, 'authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

async function verify(token) {
  if (!token) return null
  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token)
    if (error || !data?.user) return null
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      // Supabase sets email_confirmed_at once the address is verified; null/
      // undefined means unverified. Used to gate historical guest-order
      // claiming (server/utils/claimGuestOrders.js).
      emailVerified: !!data.user.email_confirmed_at,
      appMetadata: data.user.app_metadata ?? {}
    }
  } catch {
    return null
  }
}

/**
 * Optional auth (checkout). Returns the verified user id or `null` — a missing,
 * malformed or expired token simply means "guest". Never throws.
 */
export async function getOptionalUserId(event) {
  const user = await verify(bearerToken(event))
  return user?.id ?? null
}

/**
 * Required auth (account API routes). Returns `{ id, email, emailVerified }`
 * for the verified user, or throws a 401. `email`/`emailVerified` come from
 * the live Supabase Auth record — never from client state.
 */
export async function requireUser(event) {
  const user = await verify(bearerToken(event))
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  return { id: user.id, email: user.email, emailVerified: user.emailVerified }
}

/**
 * Required admin auth (admin API routes). Returns `{ id, email }` for the
 * verified admin user. Throws 401 if not signed in, 403 if signed in but not
 * an admin. Admin status comes only from the live Supabase user record's
 * `app_metadata.is_admin` (set by the project owner directly in Supabase —
 * never writable by the browser client, never read from the request body).
 */
export async function requireAdmin(event) {
  const user = await verify(bearerToken(event))
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  if (user.appMetadata?.is_admin !== true) {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  return { id: user.id, email: user.email }
}
