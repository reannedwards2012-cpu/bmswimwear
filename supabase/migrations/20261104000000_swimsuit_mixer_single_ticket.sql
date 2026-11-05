-- ─────────────────────────────────────────────────────────────────────────
-- The Swimsuit Mixer — single ticket + early-bird reservation, one-piece
-- support, scrunch detail, customization gallery.
--
-- Plain SQL script for the Supabase SQL editor, NOT applied by this repo
-- automatically — same convention as every other migration here. Run this
-- whole file in one go; order matters (columns before the functions that
-- reference them).
--
-- NOTHING here deletes, truncates, or rewrites any existing row. Every new
-- column is additive; `garment_type`/`bottom_scrunch`'s NOT NULL DEFAULT
-- backfills every existing booking row automatically to 'bikini'/false —
-- exactly correct, since scrunch and one-piece didn't exist before this.
-- The two-branch CHECK constraint added near the bottom is satisfied by
-- every historical row without any data change.
--
-- ── Early-bird design (read this before touching the functions below) ──
-- The first `early_bird_slots` (3) tickets to be PAID get `early_bird_price
-- _xcd_cents` (EC$225); every other ticket gets `regular_price_xcd_cents`
-- (EC$250). This is a RESERVATION with an expiration, built on the exact
-- same mechanism already proven for event capacity in this table:
--
--   claim_bikini_mix_booking() locks the singleton bikini_mix_event row
--   `for update`, so every concurrent checkout is serialized through this
--   one lock. Under that lock, it counts bookings that are either already
--   `confirmed` with `early_bird_applied = true`, OR still-live
--   (`pending_payment` and `hold_expires_at > now()`) with
--   `early_bird_quoted = true`. If that count is below `early_bird_slots`,
--   this new booking is quoted/charged the early-bird price and flagged
--   `early_bird_quoted = true`; otherwise it gets the regular price.
--
--   An abandoned or never-completed checkout's reservation needs no
--   explicit "release" — it simply ages out of the `hold_expires_at > now()`
--   predicate the instant the clock passes, exactly like capacity holds
--   already do today. Zero new cron/expiry code.
--
--   confirm_bikini_mix_booking_payment() re-verifies at the moment payment
--   is confirmed: a booking that was quoted early-bird gets
--   `early_bird_applied = true` only if fewer than `early_bird_slots`
--   OTHER bookings are already `confirmed` with `early_bird_applied = true`
--   — mirroring exactly how the existing capacity check only compares
--   against other *confirmed* bookings, never competing holds. This can
--   only ever push a booking from "quoted" to "not applied", never the
--   reverse, and `early_bird_applied` can only become true for at most
--   `early_bird_slots` rows, ever, because every confirm passes through
--   this same lock one at a time.
--
--   The one case this can't fully prevent: a reservation that genuinely
--   EXPIRED (the customer was slow), during which someone else validly
--   reserved and paid for "the 3rd slot", and the original slow customer
--   then also completes payment (Go2Pay had already created their EC$225
--   payment request, so that charge is real and already collected). That
--   late payment gets `early_bird_applied = false` (so the public/admin
--   count of early-bird winners is always exactly accurate) and
--   `early_bird_mismatch_at` is set — `retail_price_xcd_cents`/
--   `charged_usd_cents` are NEVER rewritten retroactively; the note is
--   purely informational ("honored as a courtesy"), never an auto-reversal
--   or auto-recharge. See the project's implementation report for the
--   residual-risk writeup and a proposed stronger mitigation.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. bikini_mix_event — new ticket-pricing columns ────────────────────
alter table bikini_mix_event add column if not exists regular_price_xcd_cents integer not null default 25000 check (regular_price_xcd_cents >= 0); -- EC$250.00
alter table bikini_mix_event add column if not exists early_bird_price_xcd_cents integer not null default 22500 check (early_bird_price_xcd_cents >= 0); -- EC$225.00
alter table bikini_mix_event add column if not exists early_bird_slots integer not null default 3 check (early_bird_slots > 0);
-- Finalized inclusion list (confirmed by the client, incl. the 20-rhinestone
-- allowance). Still fully admin-editable any time via the event-settings UI.
alter table bikini_mix_event add column if not exists ticket_inclusions jsonb not null default '["Your choice of bikini or one-piece swimsuit","Straps included","Up to 6 premium beads","Up to 4 pony beads","1 premium charm","2 basic charms","1 iron-on decal","Up to 20 rhinestones","Wine","Finger foods"]'::jsonb;

-- Old classic_mix_price_xcd_cents / the_works_price_xcd_cents / their
-- inclusions columns are left in place, untouched — historical bookings
-- still reference real admin-set values there; new bookings simply never
-- read them again.

-- ── 2. bikini_mix_fabrics — one-piece eligibility ───────────────────────
-- Same pattern as the existing is_active flag on this same join table.
alter table bikini_mix_fabrics add column if not exists eligible_for_onepiece boolean not null default false;

