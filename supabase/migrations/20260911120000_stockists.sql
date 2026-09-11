-- ─────────────────────────────────────────────────────────────────────────
-- Stockists / Boutique Inventory (V1)
--
-- This repo has no prior migrations directory / Supabase CLI project checked
-- in — the existing schema lives directly in Supabase. This file is a plain
-- SQL script for you to run once in the Supabase SQL editor (or `psql`). It
-- has NOT been executed against your database. Nothing here touches any
-- existing table.
--
-- Run this whole file in one go — order matters (tables, then the RPC
-- function that references them).
-- ─────────────────────────────────────────────────────────────────────────

-- ── stockists ───────────────────────────────────────────────────────────
create table if not exists stockists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  contact_name text,
  phone text,
  email text,
  -- Commission stored in basis points (1/100 of a percent), the same
  -- "integer, no floats" spirit as the app's existing *_cents money columns.
  -- 1500 = 15.00%. NULL = no default set yet.
  default_commission_bps integer check (default_commission_bps is null or default_commission_bps between 0 and 10000),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column stockists.default_commission_bps is 'Basis points, e.g. 1500 = 15.00%. Used only as the pre-filled default when adding inventory/recording a sale — never read back at sale time (each item and each sale snapshots its own commission).';

-- ── stockist_inventory_items ────────────────────────────────────────────
-- One row per distinct variant at one stockist (e.g. Mimosa / Black / M /
-- Cheeky at The Closet). Quantities (remaining_quantity, total_*_quantity)
-- are NOT the source of truth — the stockist_inventory_movements audit trail
-- is. These columns are a cache of it, kept in lockstep ONLY by
-- record_stockist_movement() below (an UPDATE runs nowhere else against
-- them). A brand-new item's row is inserted here with them at their column
-- defaults (0) by create_stockist_inventory_item() further down, which then
-- immediately calls record_stockist_movement() itself, in the same
-- transaction, for the item's initial SENT quantity — application code never
-- UPDATEs these columns directly, on creation or afterwards.
create table if not exists stockist_inventory_items (
  id uuid primary key default gen_random_uuid(),
  stockist_id uuid not null references stockists(id) on delete restrict,

  source text not null check (source in ('product', 'manual')),

  -- Website-catalogue items only. ON DELETE SET NULL (not CASCADE): if the
  -- catalogue product is later deleted, this boutique record must not
  -- disappear or lose meaning — product_name_snapshot / product_image_snapshot
  -- below keep it readable regardless of what happens to the live product.
  product_id uuid references products(id) on delete set null,

  -- Captured at add-time for BOTH kinds of item (the product's current name/
  -- image for a website product; the entered name/uploaded image for a
  -- manual item). This is what every list/detail view displays — never a
  -- live join to `products` — so renaming or deleting the catalogue product
  -- never changes historical boutique records.
  product_name_snapshot text not null,
  product_image_snapshot text,

  -- Manual items only: an optional reference/style number the business uses.
  reference_code text,

  colour text,
  size text,
  coverage text,

  retail_price_cents integer not null check (retail_price_cents >= 0),
  currency text not null default 'XCD',

  -- Snapshot of the commission this item was added under (defaults from the
  -- stockist's default_commission_bps at add-time, editable per item).
  -- This is only the PRE-FILL for future "Mark Sold" actions on this item —
  -- each actual sale snapshots its own commission on the movement row
  -- (sale_commission_bps below) and is never affected by later edits here.
  default_commission_bps integer not null check (default_commission_bps between 0 and 10000),

  notes text,

  -- ── maintained by record_stockist_movement() only ──
  remaining_quantity integer not null default 0 check (remaining_quantity >= 0),
  total_supplied_quantity integer not null default 0 check (total_supplied_quantity >= 0), -- sent + restocked
  total_sold_quantity integer not null default 0 check (total_sold_quantity >= 0),
  total_returned_quantity integer not null default 0 check (total_returned_quantity >= 0),
  total_removed_quantity integer not null default 0 check (total_removed_quantity >= 0),
  first_sent_at date,

  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stockist_inventory_items_product_fields check (
    (source = 'product' and product_id is not null) or
    (source = 'manual' and product_id is null)
  )
);

create index if not exists idx_stockist_inventory_items_stockist on stockist_inventory_items(stockist_id);
create index if not exists idx_stockist_inventory_items_product on stockist_inventory_items(product_id);

-- ── stockist_inventory_movements ────────────────────────────────────────
-- The audit trail. Durable — rows are never updated or deleted by the app.
-- `stockist_id` is denormalized from the item for cheap per-stockist queries
-- (and cross-stockist insight queries) without joining through the item.
create table if not exists stockist_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  stockist_id uuid not null references stockists(id) on delete restrict,
  item_id uuid not null references stockist_inventory_items(id) on delete restrict,

  movement_type text not null check (movement_type in ('sent', 'restock', 'sold', 'returned', 'removed')),
  quantity integer not null check (quantity > 0),
  occurred_on date not null default current_date,
  note text,

  -- SOLD only — the price/commission actually applied to THIS sale,
  -- preserved forever regardless of later changes to the item's retail price
  -- or the stockist's default commission. This is what "Bahama Mama
  -- proceeds" is calculated from, never a live lookup.
  sale_unit_price_cents integer check (sale_unit_price_cents is null or sale_unit_price_cents >= 0),
  sale_commission_bps integer check (sale_commission_bps is null or sale_commission_bps between 0 and 10000),

  created_by uuid, -- admin auth.users.id, best-effort audit info
  created_at timestamptz not null default now(),

  constraint stockist_inventory_movements_sale_fields check (
    (movement_type = 'sold' and sale_unit_price_cents is not null and sale_commission_bps is not null) or
    (movement_type <> 'sold' and sale_unit_price_cents is null and sale_commission_bps is null)
  )
);

