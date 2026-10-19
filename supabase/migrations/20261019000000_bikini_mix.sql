-- ─────────────────────────────────────────────────────────────────────────
-- Bikini Mix — Stage 1 (event config, fabric availability, bookings, admin
-- backend). Same convention as supabase/migrations/20260911120000_stockists.sql:
-- a plain SQL script for the Supabase SQL editor, NOT applied by this repo
-- automatically. Nothing here touches any existing table.
--
-- Run this whole file in one go — order matters (tables, then the two
-- functions that reference them).
-- ─────────────────────────────────────────────────────────────────────────

-- ── bikini_mix_event ───────────────────────────────────────────────────
-- Deliberately a singleton: exactly one row, fixed id 'default'. Everything
-- here is admin-editable (PATCH only — the row itself is never deleted,
-- never duplicated). Package pricing/inclusions live here too rather than a
-- generic "packages" table, since the brief fixes these at exactly two,
-- named ('classic_mix', 'the_works') — a lookup table would be unused
-- flexibility for two rows that will never become three.
create table if not exists bikini_mix_event (
  id text primary key default 'default',

  event_name text not null default 'The Bikini Mixer by Bahama Mama',
  event_date date,
  event_date_is_tentative boolean not null default true,
  venue text,
  venue_is_confirmed boolean not null default true,
  booking_deadline date,
  cancellation_deadline date,

  -- Private — never sent to the public API. The storefront only ever gets
  -- "very limited spots available" / "fully booked", never this number or a
  -- remaining count (brief section 7).
  capacity integer not null default 12 check (capacity > 0),

  -- Manual kill-switch, independent of capacity/deadline — lets the admin
  -- close bookings immediately without changing the deadline or capacity.
  is_bookings_open boolean not null default false,

  promo_video_url text,

  classic_mix_price_xcd_cents integer not null default 16000 check (classic_mix_price_xcd_cents >= 0), -- EC$160.00
  classic_mix_inclusions jsonb not null default '["1 triangle bikini top","1 bikini bottom","Up to 4 straps","1 standard charm","6 beads","1 iron-on transfer","Access to The Bikini Mix experience"]'::jsonb,

  the_works_price_xcd_cents integer not null default 20000 check (the_works_price_xcd_cents >= 0), -- EC$200.00
  the_works_inclusions jsonb not null default '["1 triangle bikini top","1 bikini bottom","Up to 4 straps","2 standard charms","1 premium charm","12 beads","3 iron-on transfers","Up to 50 rhinestones","Personalized packaging (name on bag and personalized trinket)","Access to The Bikini Mix experience"]'::jsonb,

  -- How long a booking holds its capacity slot while the customer is on
  -- Step 5 / in the Go2Pay flow before it's released back.
  hold_minutes integer not null default 15 check (hold_minutes > 0),

  -- Size guide — structure only for the top (bust/underbust left BLANK on
  -- purpose: no cup/bust numbers are invented here — admin fills these in
  -- via pages/admin/bikini-mix/index.vue; the live booking page must not
  -- launch until they're complete — enforced at the application layer
  -- (server/utils/bikiniMixMappers.js `sizeGuideComplete`), not by a DB
  -- constraint, since "complete" only matters once, at launch, not on
  -- every write). The bottom guide IS seeded with real approved waist/hip
  -- measurements (inches) — still fully admin-editable, not a constant.
  top_size_guide jsonb not null default '[
    {"size":"XS","bust":"","underbust":""},
    {"size":"S","bust":"","underbust":""},
    {"size":"M","bust":"","underbust":""},
    {"size":"L","bust":"","underbust":""},
    {"size":"XL","bust":"","underbust":""}
  ]'::jsonb,
  bottom_size_guide jsonb not null default '[
    {"size":"XS","waist":"24–26","hip":"34–36"},
    {"size":"S","waist":"26–28","hip":"36–38"},
    {"size":"M","waist":"28–30","hip":"38–40"},
    {"size":"L","waist":"30–32","hip":"40–42"},
    {"size":"XL","waist":"32–34","hip":"42–44"}
  ]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into bikini_mix_event (id) values ('default') on conflict (id) do nothing;

