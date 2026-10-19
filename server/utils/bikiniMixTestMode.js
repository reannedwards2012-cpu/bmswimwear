/**
 * Bikini Mixer admin-only test mode — shared constants + design notes.
 *
 * Lets an admin walk the real five-step booking flow and a real Go2Pay
 * payment end-to-end while the public event stays closed
 * (bikini_mix_event.is_bookings_open = false), via:
 *   - A new RPC, claim_bikini_mix_booking_test() (migration
 *     20261021000000_bikini_mix_test_bookings.sql — NOT yet applied),
 *     which bypasses ONLY the is_bookings_open / booking_deadline checks.
 *     Capacity enforcement, idempotency and package validation are
 *     unchanged; it locks the same event row the real function does.
 *   - A new endpoint, server/api/admin/bikini-mix/test-checkout.post.js,
 *     gated by requireAdmin() — never reachable by a signed-out visitor or
 *     a non-admin account, same server-verified check every other admin
 *     endpoint in this project uses.
 *   - Resulting bookings are flagged is_test = true, which both real RPCs'
 *     capacity queries explicitly exclude (`and not is_test`) — a test
 *     booking can never consume a real guest's slot, and a real booking
 *     can never be blocked by one. The production summary and admin
 *     bookings list both surface this flag rather than hiding it (per
 *     the requirement to keep test records for auditing).
 *   - Payment verification is NOT touched by any of this. The Go2Pay
 *     callback (server/api/payments/go2pay-bikini-mix/[token].post.js) and
 *     server/utils/bikiniMixPayments.js are table-agnostic about is_test —
 *     a test booking's payment is independently verified against Go2Pay
 *     exactly as rigorously as a real one.
 *
 * ── The test charge amount ───────────────────────────────────────────────
 * Deliberately NOT derived from the real event's package prices (so a
 * real-payment test never requires editing live pricing, and a public user
 * can never see or influence it — it only exists server-side, read by the
 * admin-gated test-checkout endpoint). Go2Pay's own documentation (checked
 * directly — go2pay.gd/documentation and /integrations) states no minimum
 * transaction amount at all. US$1.00 is used here as a conservative floor
 * common to most card processors; confirm directly with Go2Pay before
 * relying on it if a lower amount is ever wanted.
 */
export const TEST_CHARGE_USD_CENTS = 100 // US$1.00 — confirm with Go2Pay before lowering; see note above
export const TEST_BOOKING_NAME_PREFIX = '[TEST]'
