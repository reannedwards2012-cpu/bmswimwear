/**
 * Server-side identification of the signed-in customer.
 *
 * The only trusted source is the `Authorization: Bearer <access token>` header,
 * validated against Supabase with the SECRET key via
 * `supabaseAdmin().auth.getUser(token)` — which verifies the JWT signature and
 * expiry AND fetches the current user record live from Supabase (not a local
 * JWT decode), so admin status is always current. A client-supplied `user_id`
 * (or admin flag) is never trusted.
 *
 * Phase 3 (MFA): `requireAdmin` additionally requires the presented token's
 * own Authenticator Assurance Level to be `aal2` (password + a verified TOTP
 * factor) — not just a valid session belonging to an admin account. AAL is
 * read via `getClaims(token)`, which cryptographically verifies the JWT
 * itself (same trust level as `getUser`, just reading the `aal` claim
 * instead of re-fetching the user) — never a locally-decoded, unverified
 * claim. This is enforced here, in the one function every admin API route
 * already calls, so a valid admin password alone — or a session/refresh
 * token minted before MFA was required — can never reach a protected admin
 * endpoint; client-side middleware is UX only, as before. Verified: every
 * file under server/api/admin/ calls this function (see
 * test/adminEndpointsCallRequireAdmin.test.js, which fails the build the
 * moment that's no longer true).
 *
 * ADMIN_MFA_ENFORCEMENT ('required' default | 'grace'): a TEMPORARY,
 * operator-only rollout aid, set only via the hosting environment (never an
 * app setting, never writable by any request) — see the Phase 3 rollout
 * report for exactly when to use it. In 'grace', an admin who has NEVER
 * enrolled any factor (mfa_enrollment_required) is allowed through exactly
 * as if MFA didn't exist yet — i.e. no worse than this app's own
 * pre-Phase-3 security posture, not a new weaker state. It does NOT affect
 * `mfa_verification_required` (an admin who HAS a verified factor but this
 * session hasn't stepped up) — that case is ALWAYS enforced, grace or not,
 * so grace mode can never be used to dodge an already-enrolled admin's MFA,
 * including right after a lost-factor recovery (removing a factor returns
 * that admin to "never enrolled", which must go through real enrollment
 * again, same as a brand new admin — see the recovery procedure in the
 * rollout report). Every grace-mode pass-through is logged loudly so
 * leaving this on by accident is noisy, not silent.
 */
import { supabaseAdmin } from './supabaseAdmin.js'

const ADMIN_MFA_ENFORCEMENT = process.env.ADMIN_MFA_ENFORCEMENT === 'grace' ? 'grace' : 'required'

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
      appMetadata: data.user.app_metadata ?? {},
      // Live, current factor list (not cached in the JWT) — used only to
      // distinguish "never enrolled MFA" from "enrolled but this session
      // hasn't verified it yet" when reporting why an admin check failed.
      hasVerifiedMfaFactor: Array.isArray(data.user.factors) && data.user.factors.some((f) => f.status === 'verified')
    }
  } catch {
    return null
  }
}

/**
 * The presented token's own Authenticator Assurance Level ('aal1' | 'aal2'),
 * or null if the token can't be verified. getClaims() cryptographically
 * verifies the JWT (via cached JWKS, or an Auth-server round trip for
 * symmetric-key projects — correct either way), so this is just as trusted
 * as the getUser() call already made in verify() above.
 */
async function getAal(token) {
  try {
    const { data, error } = await supabaseAdmin().auth.getClaims(token)
    if (error || !data?.claims) return null
    return data.claims.aal ?? null
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
 *
 * Phase 3 (MFA): ALSO throws 403 if the presented token's own `aal` claim
 * isn't `aal2` — a password-only (aal1) session, however valid, is not
 * enough. The error body's `code` distinguishes *why*, so the frontend can
 * route an admin to the right next step without this function ever
 * weakening the check itself:
 *   - `mfa_enrollment_required` — this admin has no verified TOTP factor at
 *     all yet (first run after this feature ships, or a recovered account).
 *   - `mfa_verification_required` — a verified factor exists, but THIS
 *     token was minted before stepping up (e.g. password sign-in just
 *     happened, or an old pre-MFA session/refresh token is still in use).
 * Both cases are rejected identically by this function — the distinction
 * is for UX only, never a backdoor; every admin API route still goes
 * through this exact check with no bypass.
 */
export async function requireAdmin(event) {
  const token = bearerToken(event)
  const user = await verify(token)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  if (user.appMetadata?.is_admin !== true) {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }

  const aal = await getAal(token)
  if (aal !== 'aal2') {
    const code = user.hasVerifiedMfaFactor ? 'mfa_verification_required' : 'mfa_enrollment_required'

    if (code === 'mfa_enrollment_required' && ADMIN_MFA_ENFORCEMENT === 'grace') {
      console.warn(
        `[SECURITY] ADMIN_MFA_ENFORCEMENT=grace allowed admin ${user.id} through WITHOUT MFA enrolled — ` +
          'this is a temporary rollout aid. Enroll this account at /admin/security, then unset ADMIN_MFA_ENFORCEMENT.'
      )
      return { id: user.id, email: user.email }
    }

    throw createError({ statusCode: 403, statusMessage: 'Multi-factor verification required', data: { code } })
  }

  return { id: user.id, email: user.email }
}
