import { buildValidatedOrder } from '../utils/checkoutOrder.js'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'

const GENERIC_ERROR = 'We couldn’t place your order right now. Please try again.'

/**
 * POST /api/checkout
 *
 * Cart payload -> server-side validation -> pending order + order items in
 * Supabase -> order info. No payment/Go2Pay yet.
 *
 * Never trusts client money, names or images (see checkoutOrder.js). Never
 * returns raw Supabase errors or DB internals.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)

  const result = buildValidatedOrder(body)
  if (!result.ok) {
    setResponseStatus(event, 400)
    return { success: false, error: result.error, issues: result.issues }
  }

  const { orderRow, itemRows, subtotalUsdCents } = result

  try {
    const supabase = supabaseAdmin()

    // 1. pending order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderRow)
      .select('id, order_number')
      .single()

    if (orderError || !order) {
      console.error('[checkout] orders insert failed:', orderError?.message)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    // 2. order items
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemRows.map((row) => ({ ...row, order_id: order.id })))

    if (itemsError) {
      // Avoid an orphan order: delete it (order_items.order_id is ON DELETE
      // CASCADE, so any partial items go too). A DB transaction/RPC later.
      console.error('[checkout] order_items insert failed — rolling back order', order.id, itemsError?.message)
      await supabase.from('orders').delete().eq('id', order.id)
      setResponseStatus(event, 500)
      return { success: false, error: GENERIC_ERROR }
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      displayOrderNumber: `BM-${String(order.order_number).padStart(6, '0')}`,
      subtotalUsdCents
    }
  } catch (err) {
    console.error('[checkout] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { success: false, error: GENERIC_ERROR }
  }
})
