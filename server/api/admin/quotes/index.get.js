/**
 * GET /api/admin/quotes?status=&category=&search=
 *
 * Admin-only. Returns quotes newest-first, optionally filtered by status
 * and/or category, and/or a search term matched against customer name,
 * email, phone and the swimsuit description (case-insensitive, partial).
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { QUOTE_LIST_SELECT, mapQuoteListItem } from '../../../utils/quoteMappers.js'
import { QUOTE_STATUSES } from '../../../utils/quoteValidation.js'
import { QUOTE_CATEGORIES } from '../../../../utils/quoteCalculator.js'

function escapeForIlike(term) {
  // Escapes PostgREST's comma/parenthesis delimiters so a search term can
  // never break out of the .or() filter string it's interpolated into.
  return term.replace(/[,()]/g, '')
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const query = getQuery(event)
  const statusFilter = typeof query.status === 'string' ? query.status : ''
  const categoryFilter = typeof query.category === 'string' ? query.category : ''
  const rawSearch = typeof query.search === 'string' ? query.search.trim() : ''

  if (statusFilter && !QUOTE_STATUSES.includes(statusFilter)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid status filter.' }
  }
  if (categoryFilter && !QUOTE_CATEGORIES.includes(categoryFilter)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid category filter.' }
  }

  try {
    const supabase = supabaseAdmin()

    let listQuery = supabase.from('quotes').select(QUOTE_LIST_SELECT).order('created_at', { ascending: false })
    if (statusFilter) listQuery = listQuery.eq('status', statusFilter)
    if (categoryFilter) listQuery = listQuery.eq('category', categoryFilter)
    if (rawSearch) {
      const term = escapeForIlike(rawSearch)
      listQuery = listQuery.or(
        `customer_name.ilike.%${term}%,customer_email.ilike.%${term}%,customer_phone.ilike.%${term}%,description.ilike.%${term}%`
      )
    }

    const { data, error } = await listQuery

    if (error) {
      console.error('[admin/quotes] list query failed:', error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load quotes.' }
    }

    return {
      quotes: (data ?? []).map(mapQuoteListItem),
      filters: { status: statusFilter || null, category: categoryFilter || null, search: rawSearch || null }
    }
  } catch (err) {
    console.error('[admin/quotes] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load quotes.' }
  }
})
