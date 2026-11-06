import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeSupabase } from './helpers/fakeSupabase.js'
import {
  ipHash,
  ipThrottleConfigured,
  checkInquiryRateLimit,
  recordInquiryRateHit,
  MAX_IP_PER_WINDOW,
  MAX_EMAIL_PER_WINDOW
} from '../server/utils/inquiryRateLimit.js'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('ipHash / ipThrottleConfigured', () => {
  it('returns null (throttling disabled) when INQUIRY_HASH_SECRET is unset', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', '')
    expect(ipHash('203.0.113.5')).toBeNull()
    expect(ipThrottleConfigured()).toBe(false)
  })

  it('returns null when there is no IP, even with a secret configured', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    expect(ipHash(null)).toBeNull()
  })

  it('is deterministic for the same IP + secret, and never the raw IP', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    const a = ipHash('203.0.113.5')
    const b = ipHash('203.0.113.5')
    expect(a).toBe(b)
    expect(a).not.toContain('203.0.113.5')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different IPs hash differently', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    expect(ipHash('203.0.113.5')).not.toBe(ipHash('203.0.113.6'))
  })
})

describe('checkInquiryRateLimit', () => {
  // Queue order inside checkInquiryRateLimit: [0] prune delete, [1] IP count
  // (only if ipHashValue given), [2] email count (only if email given).

  it('allows a fresh sender under both limits', async () => {
    const supabase = createFakeSupabase([
      { error: null }, // prune
      { count: 0, error: null }, // ip
      { count: 0, error: null } // email
    ])
    const r = await checkInquiryRateLimit(supabase, { ipHashValue: 'hash-a', email: 'jane@example.com' })
    expect(r).toEqual({ ok: true })
  })

  it('blocks once the per-IP window is at the cap', async () => {
    const supabase = createFakeSupabase([
      { error: null },
      { count: MAX_IP_PER_WINDOW, error: null }
    ])
    const r = await checkInquiryRateLimit(supabase, { ipHashValue: 'hash-a', email: null })
    expect(r.ok).toBe(false)
    expect(r.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('blocks once the per-email window is at the cap, even with a fresh IP', async () => {
    const supabase = createFakeSupabase([
      { error: null },
      { count: 0, error: null }, // ip: fine
      { count: MAX_EMAIL_PER_WINDOW, error: null } // email: at cap
    ])
    const r = await checkInquiryRateLimit(supabase, { ipHashValue: 'hash-a', email: 'spammer@example.com' })
    expect(r.ok).toBe(false)
  })

  it('skips the IP check entirely when ipHashValue is null (throttling not configured)', async () => {
    const supabase = createFakeSupabase([
      { error: null }, // prune
      { count: 0, error: null } // email only — no IP count queued/consumed
    ])
    const r = await checkInquiryRateLimit(supabase, { ipHashValue: null, email: 'jane@example.com' })
    expect(r).toEqual({ ok: true })
    // only the prune (on inquiry_rate_hits) + the email count (on inquiries)
    // ran — no IP-keyed query against inquiry_rate_hits at all.
    expect(supabase._calls.filter((c) => c.table === 'inquiry_rate_hits').length).toBe(1)
    expect(supabase._calls.filter((c) => c.table === 'inquiries').length).toBe(1)
  })

  it('fails open on an infra error reading the IP count (legitimate senders are never blocked by a DB hiccup)', async () => {
    const supabase = createFakeSupabase([
      { error: null },
      { count: null, error: { message: 'db unreachable' } }, // ip lookup errors
      { count: 0, error: null } // email: fine
    ])
    const r = await checkInquiryRateLimit(supabase, { ipHashValue: 'hash-a', email: 'jane@example.com' })
    expect(r).toEqual({ ok: true })
  })

  it('a pruning failure never blocks a legitimate sender', async () => {
    const supabase = createFakeSupabase([
      { error: { message: 'prune failed' } },
      { count: 0, error: null },
      { count: 0, error: null }
    ])
    const r = await checkInquiryRateLimit(supabase, { ipHashValue: 'hash-a', email: 'jane@example.com' })
    expect(r).toEqual({ ok: true })
  })
})

describe('recordInquiryRateHit', () => {
  it('inserts one row keyed by the hash when IP throttling is configured', async () => {
    const supabase = createFakeSupabase([{ error: null }])
    await recordInquiryRateHit(supabase, 'hash-a')
    expect(supabase._calls).toEqual([
      { table: 'inquiry_rate_hits', op: 'insert', payload: { key_hash: 'hash-a' }, filters: [] }
    ])
  })

  it('is a no-op when ipHashValue is null', async () => {
    const supabase = createFakeSupabase([])
    await recordInquiryRateHit(supabase, null)
    expect(supabase._calls).toEqual([])
  })
})