-- ── bikini_mix_fabrics ──────────────────────────────────────────────────
-- Which existing fabrics are offered for this event — mirrors the
-- `product_fabrics` join-table pattern exactly. No fabric data is
-- duplicated; this is existence + an is_active flag only.
create table if not exists bikini_mix_fabrics (
  id uuid primary key default gen_random_uuid(),
  fabric_id uuid not null references fabrics(id) on delete cascade,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (fabric_id)
);

create index if not exists idx_bikini_mix_fabrics_fabric on bikini_mix_fabrics(fabric_id);

-- ── bikini_mix_bookings ─────────────────────────────────────────────────
-- One row per booking. Every bikini selection is captured here with BOTH
-- a live fabric_id (nullable — ON DELETE SET NULL, so a later fabric
-- deletion never breaks this row) AND a name/hex snapshot (NOT NULL — so
-- the booking stays fully readable even if that happens), same principle
-- as stockist_inventory_items.
create table if not exists bikini_mix_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number integer generated by default as identity,

  -- 'pending_payment' = hold created, awaiting Go2Pay
  -- 'confirmed'       = paid AND counted as a real guest (capacity + production)
  -- 'paid_needs_review' = payment verified, but the event was at capacity
  --                       by the time it was verified (see confirm_bikini_mix_booking_payment
  --                       below) — a REAL distinction from 'confirmed': paid_at
  --                       being non-null means the payment is real and verified;
  --                       status = 'confirmed' is the separate, independent fact
  --                       of whether that payment currently holds a reserved spot.
  --                       Never counted toward capacity or the production summary
  --                       until an admin resolves it.
  -- 'expired'         = hold's time passed, never paid — never consumed a slot
  -- 'cancelled'       = customer/admin cancelled per the refund policy
  status text not null default 'pending_payment' check (
    status in ('pending_payment', 'confirmed', 'paid_needs_review', 'expired', 'cancelled')
  ),
  hold_expires_at timestamptz, -- only meaningful while status = 'pending_payment'

  package text not null check (package in ('classic_mix', 'the_works')),
  -- EC$ price snapshotted from bikini_mix_event at booking time — the admin
  -- may change prices later without altering historical bookings.
  retail_price_xcd_cents integer not null check (retail_price_xcd_cents >= 0),
  -- The exact USD amount actually charged via Go2Pay (US$1 = EC$2.70,
  -- computed server-side from retail_price_xcd_cents — never trusted from
  -- the client). Set once the payment request is created.
  charged_usd_cents integer check (charged_usd_cents is null or charged_usd_cents >= 0),

  top_size text not null check (top_size in ('XS', 'S', 'M', 'L', 'XL')),

  left_fabric_id uuid references fabrics(id) on delete set null,
  left_fabric_name_snapshot text not null,
  left_fabric_hex_snapshot text,

  right_fabric_id uuid references fabrics(id) on delete set null,
  right_fabric_name_snapshot text not null,
  right_fabric_hex_snapshot text,

  bottom_style text not null check (bottom_style in ('tie-side', 'classic')),
  bottom_coverage text not null check (bottom_coverage in ('bikini', 'cheeky')),
  bottom_size text not null check (bottom_size in ('XS', 'S', 'M', 'L', 'XL')),
  bottom_fabric_id uuid references fabrics(id) on delete set null,
  bottom_fabric_name_snapshot text not null,
  bottom_fabric_hex_snapshot text,

  full_name text not null,
  email text not null,
  whatsapp text not null,
  -- Required only when package = 'the_works' — enforced below AND at the
  -- validation layer.
  personalization_name text,

  -- Explicit opt-in only — never set true by anything other than the
  -- customer's own checkbox, same principle as orders.marketing_opt_in.
  marketing_opt_in boolean not null default false,
  terms_accepted_at timestamptz not null,

  payment_provider text default 'go2pay',
  go2pay_request_id text,
  go2pay_payment_url text,
  go2pay_order_id text,
  payment_id text,
  paid_at timestamptz,

  -- Client-held, used both for idempotent retry (same shape as
  -- orders.checkout_idempotency_key) and for gating the confirmation page
  -- (GET .../status returns {paid:boolean} only, keyed by this — a booking
  -- is never reachable by guessing booking_number).
  checkout_idempotency_key uuid not null unique,
  -- Server-generated, embedded only in the Go2Pay callback URL, never sent
  -- to the browser — same shape as orders.payment_callback_token.
  payment_callback_token uuid not null default gen_random_uuid() unique,

  -- Free text for the 'paid_needs_review' case and any other admin
  -- resolution note.
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bikini_mix_bookings_personalization_required check (
    package <> 'the_works' or personalization_name is not null
  )
);

