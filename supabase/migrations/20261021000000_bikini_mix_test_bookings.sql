-- ─────────────────────────────────────────────────────────────────────────
-- Bikini Mix — admin-only test bookings.
--
-- Adds `is_test` to bikini_mix_bookings (purely additive — no existing
-- column, row, policy or function is touched) and a second claim RPC,
-- claim_bikini_mix_booking_test(), used ONLY by the new admin-gated
-- POST /api/admin/bikini-mix/test-checkout endpoint. This lets an admin
-- walk the real five-step flow and a real Go2Pay payment end-to-end while
-- the public event stays closed (is_bookings_open = false) — see
-- server/utils/bikiniMixTestMode.js for the full design writeup.
--
-- NOT applied automatically — awaiting explicit approval, same convention
-- as every migration in this project.
-- ─────────────────────────────────────────────────────────────────────────

alter table bikini_mix_bookings
  add column if not exists is_test boolean not null default false;

create index if not exists idx_bikini_mix_bookings_is_test on bikini_mix_bookings(is_test) where is_test;

-- ── claim_bikini_mix_booking_test(): admin-only, bypasses ONLY open/deadline ──
--
-- Identical to claim_bikini_mix_booking() in every other respect:
--   - Idempotent on checkout_idempotency_key.
--   - SAME capacity lock (`select ... for update` on bikini_mix_event) —
--     capacity validation stays fully intact, exactly as required. The
--     count excludes other is_test rows (`and not is_test`), so a test
--     booking is checked against the SAME real-world capacity a genuine
--     guest would compete for, without being distorted by earlier tests.
--   - Resulting row gets is_test = true, so it never counts toward real
--     capacity for anyone else (claim_bikini_mix_booking's own count query
--     already excludes it the same way) and is excluded from the
--     production summary (see server/api/admin/bikini-mix/
--     production-summary.get.js).
--
-- Deliberately bypasses ONLY:
--   - is_bookings_open
--   - booking_deadline
-- Every other check — capacity, package validity, idempotency — is
-- unchanged. Payment verification is a completely separate code path
-- (server/utils/bikiniMixPayments.js, the Go2Pay callback) and is never
-- touched by this function at all; a test booking's payment is verified
-- exactly as rigorously as a real one.
create or replace function claim_bikini_mix_booking_test(
  p_checkout_idempotency_key uuid,
  p_package text,
  p_retail_price_xcd_cents integer,
  p_top_size text,
  p_left_fabric_id uuid, p_left_fabric_name text, p_left_fabric_hex text,
  p_right_fabric_id uuid, p_right_fabric_name text, p_right_fabric_hex text,
  p_bottom_style text, p_bottom_coverage text, p_bottom_size text,
  p_bottom_fabric_id uuid, p_bottom_fabric_name text, p_bottom_fabric_hex text,
  p_full_name text, p_email text, p_whatsapp text, p_personalization_name text,
  p_marketing_opt_in boolean,
  p_terms_accepted_at timestamptz
) returns bikini_mix_bookings
language plpgsql
as $$
declare
  v_event bikini_mix_event%rowtype;
  v_existing bikini_mix_bookings%rowtype;
  v_confirmed_count integer;
  v_held_count integer;
  v_booking bikini_mix_bookings%rowtype;
begin
  select * into v_existing from bikini_mix_bookings where checkout_idempotency_key = p_checkout_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_event from bikini_mix_event where id = 'default' for update;
  if not found then
    raise exception 'event configuration not found' using errcode = 'P0002';
  end if;

  -- is_bookings_open and booking_deadline are deliberately NOT checked here.

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now() and not is_test;

  if v_confirmed_count + v_held_count >= v_event.capacity then
    raise exception 'event is fully booked' using errcode = '55000';
  end if;

  if p_package not in ('classic_mix', 'the_works') then
    raise exception 'invalid package "%"', p_package using errcode = '22023';
  end if;

  insert into bikini_mix_bookings (
    checkout_idempotency_key, status, hold_expires_at, package, retail_price_xcd_cents,
    top_size, left_fabric_id, left_fabric_name_snapshot, left_fabric_hex_snapshot,
    right_fabric_id, right_fabric_name_snapshot, right_fabric_hex_snapshot,
    bottom_style, bottom_coverage, bottom_size,
    bottom_fabric_id, bottom_fabric_name_snapshot, bottom_fabric_hex_snapshot,
    full_name, email, whatsapp, personalization_name, marketing_opt_in, terms_accepted_at,
    is_test
  ) values (
    p_checkout_idempotency_key, 'pending_payment', now() + (v_event.hold_minutes || ' minutes')::interval,
    p_package, p_retail_price_xcd_cents,
    p_top_size, p_left_fabric_id, p_left_fabric_name, p_left_fabric_hex,
    p_right_fabric_id, p_right_fabric_name, p_right_fabric_hex,
    p_bottom_style, p_bottom_coverage, p_bottom_size,
    p_bottom_fabric_id, p_bottom_fabric_name, p_bottom_fabric_hex,
    p_full_name, p_email, p_whatsapp, p_personalization_name, p_marketing_opt_in, p_terms_accepted_at,
    true
  ) returning * into v_booking;

  return v_booking;