create index if not exists idx_stockist_movements_item on stockist_inventory_movements(item_id);
create index if not exists idx_stockist_movements_stockist on stockist_inventory_movements(stockist_id);
create index if not exists idx_stockist_movements_type on stockist_inventory_movements(movement_type);
create index if not exists idx_stockist_movements_occurred on stockist_inventory_movements(occurred_on);
-- Supports the future "which product/colour/size/coverage sells best" /
-- "which stockist has the best sell-through" queries (section 10 of the
-- brief) — sold movements grouped by these dimensions, joined through the
-- item. Not built as a view yet (V1 keeps this in the admin endpoint's own
-- query); the columns/index are here so that query stays cheap later.
create index if not exists idx_stockist_movements_sold on stockist_inventory_movements(movement_type, item_id) where movement_type = 'sold';

-- RLS enabled, no public policies — same posture as every other table here.
-- Only server code using the SECRET (service_role) key touches these tables;
-- that key bypasses RLS by design (see server/utils/supabaseAdmin.js).
alter table stockists enable row level security;
alter table stockist_inventory_items enable row level security;
alter table stockist_inventory_movements enable row level security;

-- ── record_stockist_movement(): the ONLY way remaining/total_* change ────
--
-- Concurrency safety: `select ... for update` takes a row-level lock on the
-- item for the rest of the calling transaction. If two "sell the last unit"
-- requests arrive at nearly the same time, the second call's `for update`
-- blocks until the first transaction commits (or rolls back), then re-reads
-- the now-updated remaining_quantity and correctly rejects with
-- "insufficient remaining stock" — remaining can never go negative, no
-- matter how the two requests interleave. This guarantee only exists inside
-- this function; two plain sequential SELECT-then-UPDATE calls from
-- application code would NOT be safe, which is why the app never updates
-- these quantity columns directly.
create or replace function record_stockist_movement(
  p_item_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_occurred_on date,
  p_note text default null,
  p_sale_unit_price_cents integer default null,
  p_sale_commission_bps integer default null,
  p_created_by uuid default null
) returns jsonb
language plpgsql
as $$
declare
  v_item stockist_inventory_items%rowtype;
  v_new_remaining integer;
  v_movement stockist_inventory_movements%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be a positive whole number' using errcode = '22023';
  end if;
  if p_movement_type not in ('sent', 'restock', 'sold', 'returned', 'removed') then
    raise exception 'invalid movement type "%"', p_movement_type using errcode = '22023';
  end if;
  if p_occurred_on is null then
    raise exception 'occurred_on is required' using errcode = '22023';
  end if;

  -- Row lock: serializes concurrent movements against the SAME item. A
  -- concurrent movement against a DIFFERENT item is unaffected.
  select * into v_item from stockist_inventory_items where id = p_item_id for update;
  if not found then
    raise exception 'inventory item % not found', p_item_id using errcode = 'P0002';
  end if;

  if p_movement_type in ('sent', 'restock') then
    v_new_remaining := v_item.remaining_quantity + p_quantity;
  else
    v_new_remaining := v_item.remaining_quantity - p_quantity;
    if v_new_remaining < 0 then
      raise exception 'insufficient remaining stock: % left, % requested', v_item.remaining_quantity, p_quantity
        using errcode = '23514';
    end if;
  end if;

  if p_movement_type = 'sold' then
    if p_sale_unit_price_cents is null or p_sale_unit_price_cents < 0 then
      raise exception 'sale_unit_price_cents is required for a SOLD movement' using errcode = '22023';
    end if;
    if p_sale_commission_bps is null or p_sale_commission_bps < 0 or p_sale_commission_bps > 10000 then
      raise exception 'sale_commission_bps must be between 0 and 10000' using errcode = '22023';
    end if;
  end if;

  insert into stockist_inventory_movements (
    stockist_id, item_id, movement_type, quantity, occurred_on, note,
    sale_unit_price_cents, sale_commission_bps, created_by
  ) values (
    v_item.stockist_id, p_item_id, p_movement_type, p_quantity, p_occurred_on, nullif(p_note, ''),
    case when p_movement_type = 'sold' then p_sale_unit_price_cents else null end,
    case when p_movement_type = 'sold' then p_sale_commission_bps else null end,
    p_created_by
  ) returning * into v_movement;

  update stockist_inventory_items set
    remaining_quantity = v_new_remaining,
    total_supplied_quantity = total_supplied_quantity + case when p_movement_type in ('sent', 'restock') then p_quantity else 0 end,
    total_sold_quantity = total_sold_quantity + case when p_movement_type = 'sold' then p_quantity else 0 end,
    total_returned_quantity = total_returned_quantity + case when p_movement_type = 'returned' then p_quantity else 0 end,
    total_removed_quantity = total_removed_quantity + case when p_movement_type = 'removed' then p_quantity else 0 end,
    first_sent_at = coalesce(first_sent_at, case when p_movement_type = 'sent' then p_occurred_on end),
    updated_at = now()
  where id = p_item_id
  returning * into v_item;

  return jsonb_build_object('movement', to_jsonb(v_movement), 'item', to_jsonb(v_item));
