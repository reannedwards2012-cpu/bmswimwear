-- ─────────────────────────────────────────────────────────────────────────
-- The Swimsuit Mixer — custom promo-video thumbnail (poster image).
--
-- Adds ONE OPTIONAL column to bikini_mix_event. Nullable, no default: a row
-- with no thumbnail behaves exactly as today (plain <video controls>, no
-- poster) — every existing row is automatically compatible.
--
-- NOT APPLIED TO PRODUCTION — prepared locally for review only, same
-- standing instruction as every other migration for this feature.
-- ─────────────────────────────────────────────────────────────────────────

alter table bikini_mix_event add column if not exists promo_video_thumbnail_url text;
