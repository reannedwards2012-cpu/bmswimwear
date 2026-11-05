-- ─────────────────────────────────────────────────────────────────────────
-- The Swimsuit Mixer — optional body measurements (Step 3 "Your
-- Measurements" section).
--
-- Adds four OPTIONAL body measurement fields (inches, one decimal place)
-- to bikini_mix_bookings — bust, underbust, waist, hips. All four are
-- nullable and never required for checkout/payment; every existing booking
-- row is automatically compatible (NULL for all four = "not provided").
--
-- NOT APPLIED TO PRODUCTION — prepared locally for review only, same
-- standing instruction as every other migration for this feature.
-- ─────────────────────────────────────────────────────────────────────────

alter table bikini_mix_bookings add column if not exists bust_inches numeric(4,1) check (bust_inches is null or (bust_inches > 0 and bust_inches <= 120));
alter table bikini_mix_bookings add column if not exists underbust_inches numeric(4,1) check (underbust_inches is null or (underbust_inches > 0 and underbust_inches <= 120));
alter table bikini_mix_bookings add column if not exists waist_inches numeric(4,1) check (waist_inches is null or (waist_inches > 0 and waist_inches <= 120));
alter table bikini_mix_bookings add column if not exists hips_inches numeric(4,1) check (hips_inches is null or (hips_inches > 0 and hips_inches <= 120));
