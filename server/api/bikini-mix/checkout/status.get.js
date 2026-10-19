import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'

/**
 * GET /api/bikini-mix/checkout/status?checkout=<uuid>
 *
 * Polled by the Bikini Mixer return page while waiting for the Go2Pay
 * callback. Returns ONLY a coarse status — never amounts, ids, names or
 * selections (those come from confirmation.get.js, and only once paid).
 *
 *   'pending'      — no booking yet, or payment not yet verified
 *   'confirmed'    — paid_at set AND status = 'confirmed'
 *   'needs_review' — paid_at set but status = 'paid_needs_review'
 *                    (payment verified; capacity resolution pending)
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const checkoutId = norm(getQuery(event).checkout)
  if (!UUID_RE.test(checkoutId)) {
    setResponseStatus(event, 400)
    return { status: 'pending' }
  }

  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_bookings')
      .select('status, paid_at')
      .eq('checkout_idempotency_key', checkoutId)
      .maybeSingle()

    if (error) {
      console.error('[bikini-mix checkout status] lookup failed:', error.message)
      setResponseStatus(event, 500)
      return { status: 'pending' }
    }
    if (!data || !data.paid_at) return { status: 'pending' }
    return { status: data.status === 'confirmed' ? 'confirmed' : 'needs_review' }
  } catch (err) {
    console.error('[bikini-mix checkout status] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { status: 'pending' }
  }
})

function norm(v) {
  return typeof v === 'string' ? v.trim() : ''
}
