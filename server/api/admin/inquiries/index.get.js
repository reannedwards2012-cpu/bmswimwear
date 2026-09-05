/**
 * GET /api/admin/inquiries?status=&search=&limit=&before=
 *
 * Admin-only. Newest first. Returns a safe list (no `admin_notes`, no full
 * `message` — just a preview). `statusCounts` respects `search` but not the
 * `status` filter, so switching status pills shows what else is available.
 *
 * Isolated: reads only `public.inquiries`.
 */
import { supabaseAdmin } from '../../../utils/supabaseAdmin.js'
import { requireAdmin } from '../../../utils/authUser.js'
import { INQUIRY_STATUSES } from '../../../utils/inquiryValidation.js'
import { INQUIRY_LIST_SELECT, mapInquiryListItem } from '../../../utils/inquiryMappers.js'
import { buildInquirySearchFilter } from '../../../utils/inquirySearch.js'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  await requireAdmin(event) // throws 401 / 403

  const query = getQuery(event)
  const statusFilter = typeof query.status === 'string' && query.status && query.status !== 'all' ? query.status : null
  const rawSearch = typeof query.search === 'string' ? query.search : ''
  const before = typeof query.before === 'string' && query.before ? query.before : null

  if (statusFilter && !INQUIRY_STATUSES.includes(statusFilter)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid status filter.' }
  }

  let limit = Number.parseInt(query.limit, 10)
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_LIMIT)

  try {
    const supabase = supabaseAdmin()
    const search = buildInquirySearchFilter(rawSearch)

    // Shared search scope for the list and the counts query.
    const applySearch = (q) => (search ? q.or(search.orClause) : q)

    let listQuery = applySearch(
      supabase.from('inquiries').select(INQUIRY_LIST_SELECT).order('created_at', { ascending: false }).limit(limit + 1)
    )
    if (statusFilter) listQuery = listQuery.eq('status', statusFilter)
    if (before) listQuery = listQuery.lt('created_at', before)

    const countsQuery = applySearch(supabase.from('inquiries').select('status'))

    const [listRes, countsRes] = await Promise.all([listQuery, countsQuery])

    if (listRes.error) {
      console.error('[admin/inquiries] list query failed:', listRes.error.message)
      setResponseStatus(event, 500)
      return { error: 'Could not load inquiries.' }
    }

    const rows = listRes.data ?? []
    const hasMore = rows.length > limit
    const inquiries = rows.slice(0, limit).map(mapInquiryListItem)

    const statusCounts = Object.fromEntries(INQUIRY_STATUSES.map((s) => [s, 0]))
    if (countsRes.error) {
      console.error('[admin/inquiries] status counts query failed:', countsRes.error.message)
    } else {
      for (const row of countsRes.data ?? []) {
        if (statusCounts[row.status] !== undefined) statusCounts[row.status]++
      }
    }

    return {
      inquiries,
      count: inquiries.length,
      hasMore,
      statusCounts,
      filters: { status: statusFilter, search: search?.term ?? null }
    }
  } catch (err) {
    console.error('[admin/inquiries] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { error: 'Could not load inquiries.' }
  }
})
