-- ─────────────────────────────────────────────────────────────────────────
-- Bikini Mix — a verified test booking always reaches 'confirmed', even
-- when real event capacity is full.
--
-- Single change to confirm_bikini_mix_booking_payment(): branch on
-- v_booking.is_test BEFORE the capacity check. Test bookings skip the
-- capacity comparison entirely and go straight to 'confirmed' — safe to do
-- unconditionally because:
--   - They are already excluded from the v_confirmed_count query itself
--     (`and not is_test`, from 20261021000000), so this cannot shift real
--     capacity math in either direction.
--   - They are excluded from the production summary
--     (server/api/admin/bikini-mix/production-summary.get.js,
--     `.eq('is_test', false)`).
--   - The REAL-booking branch below is byte-for-byte unchanged from
--     20261021000000 — capacity enforcement for a genuine guest is
--     identical to before.
--   - Go2Pay verification is a completely separate, earlier step
--     (server/utils/bikiniMixPayments.js) that already ran, independently,
--     before this function is ever called — nothing here touches it, and a
--     test booking's payment is verified exactly as rigorously as a real
--     one's.
--
-- Purely a function body change — no column, row, policy, grant or other
-- function is touched.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function confirm_bikini_mix_booking_payment(
  p_booking_id uuid,
  p_go2pay_order_id text,
  p_payment_id text
) returns bikini_mix_bookings
language plpgsql
as $$
declare
  v_event bikini_mix_event%rowtype;
  v_booking bikini_mix_bookings%rowtype;
  v_confirmed_count integer;
  v_new_status text;
begin
  select * into v_event from bikini_mix_event where id = 'default' for update;

  select * into v_booking from bikini_mix_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking % not found', p_booking_id using errcode = 'P0002';
  end if;

  -- Idempotent: a repeat callback for an already-resolved booking is a no-op.
  if v_booking.status in ('confirmed', 'paid_needs_review') then
    return v_booking;
  end if;

  if v_booking.is_test then
    -- Never gated by real capacity — a test booking is already excluded
    -- from every real capacity count, so it is free to always confirm,
    -- letting an admin reliably exercise the full confirmed happy-path
    -- regardless of how full the real event is.
    v_new_status := 'confirmed';
  else
    select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;

    if v_confirmed_count < v_event.capacity then
      v_new_status := 'confirmed';
    else
      v_new_status := 'paid_needs_review';
    end if;
  end if;

  update bikini_mix_bookings set
    status = v_new_status,
    go2pay_order_id = p_go2pay_order_id,
    payment_id = p_payment_id,
    paid_at = now(),
    admin_notes = case when v_new_status = 'paid_needs_review' then
      coalesce(admin_notes || E'\n', '') ||
      'Payment verified after the hold expired, and the event was at capacity at that moment — needs manual resolution (confirm as an exception, or refund per the cancellation policy).'
    else admin_notes end,
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;
