/**
 * Server-side identification of the signed-in customer.
 *
 * The only trusted source is the `Authorization: Bearer <access token>` header,
 * validated against Supabase with the SECRET key via
 * `supabaseAdmin().auth.getUser(token)` — which verifies the JWT signature and
 * expiry. A client-supplied `user_id` is never trusted.
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
    return { id: data.user.id, email: data.user.email ?? null }
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
 * Required auth (account API routes). Returns `{ id, email }` for the verified
 * user, or throws a 401.
 */
export async function requireUser(event) {
  const user = await verify(bearerToken(event))
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  return user
}
