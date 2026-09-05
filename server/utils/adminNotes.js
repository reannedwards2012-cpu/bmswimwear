/**
 * Pure validation for the admin-only order notes field. No Nitro/Supabase
 * imports, so it can be unit-tested directly (matches checkoutOrder.js's
 * pattern).
 */
export const MAX_ADMIN_NOTES_LENGTH = 5000

/**
 * Normalize an incoming `adminNotes` value: only a string or null/undefined
 * is accepted, whitespace is trimmed, an empty result becomes null, and
 * anything over the length limit is rejected.
 *
 * @returns {{ ok: true, value: string|null } | { ok: false, error: string }}
 */
export function normalizeAdminNotes(raw) {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'adminNotes must be a string or null.' }

  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  if (trimmed.length > MAX_ADMIN_NOTES_LENGTH) {
    return { ok: false, error: `Notes must be ${MAX_ADMIN_NOTES_LENGTH} characters or fewer.` }
  }
  return { ok: true, value: trimmed }
}
