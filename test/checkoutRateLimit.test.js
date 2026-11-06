import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'
import { checkRateLimit, recordRateHit } from '../server/utils/checkoutRateLimit.js'

// IP resolution/hashing is intentionally NOT re-exported from
// checkoutRateLimit.js — every caller imports resolveClientIp/ipHash
// directly from server/utils/inquiryRateLimit.js (single source per name,
// avoids Nitro's server/utils auto-import duplicate-export warning). That
// module's own behaviour is covered by its pre-existing tests.

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('checkRateLimit', () => {
  it('fails open (ok:true) when keyHash is null — IP hashing not configured', async () => {
    const supabase = createFakeSupabase([])
    const r = await checkRateLimit(supabase, { scope: 'checkout', keyHash: null, windowMinutes: 10, maxPerWindow: 8 })
    expect(r).toEqual({ ok: true })
    expect(supabase._calls).toEqual([]) // never even queries
  })

  it('allows a fresh scope+key under the cap', async () => {
    const supabase = createFakeSupabase([
      { error: null }, // prune
      { count: 2, error: null } // count query
    ])
    const r = await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'h1', windowMinutes: 10, maxPerWindow: 8 })
    expect(r).toEqual({ ok: true })
  })

  it('blocks once the scope+key count reaches the cap', async () => {
    const supabase = createFakeSupabase([{ error: null }, { count: 8, error: null }])
    const r = await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'h1', windowMinutes: 10, maxPerWindow: 8 })
    expect(r.ok).toBe(false)
    expect(r.retryAfterSeconds).toBe(600)
  })

  it('two different scopes with the same key never share a count (scoped correctly)', async () => {
    const supabase = createFakeSupabase([{ error: null }, { count: 8, error: null }])
    await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'h1', windowMinutes: 10, maxPerWindow: 8 })
    const call = supabase._calls.find((c) => c.op === 'select')
    expect(call.filters).toEqual(expect.arrayContaining([['eq', 'scope', 'checkout'], ['eq', 'key_hash', 'h1']]))
  })

  it('fails open on a DB error reading the count, AND logs it as UNEXPECTED (not the migration-missing case)', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    const warnSpy = vi.spyOn(console, 'warn')
    const supabase = createFakeSupabase([{ error: null }, { count: null, error: { code: '53300', message: 'too many connections' } }])
    const r = await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'h1', windowMinutes: 10, maxPerWindow: 8 })
    expect(r).toEqual({ ok: true })
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('UNEXPECTED'), '53300', 'too many connections')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('fails open on a missing-table error (migration not applied) AND logs it as a warning, not an error', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    const warnSpy = vi.spyOn(console, 'warn')
    const supabase = createFakeSupabase([{ error: null }, { count: null, error: { code: 'PGRST205', message: "Could not find the table 'public.checkout_rate_hits'" } }])
    const r = await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'h1', windowMinutes: 10, maxPerWindow: 8 })
    expect(r).toEqual({ ok: true })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('migration not applied'), 'PGRST205')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('a pruning failure never blocks a legitimate sender, and is also classified (warn vs error)', async () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const supabase = createFakeSupabase([{ error: { code: '42P01', message: 'relation does not exist' } }, { count: 0, error: null }])
    const r = await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'h1', windowMinutes: 10, maxPerWindow: 8 })
    expect(r).toEqual({ ok: true })
    expect(warnSpy).toHaveBeenCalled()
  })

  it('never logs the key hash itself in any log line', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    const warnSpy = vi.spyOn(console, 'warn')
    const supabase = createFakeSupabase([{ error: null }, { count: null, error: { code: '53300', message: 'connection refused' } }])
    await checkRateLimit(supabase, { scope: 'checkout', keyHash: 'super-secret-hash-value', windowMinutes: 10, maxPerWindow: 8 })
    const allLogged = [...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().join(' ')
    expect(allLogged).not.toContain('super-secret-hash-value')
  })
})

describe('recordRateHit', () => {
  it('inserts one row with the scope + key hash', async () => {
    const supabase = createFakeSupabase([{ error: null }])
    await recordRateHit(supabase, { scope: 'checkout', keyHash: 'h1' })
    expect(supabase._calls).toEqual([
      { table: 'checkout_rate_hits', op: 'insert', payload: { scope: 'checkout', key_hash: 'h1' }, filters: [] }
    ])
  })

  it('is a no-op when keyHash is null', async () => {
    const supabase = createFakeSupabase([])
    await recordRateHit(supabase, { scope: 'checkout', keyHash: null })
    expect(supabase._calls).toEqual([])
  })

  it('an insert failure is classified the same way (migration-missing -> warn, else -> error)', async () => {
    const warnSpy = vi.spyOn(console, 'warn')
    const supabase = createFakeSupabase([{ error: { code: 'PGRST205', message: 'not found' } }])
    await recordRateHit(supabase, { scope: 'checkout', keyHash: 'h1' })
    expect(warnSpy).toHaveBeenCalled()
  })
})