end;
$$;

-- ── create_stockist_inventory_item(): item + its initial SENT movement, atomically ──
--
-- Inserting the item and recording its initial SENT movement as two separate
-- Supabase calls from application code is NOT atomic — a crash/network drop
-- between the two leaves a real item row sitting at remaining_quantity = 0
-- with no movement explaining it, which no client-side rollback can fully
-- guarantee against. This function does both inside ONE function call, and
-- therefore one transaction: calling `record_stockist_movement()` from
-- inside a plpgsql function runs it in the SAME transaction as the INSERT
-- above it, NOT a separate one — a plpgsql function has no transaction of
-- its own, it always runs inside whatever transaction called it. So if that
-- inner call raises (bad quantity, bad date, anything), the exception
-- propagates out and Postgres rolls back this entire function call,
-- including the item INSERT. The item and its initial SENT movement are
-- created together or not at all; nothing needs to catch this and clean up.
--
-- Works identically for a website-product item and a manual item — source-
-- specific fields (product_id vs. reference_code) are passed straight
-- through from whichever the caller already validated/resolved.
create or replace function create_stockist_inventory_item(
  p_stockist_id uuid,
  p_source text,
  p_product_id uuid,
  p_product_name_snapshot text,
  p_product_image_snapshot text,
  p_reference_code text,
  p_colour text,
  p_size text,
  p_coverage text,
  p_retail_price_cents integer,
  p_default_commission_bps integer,
  p_notes text,
  p_initial_quantity integer,
  p_date_sent date,
  p_created_by uuid default null
) returns jsonb
language plpgsql
as $$
declare
  v_item_id uuid;
begin
  insert into stockist_inventory_items (
    stockist_id, source, product_id, product_name_snapshot, product_image_snapshot,
    reference_code, colour, size, coverage, retail_price_cents, default_commission_bps, notes
  ) values (
    p_stockist_id, p_source, p_product_id, p_product_name_snapshot, p_product_image_snapshot,
    nullif(p_reference_code, ''), nullif(p_colour, ''), nullif(p_size, ''), nullif(p_coverage, ''),
    p_retail_price_cents, p_default_commission_bps, nullif(p_notes, '')
  ) returning id into v_item_id;

  -- Same function every later Restock/Sold/Return/Remove goes through. Any
  -- exception it raises (bad quantity, bad/missing date, ...) aborts this
  -- WHOLE function call — see the header comment above.
  return record_stockist_movement(
    v_item_id, 'sent', p_initial_quantity, p_date_sent, null, null, null, p_created_by
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Supabase Storage: manual inventory item photos (optional upload).
-- The 'product-images' bucket already exists in this project (see
-- server/utils/productImages.js) — this mirrors it exactly for stockist
-- items rather than reusing that bucket, so the two stay independently
-- manageable. Buckets are NOT created by SQL in this project's existing
-- pattern (product-images was created by hand in the Supabase dashboard),
-- so create this one the same way:
--
--   Storage → New bucket → name: stockist-item-images → Public bucket: ON
--
-- No bucket policy SQL is required beyond that — exactly like
-- 'product-images', all writes go through supabaseAdmin() (service role),
-- which bypasses Storage RLS; the bucket is marked "public" only so
-- getPublicUrl() links work for reading images already uploaded.
-- ─────────────────────────────────────────────────────────────────────────
