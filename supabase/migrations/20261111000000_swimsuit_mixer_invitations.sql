-- ─────────────────────────────────────────────────────────────────────────
-- The Swimsuit Mixer — complimentary invitation codes (Event Assistant /
-- Giveaway / Other).
--
-- Plain SQL script for the Supabase SQL editor, NOT applied by this repo
-- automatically — same convention as every other migration here.
--
-- NOTHING here changes the meaning of any existing row. Every new column
-- is additive with a default that is a no-op for every historical/paid
-- booking (`is_complimentary` defaults false). There are exactly TWO
-- changes to the EXISTING paid functions, both pure hardening, neither
-- ever triggered by a real guest's normal retry:
--   1. Adding `and not is_complimentary` to the three capacity-count
--      queries — a no-op against all current data (every existing row is
--      already is_complimentary = false); it only starts to matter once a
--      complimentary booking exists, at which point it is exactly what
--      keeps that booking from consuming one of the 12 paid spots.
--   2. Tightening the idempotency short-circuit at the top of EVERY claim
--      function (paid, test, AND comp) so it only ever returns an existing
--      row that belongs to ITS OWN flow (`not is_complimentary` for the two
--      paid functions, `is_complimentary` for the comp one). Without this,
--      an attacker who replays the SAME checkout_idempotency_key across
--      claim_bikini_mix_booking() and claim_bikini_mix_comp_booking() could
--      make the comp function hand back a real paid (or still-pending)
--      booking without ever checking a code — or vice versa — bypassing
--      the whole point of redemption. A legitimate retry never reuses a
--      key across two different flows (the frontend only ever generates
--      one key per combination, for one flow), so this can only ever block
--      the exploit, never a real retry.
--
-- ── Design ──────────────────────────────────────────────────────────────
-- A complimentary booking is never a "payment that happens to be free" —
-- it skips the hold/Go2Pay machinery entirely. claim_bikini_mix_comp_booking()
-- is a wholly separate RPC (mirroring how claim_bikini_mix_booking_test()
-- is a separate sibling of claim_bikini_mix_booking(), not a flag bolted
-- onto it) that:
--   1. Locks the INVITATION CODE row itself (`for update`), not the
--      bikini_mix_event row — a different code's lock is completely
--      independent, so redeeming a comp code never contends with (or is
--      affected by) a concurrent real paid checkout.
--   2. Rejects if the code doesn't exist, or isn't `status = 'active'` —
--      this is what makes "prevent reuse" and "prevent simultaneous
--      redemption of the same code" airtight: two concurrent redemption
--      attempts of the SAME code are serialized by the row lock, so the
--      second one to acquire it always sees the first one's already-
--      applied 'redeemed' status and fails cleanly, every time.
--   3. On success, inserts the booking directly as status='confirmed',
--      paid_at=now() (there is no payment to wait for), charged_usd_cents
--      = null, retail_price_xcd_cents = 0, payment_provider =
--      'complimentary' — and marks the code 'redeemed' in the SAME
--      transaction. There is no pending/hold state for a comp booking.
--   4. Never references bikini_mix_event.capacity (the 12-paid-spot cap)
--      at all — a comp booking's only limit is how many codes exist for
--      its category, which is enforced at code-GENERATION time (see the
--      admin endpoint), not here.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. bikini_mix_invitation_codes ──────────────────────────────────────
create table if not exists bikini_mix_invitation_codes (
  id uuid primary key default gen_random_uuid(),
  -- HMAC-SHA256 of the plaintext code (domain-separated from IP hashing —
  -- see server/utils/bikiniMixInvitationCodes.js). The plaintext itself is
  -- NEVER stored — it is shown to the admin exactly once, at generation
  -- time, same posture as any other secret-shown-once pattern.
  code_hash text not null unique,
  category text not null check (category in ('event_assistant', 'giveaway', 'other')),
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked')),
  redeemed_by_booking_id uuid references bikini_mix_bookings(id) on delete set null,
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_bikini_mix_invitation_codes_category_status
  on bikini_mix_invitation_codes (category, status);

alter table bikini_mix_invitation_codes enable row level security; -- zero policies, same posture as every other table here

-- ── 2. bikini_mix_event — per-category code-issuance caps ──────────────
-- Same admin-editable pattern as early_bird_slots. Enforced at code-
-- GENERATION time only (server/api/admin/bikini-mix/invitation-codes/
-- index.post.js) — once a code exists, it was already within the cap that
-- applied when it was issued; redemption never re-checks this.
alter table bikini_mix_event add column if not exists comp_event_assistant_slots integer not null default 2 check (comp_event_assistant_slots >= 0);
alter table bikini_mix_event add column if not exists comp_giveaway_slots integer not null default 1 check (comp_giveaway_slots >= 0);
alter table bikini_mix_event add column if not exists comp_other_slots integer not null default 0 check (comp_other_slots >= 0);

-- ── 3. bikini_mix_bookings — complimentary tracking ─────────────────────
alter table bikini_mix_bookings add column if not exists is_complimentary boolean not null default false;
alter table bikini_mix_bookings add column if not exists invitation_category text check (invitation_category in ('event_assistant', 'giveaway', 'other'));
alter table bikini_mix_bookings add column if not exists invitation_code_id uuid references bikini_mix_invitation_codes(id) on delete set null;

create index if not exists idx_bikini_mix_bookings_complimentary on bikini_mix_bookings (is_complimentary) where is_complimentary;

-- ── 4. The one required touch to the EXISTING paid RPCs ────────────────
-- Identical to the previously-deployed bodies (20261106000000_checkout_
-- abuse_protection.sql) except each capacity-count query gains
-- `and not is_complimentary`. Same signatures as today — no drop-first
-- dance needed (CREATE OR REPLACE is safe when the parameter list is
-- unchanged).
create or replace function claim_bikini_mix_booking(
  p_checkout_idempotency_key uuid,
  p_garment_type text,
  p_top_size text,
  p_left_fabric_id uuid, p_left_fabric_name text, p_left_fabric_hex text,
  p_right_fabric_id uuid, p_right_fabric_name text, p_right_fabric_hex text,
  p_bottom_style text, p_bottom_coverage text, p_bottom_size text,
  p_bottom_fabric_id uuid, p_bottom_fabric_name text, p_bottom_fabric_hex text,
  p_bottom_scrunch boolean,
  p_onepiece_size text, p_onepiece_coverage text,
  p_onepiece_fabric_id uuid, p_onepiece_fabric_name text, p_onepiece_fabric_hex text,
  p_full_name text, p_email text, p_whatsapp text,
  p_marketing_opt_in boolean,
  p_terms_accepted_at timestamptz,
  p_client_ip_hash text default null
) returns bikini_mix_bookings
language plpgsql
as $$
declare
  v_event bikini_mix_event%rowtype;
  v_existing bikini_mix_bookings%rowtype;
  v_confirmed_count integer;
  v_held_count integer;
  v_early_bird_used integer;
  v_early_bird_quoted boolean;
  v_retail_price integer;
  v_ip_early_bird_holds integer;
  v_booking bikini_mix_bookings%rowtype;
begin
  select * into v_existing from bikini_mix_bookings where checkout_idempotency_key = p_checkout_idempotency_key;
  if found then
    -- Only ever return a row that belongs to THIS flow — see the banner
    -- comment's "exactly TWO changes" note. A key collision with a
    -- complimentary booking (created by claim_bikini_mix_comp_booking())
    -- must never be treated as "already claimed" by the paid flow.
    if v_existing.is_complimentary then
      raise exception 'checkout id already used by a different booking flow' using errcode = '55000';
    end if;
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

  if p_garment_type not in ('bikini', 'onepiece') then
    raise exception 'invalid garment type "%"', p_garment_type using errcode = '22023';
  end if;

  if p_garment_type = 'bikini' then
    p_onepiece_size := null; p_onepiece_coverage := null;
    p_onepiece_fabric_id := null; p_onepiece_fabric_name := null; p_onepiece_fabric_hex := null;
  else
    p_top_size := null;
    p_left_fabric_id := null; p_left_fabric_name := null; p_left_fabric_hex := null;
    p_right_fabric_id := null; p_right_fabric_name := null; p_right_fabric_hex := null;
    p_bottom_style := null; p_bottom_coverage := null; p_bottom_size := null;
    p_bottom_fabric_id := null; p_bottom_fabric_name := null; p_bottom_fabric_hex := null;
    p_bottom_scrunch := false;
  end if;

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test and not is_complimentary;
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now() and not is_test and not is_complimentary;

  if v_confirmed_count + v_held_count >= v_event.capacity then
    raise exception 'event is fully booked' using errcode = '55000';
  end if;

  select count(*) into v_early_bird_used
  from bikini_mix_bookings
  where not is_test and not is_complimentary and (
    (status = 'confirmed' and early_bird_applied)
    or (status = 'pending_payment' and hold_expires_at > now() and early_bird_quoted)
  );

  if v_early_bird_used < v_event.early_bird_slots then
    v_early_bird_quoted := true;
    v_retail_price := v_event.early_bird_price_xcd_cents;
  else
    v_early_bird_quoted := false;
    v_retail_price := v_event.regular_price_xcd_cents;
  end if;

  if v_early_bird_quoted and p_client_ip_hash is not null then
    select count(*) into v_ip_early_bird_holds
    from bikini_mix_bookings
    where not is_test
      and client_ip_hash = p_client_ip_hash
      and status = 'pending_payment'
      and early_bird_quoted
      and hold_expires_at > now();

    if v_ip_early_bird_holds >= 1 then
      v_early_bird_quoted := false;
      v_retail_price := v_event.regular_price_xcd_cents;
    end if;
  end if;

  insert into bikini_mix_bookings (
    checkout_idempotency_key, status, hold_expires_at, package, retail_price_xcd_cents,
    garment_type, bottom_scrunch,
    top_size, left_fabric_id, left_fabric_name_snapshot, left_fabric_hex_snapshot,
    right_fabric_id, right_fabric_name_snapshot, right_fabric_hex_snapshot,
    bottom_style, bottom_coverage, bottom_size,
    bottom_fabric_id, bottom_fabric_name_snapshot, bottom_fabric_hex_snapshot,
    onepiece_size, onepiece_coverage,
    onepiece_fabric_id, onepiece_fabric_name_snapshot, onepiece_fabric_hex_snapshot,
    full_name, email, whatsapp, marketing_opt_in, terms_accepted_at,
    early_bird_quoted, client_ip_hash
  ) values (
    p_checkout_idempotency_key, 'pending_payment', now() + (v_event.hold_minutes || ' minutes')::interval,
    'ticket', v_retail_price,
    p_garment_type, p_bottom_scrunch,
    p_top_size, p_left_fabric_id, p_left_fabric_name, p_left_fabric_hex,
    p_right_fabric_id, p_right_fabric_name, p_right_fabric_hex,
    p_bottom_style, p_bottom_coverage, p_bottom_size,
    p_bottom_fabric_id, p_bottom_fabric_name, p_bottom_fabric_hex,
    p_onepiece_size, p_onepiece_coverage,
    p_onepiece_fabric_id, p_onepiece_fabric_name, p_onepiece_fabric_hex,
    p_full_name, p_email, p_whatsapp, p_marketing_opt_in, p_terms_accepted_at,
    v_early_bird_quoted, p_client_ip_hash
  ) returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function claim_bikini_mix_booking_test(
  p_checkout_idempotency_key uuid,
  p_garment_type text,
  p_top_size text,
  p_left_fabric_id uuid, p_left_fabric_name text, p_left_fabric_hex text,
  p_right_fabric_id uuid, p_right_fabric_name text, p_right_fabric_hex text,
  p_bottom_style text, p_bottom_coverage text, p_bottom_size text,
  p_bottom_fabric_id uuid, p_bottom_fabric_name text, p_bottom_fabric_hex text,
  p_bottom_scrunch boolean,
  p_onepiece_size text, p_onepiece_coverage text,
  p_onepiece_fabric_id uuid, p_onepiece_fabric_name text, p_onepiece_fabric_hex text,
  p_full_name text, p_email text, p_whatsapp text,
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
  v_early_bird_used integer;
  v_early_bird_quoted boolean;
  v_retail_price integer;
  v_booking bikini_mix_bookings%rowtype;
begin
  select * into v_existing from bikini_mix_bookings where checkout_idempotency_key = p_checkout_idempotency_key;
  if found then
    if v_existing.is_complimentary then
      raise exception 'checkout id already used by a different booking flow' using errcode = '55000';
    end if;
    return v_existing;
  end if;

  select * into v_event from bikini_mix_event where id = 'default' for update;
  if not found then
    raise exception 'event configuration not found' using errcode = 'P0002';
  end if;

  if p_garment_type not in ('bikini', 'onepiece') then
    raise exception 'invalid garment type "%"', p_garment_type using errcode = '22023';
  end if;

  if p_garment_type = 'bikini' then
    p_onepiece_size := null; p_onepiece_coverage := null;
    p_onepiece_fabric_id := null; p_onepiece_fabric_name := null; p_onepiece_fabric_hex := null;
  else
    p_top_size := null;
    p_left_fabric_id := null; p_left_fabric_name := null; p_left_fabric_hex := null;
    p_right_fabric_id := null; p_right_fabric_name := null; p_right_fabric_hex := null;
    p_bottom_style := null; p_bottom_coverage := null; p_bottom_size := null;
    p_bottom_fabric_id := null; p_bottom_fabric_name := null; p_bottom_fabric_hex := null;
    p_bottom_scrunch := false;
  end if;

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test and not is_complimentary;
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now() and not is_test and not is_complimentary;

  if v_confirmed_count + v_held_count >= v_event.capacity then
    raise exception 'event is fully booked' using errcode = '55000';
  end if;

  select count(*) into v_early_bird_used
  from bikini_mix_bookings
  where not is_test and not is_complimentary and (
    (status = 'confirmed' and early_bird_applied)
    or (status = 'pending_payment' and hold_expires_at > now() and early_bird_quoted)
  );

  if v_early_bird_used < v_event.early_bird_slots then
    v_early_bird_quoted := true;
    v_retail_price := v_event.early_bird_price_xcd_cents;
  else
    v_early_bird_quoted := false;
    v_retail_price := v_event.regular_price_xcd_cents;
  end if;

  insert into bikini_mix_bookings (
    checkout_idempotency_key, status, hold_expires_at, package, retail_price_xcd_cents,
    garment_type, bottom_scrunch,
    top_size, left_fabric_id, left_fabric_name_snapshot, left_fabric_hex_snapshot,
    right_fabric_id, right_fabric_name_snapshot, right_fabric_hex_snapshot,
    bottom_style, bottom_coverage, bottom_size,
    bottom_fabric_id, bottom_fabric_name_snapshot, bottom_fabric_hex_snapshot,
    onepiece_size, onepiece_coverage,
    onepiece_fabric_id, onepiece_fabric_name_snapshot, onepiece_fabric_hex_snapshot,
    full_name, email, whatsapp, marketing_opt_in, terms_accepted_at,
    early_bird_quoted, is_test
  ) values (
    p_checkout_idempotency_key, 'pending_payment', now() + (v_event.hold_minutes || ' minutes')::interval,
    'ticket', v_retail_price,
    p_garment_type, p_bottom_scrunch,
    p_top_size, p_left_fabric_id, p_left_fabric_name, p_left_fabric_hex,
    p_right_fabric_id, p_right_fabric_name, p_right_fabric_hex,
    p_bottom_style, p_bottom_coverage, p_bottom_size,
    p_bottom_fabric_id, p_bottom_fabric_name, p_bottom_fabric_hex,
    p_onepiece_size, p_onepiece_coverage,
    p_onepiece_fabric_id, p_onepiece_fabric_name, p_onepiece_fabric_hex,
    p_full_name, p_email, p_whatsapp, p_marketing_opt_in, p_terms_accepted_at,
    v_early_bird_quoted, true
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
  v_confirmed_eb_count integer;
  v_new_status text;
  v_early_bird_applied boolean;
  v_mismatch boolean;
begin
  select * into v_event from bikini_mix_event where id = 'default' for update;

  select * into v_booking from bikini_mix_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking % not found', p_booking_id using errcode = 'P0002';
  end if;

  if v_booking.status in ('confirmed', 'paid_needs_review') then
    return v_booking;
  end if;

  if v_booking.is_test then
    v_new_status := 'confirmed';
  else
    select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test and not is_complimentary;
    if v_confirmed_count < v_event.capacity then
      v_new_status := 'confirmed';
    else
      v_new_status := 'paid_needs_review';
    end if;
  end if;

  if v_booking.is_test then
    v_early_bird_applied := v_booking.early_bird_quoted;
    v_mismatch := false;
  elsif v_new_status = 'confirmed' and v_booking.early_bird_quoted then
    select count(*) into v_confirmed_eb_count from bikini_mix_bookings where status = 'confirmed' and not is_test and not is_complimentary and early_bird_applied;
    v_early_bird_applied := v_confirmed_eb_count < v_event.early_bird_slots;
    v_mismatch := not v_early_bird_applied;
  else
    v_early_bird_applied := false;
    v_mismatch := false;
  end if;

  update bikini_mix_bookings set
    status = v_new_status,
    go2pay_order_id = p_go2pay_order_id,
    payment_id = p_payment_id,
    paid_at = now(),
    early_bird_applied = v_early_bird_applied,
    early_bird_mismatch_at = case when v_mismatch then now() else early_bird_mismatch_at end,
    admin_notes = case
      when v_new_status = 'paid_needs_review' then
        coalesce(admin_notes || E'\n', '') ||
        'Payment verified after the hold expired, and the event was at capacity at that moment — needs manual resolution (confirm as an exception, or refund per the cancellation policy).'
      when v_mismatch then
        coalesce(admin_notes || E'\n', '') ||
        'Early Bird pricing (EC$225) was reserved at checkout, but the reservation had expired and all 3 Early Bird slots were already claimed by the time payment was verified. Customer was charged EC$225 — honored as a courtesy, no action needed.'
      else admin_notes
    end,
    updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ── 5. claim_bikini_mix_comp_booking() — the ONLY way a complimentary
--      booking is ever created. Entirely separate from the paid path;
--      never touches bikini_mix_event, never mints a Go2Pay request. ────
create or replace function claim_bikini_mix_comp_booking(
  p_checkout_idempotency_key uuid,
  p_code_hash text,
  p_garment_type text,
  p_top_size text,
  p_left_fabric_id uuid, p_left_fabric_name text, p_left_fabric_hex text,
  p_right_fabric_id uuid, p_right_fabric_name text, p_right_fabric_hex text,
  p_bottom_style text, p_bottom_coverage text, p_bottom_size text,
  p_bottom_fabric_id uuid, p_bottom_fabric_name text, p_bottom_fabric_hex text,
  p_bottom_scrunch boolean,
  p_onepiece_size text, p_onepiece_coverage text,
  p_onepiece_fabric_id uuid, p_onepiece_fabric_name text, p_onepiece_fabric_hex text,
  p_full_name text, p_email text, p_whatsapp text,
  p_marketing_opt_in boolean,
  p_terms_accepted_at timestamptz
) returns bikini_mix_bookings
language plpgsql
as $$
declare
  v_code bikini_mix_invitation_codes%rowtype;
  v_existing bikini_mix_bookings%rowtype;
  v_booking bikini_mix_bookings%rowtype;
begin
  -- Idempotent retry of the SAME browser session's own submission — keyed
  -- strictly by its own random UUID, never by the code. This can only ever
  -- return a booking the CALLER itself already created — and only if that
  -- booking actually belongs to THIS flow. Without the is_complimentary
  -- check, replaying a key that was first used against the PAID
  -- claim_bikini_mix_booking() would hand back that real (possibly still
  -- unpaid/pending) booking here, success/alreadyPaid, without ever
  -- validating a code — exactly the exploit this function must not allow.
  select * into v_existing from bikini_mix_bookings where checkout_idempotency_key = p_checkout_idempotency_key;
  if found then
    if not v_existing.is_complimentary then
      raise exception 'checkout id already used by a different booking flow' using errcode = '55000';
    end if;
    return v_existing;
  end if;

  -- Row-lock the CODE — serializes concurrent redemption attempts of the
  -- SAME code. Whoever acquires the lock second sees the first's already-
  -- applied status and is rejected; there is no window where two
  -- redemptions of one code can both succeed. A different code's lock is
  -- independent, so this never contends with (or is affected by) a
  -- concurrent paid checkout's bikini_mix_event lock.
  select * into v_code from bikini_mix_invitation_codes where code_hash = p_code_hash for update;
  if not found then
    raise exception 'invalid invitation code' using errcode = '22023';
  end if;
  if v_code.status <> 'active' then
    raise exception 'invitation code has already been used or is no longer valid' using errcode = '55000';
  end if;

  if p_garment_type not in ('bikini', 'onepiece') then
    raise exception 'invalid garment type "%"', p_garment_type using errcode = '22023';
  end if;

  if p_garment_type = 'bikini' then
    p_onepiece_size := null; p_onepiece_coverage := null;
    p_onepiece_fabric_id := null; p_onepiece_fabric_name := null; p_onepiece_fabric_hex := null;
  else
    p_top_size := null;
    p_left_fabric_id := null; p_left_fabric_name := null; p_left_fabric_hex := null;
    p_right_fabric_id := null; p_right_fabric_name := null; p_right_fabric_hex := null;
    p_bottom_style := null; p_bottom_coverage := null; p_bottom_size := null;
    p_bottom_fabric_id := null; p_bottom_fabric_name := null; p_bottom_fabric_hex := null;
    p_bottom_scrunch := false;
  end if;

  insert into bikini_mix_bookings (
    checkout_idempotency_key, status, package, retail_price_xcd_cents, charged_usd_cents,
    payment_provider, paid_at, is_complimentary, invitation_category, invitation_code_id,
    garment_type, bottom_scrunch,
    top_size, left_fabric_id, left_fabric_name_snapshot, left_fabric_hex_snapshot,
    right_fabric_id, right_fabric_name_snapshot, right_fabric_hex_snapshot,
    bottom_style, bottom_coverage, bottom_size,
    bottom_fabric_id, bottom_fabric_name_snapshot, bottom_fabric_hex_snapshot,
    onepiece_size, onepiece_coverage,
    onepiece_fabric_id, onepiece_fabric_name_snapshot, onepiece_fabric_hex_snapshot,
    full_name, email, whatsapp, marketing_opt_in, terms_accepted_at
  ) values (
    p_checkout_idempotency_key, 'confirmed', 'ticket', 0, null,
    'complimentary', now(), true, v_code.category, v_code.id,
    p_garment_type, p_bottom_scrunch,
    p_top_size, p_left_fabric_id, p_left_fabric_name, p_left_fabric_hex,
    p_right_fabric_id, p_right_fabric_name, p_right_fabric_hex,
    p_bottom_style, p_bottom_coverage, p_bottom_size,
    p_bottom_fabric_id, p_bottom_fabric_name, p_bottom_fabric_hex,
    p_onepiece_size, p_onepiece_coverage,
    p_onepiece_fabric_id, p_onepiece_fabric_name, p_onepiece_fabric_hex,
    p_full_name, p_email, p_whatsapp, p_marketing_opt_in, p_terms_accepted_at
  ) returning * into v_booking;

  update bikini_mix_invitation_codes
    set status = 'redeemed', redeemed_by_booking_id = v_booking.id, redeemed_at = now()
    where id = v_code.id;

  return v_booking;
end;
$$;

-- ── 6. lock down every function touched/added above, exactly like before ──
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'claim_bikini_mix_booking', 'claim_bikini_mix_booking_test',
        'confirm_bikini_mix_booking_payment', 'claim_bikini_mix_comp_booking'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