create index if not exists idx_bikini_mix_bookings_status on bikini_mix_bookings(status);
create index if not exists idx_bikini_mix_bookings_hold_expires on bikini_mix_bookings(hold_expires_at) where status = 'pending_payment';
create index if not exists idx_bikini_mix_bookings_left_fabric on bikini_mix_bookings(left_fabric_id);
create index if not exists idx_bikini_mix_bookings_right_fabric on bikini_mix_bookings(right_fabric_id);
create index if not exists idx_bikini_mix_bookings_bottom_fabric on bikini_mix_bookings(bottom_fabric_id);

-- RLS enabled, no public policies — same posture as every other table here.
alter table bikini_mix_event enable row level security;
alter table bikini_mix_fabrics enable row level security;
alter table bikini_mix_bookings enable row level security;

-- ── claim_bikini_mix_booking(): the ONLY way a booking/hold is created ──
--
-- Concurrency safety: locks the single bikini_mix_event row for the
-- duration of the transaction, so two customers racing for the last slot
-- are serialized through this lock — the second call's count() always sees
-- the first call's just-inserted row (or its abort), never a stale read.
-- Idempotent on checkout_idempotency_key: a network retry from the same
-- browser session returns the existing row rather than double-booking or
-- erroring.
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

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed';
  select count(*) into v_held_count from bikini_mix_bookings where status = 'pending_payment' and hold_expires_at > now();

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

-- ── confirm_bikini_mix_booking_payment(): the ONLY way a booking becomes
-- 'confirmed' or 'paid_needs_review' ──
--
-- Called from the Go2Pay callback handler AFTER it has independently
-- verified the payment against Go2Pay's API (that verification cannot live
-- in SQL — it's an external HTTPS call). This function's only job is the
-- atomic part: decide, under the SAME event-row lock claim uses, whether
-- this payment currently has a reserved spot.
--
-- This is deliberately the one place "a successful payment" and "a
-- confirmed reservation" are allowed to diverge: paid_at is set
-- unconditionally (the payment is real and verified, full stop); status
-- only becomes 'confirmed' if there's still room for it. If the hold
-- expired and the event filled up in the meantime, status becomes
-- 'paid_needs_review' instead — excluded from every capacity/production
-- count until an admin resolves it by hand.
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

  select count(*) into v_confirmed_count from bikini_mix_bookings where status = 'confirmed';

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

-- ── lock down who may call the two functions above ──────────────────────
--
-- Neither function is declared SECURITY DEFINER, so each already runs AS
-- the calling role (the Postgres default, "SECURITY INVOKER") — meaning
-- even if something could call them as `anon`, every INSERT/UPDATE/SELECT
-- inside them would still be blocked by RLS-with-no-policies on
-- bikini_mix_bookings / bikini_mix_event, the same deny-everyone-but-
-- service_role posture as every other table in this project (see
-- server/utils/supabaseAdmin.js). So this isn't closing a hole that's
-- otherwise open to writes — it's removing a redundant layer: by default,
-- a newly created Postgres function grants EXECUTE to PUBLIC (which `anon`
-- and `authenticated` are implicitly members of), so right now the
-- function CALL itself would be permitted even though it could never
-- actually read or write anything. Explicitly revoking that means the
-- security story for these two functions doesn't depend on "RLS always
-- correctly blocks it" remaining true forever — e.g. if either function
-- were ever changed to SECURITY DEFINER later (which WOULD bypass RLS),
-- this REVOKE is what stops it from being publicly callable at all.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_bikini_mix_booking', 'confirm_bikini_mix_booking_payment')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Supabase Storage: promo video (optional, admin-uploaded). Same
-- hand-created-bucket pattern as 'product-images' / 'fabric-images' /
-- 'stockist-item-images':
--
--   Storage → New bucket → name: bikini-mix-media → Public bucket: ON
--
-- No bucket policy SQL required — all writes go through supabaseAdmin()
-- (service role), which bypasses Storage RLS.
-- ─────────────────────────────────────────────────────────────────────────
