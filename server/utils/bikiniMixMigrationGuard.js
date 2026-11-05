/**
 * True when a Supabase/PostgREST error means "the Swimsuit Mixer migration
 * (supabase/migrations/20261104000000_swimsuit_mixer_single_ticket.sql)
 * hasn't been applied to this database yet" — a missing table, column or
 * function, not a real failure. Mirrors the check server/api/bikini-mix/
 * event.get.js (the public endpoint) already used for its own "not
 * configured" 503, generalised to the handful of extra Postgres/PostgREST
 * codes the admin endpoints can also hit:
 *   '42P01' — undefined_table      (plain Postgres: bikini_mix_gallery_images
 *                                    doesn't exist at all pre-migration)
 *   '42703' — undefined_column     (plain Postgres: a SELECT/UPDATE touches
 *                                    a not-yet-added column)
 *   '42883' — undefined_function   (plain Postgres: an RPC call's new
 *                                    parameter signature isn't defined yet)
 *   'PGRST202' — PostgREST's "function not found" (RPC signature mismatch)
 *   'PGRST204' — PostgREST's "column not in schema cache"
 *   'PGRST205' — PostgREST's "table not in schema cache"
 */
const MIGRATION_NOT_APPLIED_CODES = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export function isMigrationNotAppliedError(error) {
  return Boolean(error && MIGRATION_NOT_APPLIED_CODES.has(error.code))
}