end;
$$;

-- Also update the two REAL functions' capacity queries to exclude test rows,
-- so a test booking can never consume a real guest's slot. This is the one
-- change to existing functions in this migration — additive filtering only,
-- `and not is_test`, nothing else about their behaviour changes.
create or replace function claim_bikini_mix_booking(
  p_checkout_idempotency_key uuid,
  p_package text,
  p_retail_price_xcd_cents integer,
  p_top_size text,
  p_left_fabric_id uuid, p_left_fabric_name text, p_left_fabric_hex text,
  p_right_fabric_id uuid, p_right_fabric_name text, p_right_fabric_hex text,
  p_bottom_style text, p_bottom_coverage text, p_bottom_size text,
  p_bottom_fabric_id uuid, p_bottom_fabric_name text, p_bottom_fabric_hex text,
  p_full_name text, p_email text, p_whatsapp text, p_personalization_name text,
  p_marketing_opt_in boolean,
  p_terms_accepted_at timestamptz
) returns bikini_mix_bookings
language plpgsql
as $$
declare
  v_event bikini_mix_event%rowtype;
  v_existing bikini_mix_bookings%rowtype;
  v_confirmed_count integer;
  v_held_count integer;
  v_booking bikini_mix_bookings%rowtype;
begin
  select * into v_existing from bikini_mix_bookings where checkout_idempotency_key = p_checkout_idempotency_key;
  if found then
    return v_existing;
  end if;

  select * into v_event from bikini_mix_event where id = 'default' for update;
  if not found then
    raise exception 'event configuration not found' using errcode = 'P0002';
  end if;

  if not v_event.is_bookings_open then
    raise exception 'bookings are closed' using errcode = '55000';
  end if;
  if v_event.booking_deadline is not null and current_date > v_event.booking_deadline then
    raise exception 'booking deadline has passed' using errcode = '55000';
  end if;

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now() and not is_test;

  if v_confirmed_count + v_held_count >= v_event.capacity then
    raise exception 'event is fully booked' using errcode = '55000';
  end if;

  if p_package not in ('classic_mix', 'the_works') then
    raise exception 'invalid package "%"', p_package using errcode = '22023';
  end if;

  insert into bikini_mix_bookings (
    checkout_idempotency_key, status, hold_expires_at, package, retail_price_xcd_cents,
    top_size, left_fabric_id, left_fabric_name_snapshot, left_fabric_hex_snapshot,
    right_fabric_id, right_fabric_name_snapshot, right_fabric_hex_snapshot,
    bottom_style, bottom_coverage, bottom_size,
    bottom_fabric_id, bottom_fabric_name_snapshot, bottom_fabric_hex_snapshot,
    full_name, email, whatsapp, personalization_name, marketing_opt_in, terms_accepted_at
  ) values (
    p_checkout_idempotency_key, 'pending_payment', now() + (v_event.hold_minutes || ' minutes')::interval,
    p_package, p_retail_price_xcd_cents,
    p_top_size, p_left_fabric_id, p_left_fabric_name, p_left_fabric_hex,
    p_right_fabric_id, p_right_fabric_name, p_right_fabric_hex,
    p_bottom_style, p_bottom_coverage, p_bottom_size,
    p_bottom_fabric_id, p_bottom_fabric_name, p_bottom_fabric_hex,
    p_full_name, p_email, p_whatsapp, p_personalization_name, p_marketing_opt_in, p_terms_accepted_at
  ) returning * into v_booking;

  return v_booking;
end;
$$;

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

  if v_booking.status in ('confirmed', 'paid_needs_review') then
    return v_booking;
  end if;

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;

  -- A test booking's OWN confirmation never competes against real capacity
  -- in a way that would block a real guest: it is checked against the same
  -- real-only count, exactly like claim does, so "what happens if payment
  -- lands right at capacity" is still genuinely testable without ever
  -- touching a real guest's slot.
  if v_confirmed_count < v_event.capacity then
    v_new_status := 'confirmed';
  else
    v_new_status := 'paid_needs_review';
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

-- ── lock down the new test function exactly like the other two ──────────
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_bikini_mix_booking_test')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
