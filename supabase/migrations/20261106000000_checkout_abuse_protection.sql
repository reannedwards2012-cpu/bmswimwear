-- Phase 1 security hardening: abuse protection for the three public
-- checkout/booking endpoints (server/api/checkout.post.js,
-- server/api/bikini-mix/checkout.post.js, server/api/checkout/quote.post.js).
--
-- 1. `checkout_rate_hits` — a generic, scope-tagged sibling of the existing
--    `inquiry_rate_hits` table (same shape, same philosophy: hashed-IP only,
--    never a raw IP, never a raw user-agent). Kept entirely separate from
--    `inquiry_rate_hits` so this work can never regress the already-shipped
--    Inquiries rate limiter. The `scope` column lets multiple endpoints share
--    one table without their counts ever mixing (`checkout`, `bikini-mix-checkout`,
--    `checkout-quote`).
--
-- 2. `bikini_mix_bookings.client_ip_hash` — a nullable column, written
--    atomically by claim_bikini_mix_booking() itself (see the redefinition
--    below), that stops a single source from indefinitely occupying the 3
--    Early Bird slots.
--
--    Revision history for this specific protection:
--      v1 (first Phase 1 pass) checked this in APPLICATION CODE, before
--      calling the RPC — a classic check-then-act race: several concurrent
--      requests from the same IP could all read "0 live holds" before any
--      of them committed, each going on to successfully claim a different
--      slot. v2 (this version) moves the check INSIDE the RPC, under the
--      SAME `bikini_mix_event` row lock that already serializes the global
--      3-slot decision — every claim is now fully serialized through one
--      lock, so there is no window for a second concurrent request to read
--      stale state. `client_ip_hash` is written in the SAME insert that
--      decides the price, atomically, by the function itself.
--
--    Exceeding the per-IP cap never REJECTS a booking — exactly like the
--    existing global cap, it just downgrades this one claim to the regular
--    price (the frontend's existing "Guarantee 2" flow already asks the
--    customer to confirm before paying more than they expected, so this
--    needed no new UI work). Skipped entirely when no IP hash is supplied
--    (fails open, same posture as every other abuse check in this
--    codebase). The new `p_client_ip_hash` parameter has a `default null`,
--    so the CURRENTLY DEPLOYED application — which calls this RPC without
--    that parameter at all — keeps working completely unchanged once this
--    migration is applied, simply never engaging the new check (identical
--    behaviour to before this migration, for old code). Capacity, the
--    global early-bird count, pricing resolution for every other case,
--    idempotency (the very first check in the function body, unchanged),
--    and confirm_bikini_mix_booking_payment() are completely untouched.

create table if not exists checkout_rate_hits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkout_rate_hits_scope_key_created
  on checkout_rate_hits (scope, key_hash, created_at);

alter table checkout_rate_hits enable row level security; -- zero policies, same posture as every other table here

alter table bikini_mix_bookings add column if not exists client_ip_hash text;

create index if not exists idx_bikini_mix_bookings_ip_early_bird_hold
  on bikini_mix_bookings (client_ip_hash, status, early_bird_quoted, hold_expires_at);

-- IMPORTANT: Postgres resolves `create or replace function` by the exact
-- parameter list, not by name — adding a new trailing parameter (even one
-- with a `default`) does NOT replace the existing 26-parameter function,
-- it creates a SECOND overload alongside it. With both present, a call
-- using the old (currently deployed) 26-argument list becomes genuinely
-- ambiguous to Postgres, since it can match either the old function
-- exactly or the new one by letting its trailing parameter default —
-- confirmed locally: calling with the old argument list raised
-- "function claim_bikini_mix_booking(...) is not unique" once both
-- overloads existed. The explicit DROP below removes the old 26-parameter
-- signature first, so exactly one version of this function ever exists —
-- which is what actually makes the new parameter's `default null` behave
-- as backward-compatible, rather than merely appearing to on paper.
drop function if exists claim_bikini_mix_booking(
  uuid, text, text,
  uuid, text, text,
  uuid, text, text,
  text, text, text,
  uuid, text, text,
  boolean,
  text, text,
  uuid, text, text,
  text, text, text,
  boolean,
  timestamptz
);

-- Redefinition of claim_bikini_mix_booking() — identical to the version in
-- 20261104000000_swimsuit_mixer_single_ticket.sql except:
--   1. a new trailing `p_client_ip_hash text default null` parameter
--      (default => backward-compatible with the currently deployed app,
--      which doesn't pass it at all);
--   2. the per-IP guard block, inserted after the existing global
--      early-bird decision and before the INSERT — see the banner comment
--      above for the full design and why this closes the v1 race;
--   3. `client_ip_hash` added to the INSERT's column/value list.
-- Everything else — the idempotency short-circuit, the bookings-open /
-- deadline checks, the garment-type field nulling, the capacity check, the
-- global early-bird slot count, and the returned row shape — is
-- byte-for-byte unchanged.
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

  -- Per-IP Early Bird slot-exhaustion guard (Phase 1 security hardening,
  -- v2 — see the banner comment at the top of this migration for why this
  -- lives here now instead of in application code). Evaluated under the
  -- SAME bikini_mix_event row lock as the global decision just above, so
  -- concurrent claims from one IP are fully serialized through this check
  -- — no race window, regardless of how many requests arrive at once.
  -- Never rejects the booking: exactly like the global cap above,
  -- exceeding the per-IP cap simply downgrades this claim to the regular
  -- price. Skipped entirely when no IP hash is supplied (fails open).
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

-- The DROP + CREATE above produces a brand-new function object, which gets
-- Postgres's default privileges (EXECUTE granted to PUBLIC) — NOT the
-- lock-down every prior migration touching this function explicitly
-- applies (see 20261104000000_swimsuit_mixer_single_ticket.sql, "lock down
-- the (re-created) functions exactly like before"). Re-applying the exact
-- same pattern here: only service_role (the server, via supabaseAdmin())
-- may call this RPC — anon/authenticated must never be able to call it
-- directly over PostgREST, which would bypass every app-level abuse check
-- (rate limit, honeypot, Turnstile) that only guards the HTTP endpoint.
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
