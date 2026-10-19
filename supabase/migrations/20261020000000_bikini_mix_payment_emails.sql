-- ─────────────────────────────────────────────────────────────────────────
-- Bikini Mix — payment-confirmation email idempotency columns.
--
-- Adds the same lease + durable-marker pair already proven on `orders`
-- (paid_email_sent_at / paid_email_claimed_at — see server/utils/paidOrderEmails.js)
-- to bikini_mix_bookings, so a duplicate/concurrent Go2Pay callback can never
-- send the booking confirmation email twice. See
-- server/utils/bikiniMixBookingEmails.js for the claim/send/finalize protocol.
--
-- NOT applied automatically — run once in the Supabase SQL editor (or via
-- `supabase db push --linked`) after the 20261019000000_bikini_mix.sql
-- migration is already live. Purely additive: two nullable columns, no
-- change to any existing column, row, policy or function.
-- ─────────────────────────────────────────────────────────────────────────

alter table bikini_mix_bookings
  add column if not exists paid_email_sent_at timestamptz,
  add column if not exists paid_email_claimed_at timestamptz;
