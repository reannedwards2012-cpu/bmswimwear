/**
 * Order status rules shared by the admin order endpoints.
 *
 * ORDER_STATUSES is every status value the `orders` table allows — used only
 * to validate an incoming ?status= filter.
 *
 * ADMIN_STATUS_TRANSITIONS is deliberately much narrower: it's the set of
 * status changes an admin is allowed to make by hand. It excludes 'paid' as
 * a target entirely — only the Go2Pay callback (server/utils/go2payVerify.js)
 * may ever mark an order paid, since that's tied to independently verifying
 * the payment and setting paid_at; an admin "manually marking paid" would
 * bypass that verification, which this app must never allow.
 *
 * 'pending' and 'payment_failed' have NO admin-editable transitions in this
 * phase — they stay visible for troubleshooting (per spec), but are
 * deliberately not cancellable here: cancelling a pending order and then
 * having a late, legitimate Go2Pay payment arrive for it is an edge case
 * best avoided rather than handled, keeping this phase simple. (The payment
 * callback already tolerates a no-longer-pending order gracefully — see
 * go2payVerify.js's 'no-longer-pending' outcome — so nothing breaks if this
 * ever changes later, it's just out of scope for now.)
 *
 * 'completed' and 'cancelled' are terminal — no refund/un-cancel flow yet.
 */
export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'completed', 'cancelled', 'payment_failed']

export const ADMIN_STATUS_TRANSITIONS = {
  pending: [],
  payment_failed: [],
  paid: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}
