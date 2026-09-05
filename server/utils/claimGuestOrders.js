/**
 * Auto-link historical guest orders to a signed-in account when the order
 * email matches the account's *verified* Supabase email.
 *
 * Used by GET /api/account/orders before it lists a customer's history, so a
 * customer who checked out as a guest and later created an account with the
 * same address sees those orders under "My Orders".
 *
 * Security / correctness contract:
 *  - `authEmail` MUST be the email from supabaseAdmin().auth.getUser(token)
 *    (the caller passes user.email from requireUser()) — never a
 *    client-supplied value.
 *  - Only claims rows where `user_id IS NULL` AND the normalized order email
 *    (trimmed, lower-cased) equals the normalized auth email.
 *  - The UPDATE re-asserts `user_id IS NULL`, so a row already owned by ANY
 *    user (including a concurrent claim) is never reassigned — this also
 *    makes the whole operation idempotent.
 *  - Touches ONLY `orders.user_id`. Never status / paid_at / go2pay_* /
 *    order_items / any snapshot field.
 *
 * @returns {Promise<{ claimed: number }>}
 */
export async function claimGuestOrdersForUser(supabase, userId, authEmail) {
  const normalized = typeof authEmail === 'string' ? authEmail.trim().toLowerCase() : ''
  if (!userId || !normalized) return { claimed: 0 }

  // Candidate guest orders. Emails are stored trimmed at checkout time, but
  // normalize both sides here anyway. The dataset of unclaimed guest orders
  // is small for this store; if it ever grows large, add a lower(email)
  // index + a scoped filter.
  const { data: candidates, error: readError } = await supabase
    .from('orders')
    .select('id, email')
    .is('user_id', null)

  if (readError) {
    console.error('[claimGuestOrders] candidate read failed:', readError.message)
    return { claimed: 0 }
  }

  const matchIds = (candidates ?? [])
    .filter((o) => typeof o.email === 'string' && o.email.trim().toLowerCase() === normalized)
    .map((o) => o.id)

  if (matchIds.length === 0) return { claimed: 0 }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ user_id: userId })
    .in('id', matchIds)
    .is('user_id', null) // race/idempotency guard — never overwrite a non-null user_id
    .select('id')

  if (updateError) {
    console.error('[claimGuestOrders] update failed:', updateError.message)
    return { claimed: 0 }
  }

  return { claimed: updated?.length ?? 0 }
}
