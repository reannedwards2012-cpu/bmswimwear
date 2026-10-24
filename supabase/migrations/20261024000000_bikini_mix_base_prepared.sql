-- ─────────────────────────────────────────────────────────────────────────
-- Bikini Mix — track whether each booking's physical bikini base (cut/sewn
-- ahead of the event) has been prepared, independent of payment/booking
-- status. Purely additive: one nullable timestamp column, no constraints,
-- no defaults that touch existing rows, no change to any existing query,
-- function, or RLS policy. null = not yet prepared; a timestamp = when an
-- admin marked it done. Fully reversible (drop column) if ever needed.
-- ─────────────────────────────────────────────────────────────────────────

alter table bikini_mix_bookings
  add column base_prepared_at timestamptz;
