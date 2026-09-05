/**
 * Search-term handling for GET /api/admin/orders (server/api/admin/orders/index.get.js).
 *
 * Deliberately scoped to order_number/first_name/last_name/email only — never
 * `notes` (customer) or `admin_notes` (private/internal), per spec for this
 * phase. All matching happens server-side via a single PostgREST `.or()`
 * filter, so it stays cheap as the order count grows (no fetch-everything-
 * and-filter-in-JS).
 */

const SEARCH_MAX_LEN = 200

/**
 * Strip characters that are structurally significant either to PostgREST's
 * `or()` filter mini-language (`,` separates clauses, `()` groups them) or
 * to SQL ILIKE (`%`/`_` are wildcards) — none of these are meaningful in a
 * real order number, name, or email search, so replacing them with a space
 * keeps the query predictable instead of building a malformed filter string
 * or letting a typed `%`/`_` act as an unintended wildcard.
 */
function sanitize(raw) {
  return raw.replace(/[,()%_]/g, ' ').trim().slice(0, SEARCH_MAX_LEN)
}

/**
 * Builds the PostgREST `.or(...)` filter string for a sanitized search term,
 * or `null` for an empty term (caller should then skip searching entirely).
 *
 * Matches, all OR'd together:
 *  - order_number, tolerating "BM-000012", "BM-12", "bm12", or a bare "12"
 *    (the "BM-" prefix and leading zeros are stripped/parsed away; the
 *    underlying column is a plain integer, so this is an exact match on the
 *    number itself, not a substring search).
 *  - first_name / last_name / email, case-insensitive substring (ILIKE).
 *  - a two-word term also tried as "first last" AND "last first", so a full
 *    name search ("jane doe") matches even though it spans two columns.
 */
export function buildOrderSearchFilter(rawTerm) {
  if (typeof rawTerm !== 'string') return null
  const term = sanitize(rawTerm)
  if (!term) return null

  const clauses = [`first_name.ilike.*${term}*`, `last_name.ilike.*${term}*`, `email.ilike.*${term}*`]

  const bmMatch = term.match(/^bm-?0*(\d+)$/i)
  const bareDigits = term.match(/^\d+$/)
  const digits = bmMatch?.[1] ?? bareDigits?.[0]
  if (digits) {
    const n = parseInt(digits, 10)
    if (Number.isSafeInteger(n)) clauses.push(`order_number.eq.${n}`)
  }

  const tokens = term.split(/\s+/).filter(Boolean)
  if (tokens.length === 2) {
    const [a, b] = tokens
    clauses.push(`and(first_name.ilike.*${a}*,last_name.ilike.*${b}*)`)
    clauses.push(`and(first_name.ilike.*${b}*,last_name.ilike.*${a}*)`)
  }

  return { term, orClause: clauses.join(',') }
}