-- Seed one-piece eligibility for the client's confirmed colour set. The
-- client gave 10 names; 9 matched an existing fabric's `name` exactly
-- (verified read-only against the live fabric inventory). "Blue" has no
-- exact match — the closest existing record is "Royal Blue", a different
-- name — so it is deliberately left unmarked here pending the client's
-- confirmation, rather than guessed. Only this junction table's new flag
-- is touched; no fabric is renamed, deleted, or created.
update bikini_mix_fabrics set eligible_for_onepiece = true
where fabric_id in (
  select id from fabrics where name in (
    'Black', 'White', 'Chocolate', 'Baby Blue', 'Coral', 'Hot Pink', 'Red', 'Yellow', 'Mosaic Lines'
  )
);

-- ── 3. bikini_mix_bookings — garment type, scrunch, one-piece fields,
--      early-bird tracking ──────────────────────────────────────────────
alter table bikini_mix_bookings add column if not exists garment_type text not null default 'bikini';
alter table bikini_mix_bookings add column if not exists bottom_scrunch boolean not null default false;
alter table bikini_mix_bookings add column if not exists onepiece_size text;
alter table bikini_mix_bookings add column if not exists onepiece_coverage text;
alter table bikini_mix_bookings add column if not exists onepiece_fabric_id uuid references fabrics(id) on delete set null;
alter table bikini_mix_bookings add column if not exists onepiece_fabric_name_snapshot text;
alter table bikini_mix_bookings add column if not exists onepiece_fabric_hex_snapshot text;
alter table bikini_mix_bookings add column if not exists early_bird_quoted boolean not null default false;   -- provisional, decided at claim/reservation time
alter table bikini_mix_bookings add column if not exists early_bird_applied boolean not null default false;  -- final truth, decided at confirm time
alter table bikini_mix_bookings add column if not exists early_bird_mismatch_at timestamptz;                 -- rare expired-reservation straggler (informational only)

