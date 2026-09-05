/**
 * Search-term handling for GET /api/admin/inquiries.
 *
 * Mirrors server/utils/orderSearch.js: a single server-side PostgREST `.or()`
 * filter, structurally-significant characters stripped, so it stays cheap as
 * the table grows. Scoped to first_name / last_name / email / phone / message
 * — `admin_notes` is deliberately NOT searchable (private).
 *
 * `message` ILIKE is included here because this endpoint is admin-only.
 */

const SEARCH_MAX_LEN = 200

/**
 * Strip characters significant to PostgREST's or() mini-language (`,` `(` `)`)
 * and to SQL ILIKE (`%` `_`). None are meaningful in a real name/email/phone/
 * message search, so replacing them with a space keeps the query predictable.
 */
function sanitize(raw) {
  return raw.replace(/[,()%_]/g, ' ').trim().slice(0, SEARCH_MAX_LEN)
}

/**
 * Build the PostgREST `.or(...)` string for a sanitized term, or `null` for an
 * empty term (caller then skips searching).
 *
 * @returns {{ term: string, orClause: string } | null}
 */
export function buildInquirySearchFilter(rawTerm) {
  if (typeof rawTerm !== 'string') return null
  const term = sanitize(rawTerm)
  if (!term) return null

  const clauses = [
    `first_name.ilike.*${term}*`,
    `last_name.ilike.*${term}*`,
    `email.ilike.*${term}*`,
    `message.ilike.*${term}*`
  ]

  // Phone: match the digit run, so "473 555 0100" / "4735550100" both hit a
  // stored "+1 (473) 555-0100". Needs >= 3 digits so a short word search
  // isn't turned into a phone scan.
  const phoneDigits = term.replace(/\D/g, '')
  if (phoneDigits.length >= 3) clauses.push(`phone.ilike.*${phoneDigits}*`)

  // Two-word term also tried as "first last" AND "last first".
  const tokens = term.split(/\s+/).filter(Boolean)
  if (tokens.length === 2) {
    const [a, b] = tokens
    clauses.push(`and(first_name.ilike.*${a}*,last_name.ilike.*${b}*)`)
    clauses.push(`and(first_name.ilike.*${b}*,last_name.ilike.*${a}*)`)
  }

  return { term, orClause: clauses.join(',') }
}
