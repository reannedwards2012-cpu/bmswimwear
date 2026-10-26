-- ─────────────────────────────────────────────────────────────────────────
-- Custom Quote Calculator & Quote Management
--
-- Like every other migration in this project, this is a plain SQL script
-- meant to be run by hand in the Supabase SQL editor — not auto-applied by
-- this repo or any CI step.
--
-- Three pieces:
--   1. quote_pricing_settings — a single editable settings row (same
--      singleton pattern as bikini_mix_event): hourly rate, default fabric
--      costs/consumption, overhead, design fees, target margin, deposit %,
--      category minimums. Admin-editable defaults, never customer-facing.
--   2. quotes — one row per custom quote. Status/customer/category/price
--      are real columns (for search, filter, and sort in the admin list);
--      the full calculator input+output breakdown is captured as a single
--      JSONB snapshot (`calculation`) at save time, so a historical quote
--      stays accurate and reproducible even after quote_pricing_settings
--      changes later — the same "snapshot the numbers that mattered at
--      the time" principle already used for bikini_mix_bookings'
--      *_fabric_name_snapshot columns.
--   3. fabrics.unit_cost_xcd_cents — the fabrics table has NO cost field
--      of any kind today (confirmed by inspection — it's a hand-created
--      table with no cost/price column). This adds one, nullable, so an
--      admin can optionally record a fabric's real landed cost (CIF —
--      "landed" = including shipping and import charges, which nothing
--      in the current schema assumes is already baked into any existing
--      value, because there is no existing value) for the quote
--      calculator to pull from automatically. Unset by default; the
--      calculator falls back to the solid/printed default rate from
--      quote_pricing_settings whenever a selected fabric has none.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Pricing settings (singleton row) ─────────────────────────────────
create table if not exists quote_pricing_settings (
  id text primary key default 'default',

  labour_rate_xcd_cents integer not null default 4000 check (labour_rate_xcd_cents >= 0), -- EC$40/hr

  -- Default production hours by category. "Other/Custom" has no default —
  -- hours are always manually entered for that category, and remain
  -- editable for every other category too (never locked to the default).
  default_hours_basic_bikini numeric not null default 2 check (default_hours_basic_bikini >= 0),
  default_hours_basic_onepiece numeric not null default 2 check (default_hours_basic_onepiece >= 0),
  default_hours_complex_custom numeric not null default 5 check (default_hours_complex_custom >= 0),

  -- Default landed fabric cost per yard. "Custom fabric" has no default —
  -- always manually entered.
  fabric_cost_solid_xcd_cents integer not null default 7000 check (fabric_cost_solid_xcd_cents >= 0), -- EC$70/yd
  fabric_cost_printed_xcd_cents integer not null default 8000 check (fabric_cost_printed_xcd_cents >= 0), -- EC$80/yd

  -- Default fabric consumption (yards, including lining). Complex/Other
  -- has no default — always manually entered.
  fabric_consumption_bikini_yards numeric not null default 0.5 check (fabric_consumption_bikini_yards >= 0),
  fabric_consumption_onepiece_yards numeric not null default 1 check (fabric_consumption_onepiece_yards >= 0),

  packaging_xcd_cents integer not null default 500 check (packaging_xcd_cents >= 0), -- EC$5/swimsuit
  consumables_xcd_cents integer not null default 500 check (consumables_xcd_cents >= 0), -- EC$5/swimsuit, thread/elastic/etc

  -- Fixed monthly overhead, allocated across expected_monthly_volume.
  -- machine_maintenance is stored as its already-monthly-equivalent figure
  -- (EC$150 every 3 months = EC$50/month), matching how the brief itself
  -- expresses it — no quarterly-amount column exists to avoid a second,
  -- redundant "divide by 3" step.
  electricity_monthly_xcd_cents integer not null default 5000 check (electricity_monthly_xcd_cents >= 0), -- EC$50/mo
  machine_maintenance_monthly_xcd_cents integer not null default 5000 check (machine_maintenance_monthly_xcd_cents >= 0), -- EC$50/mo
  -- No default volume was specified in the brief; 20 units/month is a
  -- reasonable, clearly-editable starting point for a small custom
  -- swimwear operation — never silently assumed elsewhere in the app.
  expected_monthly_volume integer not null default 20 check (expected_monthly_volume > 0),

  -- Design development flat-fee tiers. "No design development" (EC$0) and
  -- "Custom amount" need no stored default — they're 0 and manual-entry
  -- respectively, handled entirely at the application layer.
  design_fee_minor_xcd_cents integer not null default 4000 check (design_fee_minor_xcd_cents >= 0), -- EC$40
  design_fee_new_xcd_cents integer not null default 7500 check (design_fee_new_xcd_cents >= 0), -- EC$75
  design_fee_complex_xcd_cents integer not null default 12000 check (design_fee_complex_xcd_cents >= 0), -- EC$120

  -- No default was specified in the brief for fitting allowance; EC$0 is
  -- the safe, non-assuming default — always shown and always editable.
  fitting_allowance_xcd_cents integer not null default 0 check (fitting_allowance_xcd_cents >= 0),

  target_margin_percent numeric not null default 30 check (target_margin_percent >= 0 and target_margin_percent < 100),
  deposit_percent numeric not null default 50 check (deposit_percent >= 0 and deposit_percent <= 100),

  -- Configurable minimum selling prices by category. "Other/Custom" has
  -- no default minimum (nullable, left null) — per the brief.
  min_price_basic_bikini_xcd_cents integer check (min_price_basic_bikini_xcd_cents is null or min_price_basic_bikini_xcd_cents >= 0) default 18000, -- EC$180
  min_price_basic_onepiece_xcd_cents integer check (min_price_basic_onepiece_xcd_cents is null or min_price_basic_onepiece_xcd_cents >= 0) default 22000, -- EC$220
  min_price_complex_custom_xcd_cents integer check (min_price_complex_custom_xcd_cents is null or min_price_complex_custom_xcd_cents >= 0) default 30000, -- EC$300
  min_price_other_custom_xcd_cents integer check (min_price_other_custom_xcd_cents is null or min_price_other_custom_xcd_cents >= 0), -- no default

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into quote_pricing_settings (id) values ('default') on conflict (id) do nothing;

-- ── 2. Quotes ────────────────────────────────────────────────────────────
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number integer generated by default as identity,

  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),

  -- Inline customer fields — same convention as orders/bikini_mix_bookings
  -- in this project (no separate customers table exists anywhere).
  customer_name text not null,
  customer_email text,
  customer_phone text,

  description text, -- requested swimsuit description
  category text not null check (category in ('basic_bikini', 'basic_onepiece', 'complex_custom', 'other_custom')),

  inspiration_image_urls jsonb not null default '[]'::jsonb,

  -- The complete calculator snapshot for this quote — every input (hours,
  -- rates, fabric cost/yards, materials, packaging, consumables, overhead
  -- inputs, design fee/hours/billable flag, margin %, deposit %, fitting
  -- allowance) and every computed output (estimated cost, suggested
  -- price, category minimum applied, final price, profit, actual margin,
  -- deposit amount, remaining balance) as it stood at save time. This is
  -- what keeps a historical quote's numbers accurate and reproducible
  -- even after quote_pricing_settings' defaults change later — the
  -- settings table only ever supplies defaults for a NEW quote, never a
  -- live reference an old quote depends on.
  calculation jsonb not null,

  -- Denormalized out of `calculation` purely so the admin list can sort/
  -- filter/display price without parsing JSON per row.
  final_price_xcd_cents integer not null check (final_price_xcd_cents >= 0),

  -- Customer-facing notes (safe to show on the customer summary) are a
  -- separate column from admin_notes (private, internal-only) — never
  -- the same field, so a customer-summary view can never accidentally
  -- leak an internal note.
  customer_notes text,
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_status on quotes(status);
create index if not exists idx_quotes_category on quotes(category);
create index if not exists idx_quotes_created_at on quotes(created_at desc);

-- ── 3. Fabric landed cost (nullable — never assumes an existing value) ──
alter table fabrics add column if not exists unit_cost_xcd_cents integer check (unit_cost_xcd_cents is null or unit_cost_xcd_cents >= 0);

-- ── RLS: deny-everyone-but-service_role, same uniform posture as every
-- other table in this project. Only server/utils/supabaseAdmin.js's
-- service-role client (used exclusively by the admin-gated API routes
-- above) can read/write these tables — no policies are created, so RLS
-- blocks every other role by default. ──
alter table quote_pricing_settings enable row level security;
alter table quotes enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- Manual setup step (not expressible in SQL, same as every other Storage
-- bucket in this project — fabric-images, product-images, stockist-item-
-- images, bikini-mix-media): before the inspiration-image upload endpoint
-- will work, create a bucket by hand —
--   Supabase dashboard → Storage → New bucket → name: quote-inspiration-images
--   → Public bucket: ON
-- No bucket policy SQL required — all writes go through supabaseAdmin()
-- (service role), which bypasses Storage RLS.
-- ─────────────────────────────────────────────────────────────────────────