-- Bikini-only fields are no longer universally required — a one-piece
-- booking has none of them. Relax to nullable, then add a two-branch CHECK
-- (mirrors the existing bikini_mix_bookings_personalization_required
-- pattern) so exactly one branch's fields are populated depending on
-- garment_type. Every existing row is 'bikini' with every bikini field
-- already populated and every onepiece_* field already null — branch one
-- is satisfied automatically, zero risk to live data.
alter table bikini_mix_bookings alter column top_size drop not null;
alter table bikini_mix_bookings alter column left_fabric_name_snapshot drop not null;
alter table bikini_mix_bookings alter column right_fabric_name_snapshot drop not null;
alter table bikini_mix_bookings alter column bottom_style drop not null;
alter table bikini_mix_bookings alter column bottom_coverage drop not null;
alter table bikini_mix_bookings alter column bottom_size drop not null;
alter table bikini_mix_bookings alter column bottom_fabric_name_snapshot drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bikini_mix_bookings_garment_type_check'
  ) then
    alter table bikini_mix_bookings add constraint bikini_mix_bookings_garment_type_check
      check (garment_type in ('bikini', 'onepiece'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bikini_mix_bookings_garment_fields_check'
  ) then
    alter table bikini_mix_bookings add constraint bikini_mix_bookings_garment_fields_check check (
      (garment_type = 'bikini'
        and top_size is not null and left_fabric_name_snapshot is not null and right_fabric_name_snapshot is not null
        and bottom_style is not null and bottom_coverage is not null and bottom_size is not null and bottom_fabric_name_snapshot is not null
        and onepiece_size is null and onepiece_coverage is null and onepiece_fabric_name_snapshot is null)
      or
      (garment_type = 'onepiece'
        and onepiece_size is not null and onepiece_coverage is not null and onepiece_fabric_name_snapshot is not null
        and top_size is null and bottom_style is null and bottom_coverage is null and bottom_size is null
        and left_fabric_name_snapshot is null and right_fabric_name_snapshot is null and bottom_fabric_name_snapshot is null)
    );
  end if;
end $$;

-- Widen the `package` check to admit the new single-ticket value, without
-- hand-guessing Postgres's auto-generated constraint name — look it up by
-- inspecting which CHECK constraint actually references the `package`
-- column, drop exactly that one, and add the new one in its place. A no-op
-- if already applied (idempotent re-run safe).
do $$
declare
  v_conname text;
begin
  select pg_constraint.conname into v_conname
  from pg_constraint
  join pg_class on pg_class.oid = pg_constraint.conrelid
  where pg_class.relname = 'bikini_mix_bookings'
    and pg_constraint.contype = 'c'
    and pg_get_constraintdef(pg_constraint.oid) ilike '%package%'
    and pg_get_constraintdef(pg_constraint.oid) ilike '%classic_mix%';

  if v_conname is not null then
    execute format('alter table bikini_mix_bookings drop constraint %I', v_conname);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bikini_mix_bookings_package_check') then
    alter table bikini_mix_bookings add constraint bikini_mix_bookings_package_check
      check (package in ('classic_mix', 'the_works', 'ticket'));
  end if;
end $$;

-- New bookings always insert package = 'ticket'. The existing
-- bikini_mix_bookings_personalization_required CHECK (package <>
-- 'the_works' or personalization_name is not null) is untouched —
-- 'ticket' rows are never required to have a personalization_name.

-- ── 4. bikini_mix_gallery_images — customization gallery ───────────────
create table if not exists bikini_mix_gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  category text not null check (category in ('strap', 'bead', 'charm', 'rhinestone', 'iron_on', 'finished_swimsuit')),
  included_in_ticket boolean not null default false,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table bikini_mix_gallery_images enable row level security; -- zero policies, same posture as every other table here

-- ── 5. claim_bikini_mix_booking() / claim_bikini_mix_booking_test() —
--      signature changed (package/price are no longer caller-supplied, and
--      new garment-type/scrunch/one-piece params are added), so the OLD
--      overloads are dropped by introspection first — CREATE OR REPLACE
--      cannot change a function's parameter list, it would just add a
--      second overload alongside the old one. ──────────────────────────
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_bikini_mix_booking', 'claim_bikini_mix_booking_test')
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

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

  -- Null out whichever branch's fields don't apply, so the two-branch
  -- CHECK constraint is always satisfied regardless of what the caller
  -- happened to pass for the inactive branch.
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

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now() and not is_test;

  if v_confirmed_count + v_held_count >= v_event.capacity then
    raise exception 'event is fully booked' using errcode = '55000';
  end if;

  -- Early-bird reservation — see the migration banner comment for the full design.
  select count(*) into v_early_bird_used
  from bikini_mix_bookings
  where not is_test and (
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
    early_bird_quoted
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
    v_early_bird_quoted
  ) returning * into v_booking;

  return v_booking;
end;
$$;

-- Admin-only test-booking mirror. Identical to claim_bikini_mix_booking()
-- except it bypasses ONLY is_bookings_open/booking_deadline and tags the
-- row is_test = true. Capacity AND early-bird reservation logic are byte-
-- for-byte the same real-count predicates (both already filter `not
-- is_test`), so a test booking is checked against — and never distorts —
-- the exact same real-world limits a genuine guest competes for.
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
    return v_existing;
  end if;

  select * into v_event from bikini_mix_event where id = 'default' for update;
  if not found then
    raise exception 'event configuration not found' using errcode = 'P0002';
  end if;

  -- is_bookings_open and booking_deadline are deliberately NOT checked here.

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

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now() and not is_test;

  if v_confirmed_count + v_held_count >= v_event.capacity then
    raise exception 'event is fully booked' using errcode = '55000';
  end if;

  select count(*) into v_early_bird_used
  from bikini_mix_bookings
  where not is_test and (
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

-- ── 6. confirm_bikini_mix_booking_payment() — same signature, new body ──
-- CREATE OR REPLACE is fine here (parameter list unchanged).
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

  -- Idempotent: a repeat callback for an already-resolved booking is a no-op.
  if v_booking.status in ('confirmed', 'paid_needs_review') then
    return v_booking;
  end if;

  if v_booking.is_test then
    -- Never gated by real capacity — already excluded from every real
    -- capacity count, so free to always confirm (unchanged from
    -- 20261022000000_bikini_mix_test_booking_always_confirms.sql).
    v_new_status := 'confirmed';
  else
    select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed' and not is_test;
    if v_confirmed_count < v_event.capacity then
      v_new_status := 'confirmed';
    else
      v_new_status := 'paid_needs_review';
    end if;
  end if;

  -- Early-bird final decision — see the migration banner comment. Can only
  -- ever move a booking from "quoted" to "not applied", never the reverse,
  -- and at most early_bird_slots rows can ever read early_bird_applied =
  -- true across the whole event, because every confirm passes through this
  -- same bikini_mix_event lock one at a time.
  if v_booking.is_test then
    v_early_bird_applied := v_booking.early_bird_quoted;
    v_mismatch := false;
  elsif v_new_status = 'confirmed' and v_booking.early_bird_quoted then
    select count(*) into v_confirmed_eb_count from bikini_mix_bookings where status = 'confirmed' and not is_test and early_bird_applied;
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

-- ── 7. lock down the (re-created) functions exactly like before ────────
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_bikini_mix_booking', 'claim_bikini_mix_booking_test', 'confirm_bikini_mix_booking_payment')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- No new Storage bucket needed — the customization gallery reuses the
-- already-provisioned 'bikini-mix-media' bucket (new 'gallery/' prefix),
-- same bucket the promo video already uses. Nothing to create by hand.
-- ─────────────────────────────────────────────────────────────────────────
