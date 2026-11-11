import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../server/utils/authUser.js', () => ({ requireAdmin: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { requireAdmin } from '../server/utils/authUser.js'
import { supabaseAdmin } from '../server/utils/supabaseAdmin.js'

function stubGlobals() {
  vi.stubGlobal('defineEventHandler', (fn) => fn)
  vi.stubGlobal('readBody', async (e) => e._body)
  vi.stubGlobal('setResponseStatus', (e, s) => { e._status = s })
  vi.stubGlobal('getRouterParam', (e, k) => e._params?.[k])
}
const postEvent = (body) => ({ _body: body, _status: 200 })
const paramEvent = (params) => ({ _params: params, _status: 200 })
const CODE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

beforeEach(() => {
  stubGlobals()
  vi.stubEnv('INQUIRY_HASH_SECRET', 'test-secret')
  requireAdmin.mockReset().mockResolvedValue({ id: 'admin-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('GET /api/admin/bikini-mix/invitation-codes', () => {
  it('lists codes and tallies active/redeemed counts per category', async () => {
    const rows = [
      { id: '1', category: 'event_assistant', status: 'redeemed', notes: null, redeemed_by_booking_id: 'b1', redeemed_at: '2026-11-05T00:00:00Z', created_at: '2026-11-01T00:00:00Z' },
      { id: '2', category: 'event_assistant', status: 'active', notes: null, redeemed_by_booking_id: null, redeemed_at: null, created_at: '2026-11-01T00:00:00Z' },
      { id: '3', category: 'giveaway', status: 'revoked', notes: null, redeemed_by_booking_id: null, redeemed_at: null, created_at: '2026-11-01T00:00:00Z' }
    ]
    supabaseAdmin.mockReturnValue({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) })
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.get.js')).default

    const res = await handler(paramEvent({}))

    expect(res.codes).toHaveLength(3)
    expect(res.counts.event_assistant).toEqual({ active: 1, redeemed: 1 })
    expect(res.counts.giveaway).toEqual({ active: 0, redeemed: 0 }) // revoked doesn't count toward either
  })

  it('never returns a plaintext code field', async () => {
    const rows = [{ id: '1', category: 'giveaway', status: 'active', notes: null, redeemed_by_booking_id: null, redeemed_at: null, created_at: '2026-11-01T00:00:00Z' }]
    supabaseAdmin.mockReturnValue({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) })
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.get.js')).default

    const res = await handler(paramEvent({}))

    expect(res.codes[0]).not.toHaveProperty('code')
    expect(res.codes[0]).not.toHaveProperty('codeHash')
  })

  it('requires admin', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    supabaseAdmin.mockReturnValue({ from: () => ({}) })
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.get.js')).default

    await expect(handler(paramEvent({}))).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/admin/bikini-mix/invitation-codes', () => {
  function supabaseAtCap(category, cap, issued) {
    const col = { event_assistant: 'comp_event_assistant_slots', giveaway: 'comp_giveaway_slots', other: 'comp_other_slots' }[category]
    return {
      from: (table) => {
        if (table === 'bikini_mix_event') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { [col]: cap }, error: null }) }) }) }
        if (table === 'bikini_mix_invitation_codes') {
          return {
            select: (sel, opts) => {
              if (opts?.count) return { eq: () => ({ in: () => Promise.resolve({ count: issued, error: null }) }) }
              throw new Error('unexpected select')
            },
            insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id', category, status: 'active', notes: null, created_at: '2026-11-09T00:00:00Z' }, error: null }) }) })
          }
        }
        throw new Error(`unexpected table ${table}`)
      }
    }
  }

  it('rejects an invalid category before touching the database', async () => {
    const readSpy = vi.fn()
    supabaseAdmin.mockReturnValue({ from: () => ({ select: readSpy }) })
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.post.js')).default

    const res = await handler(postEvent({ category: 'not-a-real-category' }))

    expect(res).toMatchObject({ error: expect.any(String) })
    expect(readSpy).not.toHaveBeenCalled()
  })

  it('generates a code and returns the plaintext EXACTLY once, under the cap', async () => {
    const supabase = supabaseAtCap('giveaway', 1, 0)
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.post.js')).default

    const res = await handler(postEvent({ category: 'giveaway' }))

    expect(res.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(res.category).toBe('giveaway')
  })

  it('rejects generation once the category cap is reached — 409, no code created', async () => {
    const supabase = supabaseAtCap('event_assistant', 2, 2) // already 2 of 2 issued
    const insertSpy = vi.fn()
    supabase.from = (table) => {
      if (table === 'bikini_mix_event') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { comp_event_assistant_slots: 2 }, error: null }) }) }) }
      if (table === 'bikini_mix_invitation_codes') {
        return {
          select: (sel, opts) => (opts?.count ? { eq: () => ({ in: () => Promise.resolve({ count: 2, error: null }) }) } : {}),
          insert: insertSpy
        }
      }
      throw new Error(`unexpected table ${table}`)
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.post.js')).default

    const e = postEvent({ category: 'event_assistant' })
    const res = await handler(e)

    expect(e._status).toBe(409)
    expect(res.error).toMatch(/cap/i)
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('stores only the hash — the plaintext is never written to the database', async () => {
    const supabase = supabaseAtCap('other', 5, 0)
    let insertedPayload
    supabase.from = (table) => {
      if (table === 'bikini_mix_event') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { comp_other_slots: 5 }, error: null }) }) }) }
      if (table === 'bikini_mix_invitation_codes') {
        return {
          select: (sel, opts) => (opts?.count ? { eq: () => ({ in: () => Promise.resolve({ count: 0, error: null }) }) } : {}),
          insert: (payload) => {
            insertedPayload = payload
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id', category: 'other', status: 'active', notes: null, created_at: '2026-11-09T00:00:00Z' }, error: null }) }) }
          }
        }
      }
      throw new Error(`unexpected table ${table}`)
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.post.js')).default

    const res = await handler(postEvent({ category: 'other' }))

    expect(insertedPayload.code_hash).not.toBe(res.code)
    expect(insertedPayload).not.toHaveProperty('code')
    expect(insertedPayload.code_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('requires admin', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    supabaseAdmin.mockReturnValue({ from: () => ({}) })
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/index.post.js')).default

    await expect(handler(postEvent({ category: 'giveaway' }))).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('POST /api/admin/bikini-mix/invitation-codes/:id/revoke', () => {
  it('revokes an active code', async () => {
    const supabase = {
      from: () => ({
        update: () => ({
          eq: () => ({
            eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: CODE_ID, category: 'giveaway', status: 'revoked', notes: null, redeemed_by_booking_id: null, redeemed_at: null, created_at: '2026-11-01T00:00:00Z' }, error: null }) }) })
          })
        })
      })
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/[id]/revoke.post.js')).default

    const res = await handler(paramEvent({ id: CODE_ID }))

    expect(res.code.status).toBe('revoked')
  })

  it('404s when the code is not active (already redeemed/revoked/missing) — never un-revokes or touches a redeemed code', async () => {
    const supabase = {
      from: () => ({ update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) })
    }
    supabaseAdmin.mockReturnValue(supabase)
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/[id]/revoke.post.js')).default

    const e = paramEvent({ id: CODE_ID })
    const res = await handler(e)

    expect(e._status).toBe(404)
    expect(res).toMatchObject({ error: expect.any(String) })
  })

  it('requires admin', async () => {
    requireAdmin.mockRejectedValueOnce(Object.assign(new Error('Sign in required'), { statusCode: 401 }))
    supabaseAdmin.mockReturnValue({ from: () => ({}) })
    const handler = (await import('../server/api/admin/bikini-mix/invitation-codes/[id]/revoke.post.js')).default

    await expect(handler(paramEvent({ id: CODE_ID }))).rejects.toMatchObject({ statusCode: 401 })
  })
})
