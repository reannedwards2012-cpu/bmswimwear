import { supabaseAdmin } from '../../utils/supabaseAdmin.js'

/**
 * GET /api/checkout/status?checkout=<uuid>
 *
 * Returns ONLY { paid: boolean } for the order tied to that client checkout id.
 * Used by the payment return page to decide whether to clear the cart —
 * without ever exposing order amounts, ids, status strings or customer data.
 * `paid` is true only once the Go2Pay callback has independently verified
 * payment.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const checkoutId = norm(getQuery(event).checkout)
  if (!UUID_RE.test(checkoutId)) {
    setResponseStatus(event, 400)
    return { paid: false }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .eq('checkout_idempotency_key', checkoutId)
      .maybeSingle()

    if (error) {
      console.error('[checkout status] lookup failed:', error.message)
      setResponseStatus(event, 500)
      return { paid: false }
    }
    return { paid: data?.status === 'paid' }
  } catch (err) {
    console.error('[checkout status] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { paid: false }
  }
})

function norm(v) {
  return typeof v === 'string' ? v.trim() : ''
}
