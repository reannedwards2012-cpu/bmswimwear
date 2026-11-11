import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateInvitationCode, codeHash, INVITATION_CATEGORIES, CATEGORY_LABELS } from '../server/utils/bikiniMixInvitationCodes.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('generateInvitationCode', () => {
  it('produces a 14-char grouped code (12 symbols + 2 dashes) from the safe alphabet only', () => {
    const code = generateInvitationCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  })

  it('never contains ambiguous characters (0, O, 1, I)', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInvitationCode()).not.toMatch(/[0O1I]/)
    }
  })

  it('is different on every call (not a fixed/predictable value)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInvitationCode()))
    expect(codes.size).toBe(20)
  })
})

describe('codeHash', () => {
  it('returns null when INQUIRY_HASH_SECRET is not configured — fails CLOSED, not open', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', '')
    expect(codeHash('ABCD-EFGH-JKLM')).toBeNull()
  })

  it('is deterministic for the same code + secret', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    expect(codeHash('ABCD-EFGH-JKLM')).toBe(codeHash('ABCD-EFGH-JKLM'))
  })

  it('is case- and dash-insensitive — a guest typing lowercase or no dashes hashes identically', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    const a = codeHash('ABCD-EFGH-JKLM')
    const b = codeHash('abcdefghjklm')
    const c = codeHash('  abcd-efgh-jklm  ')
    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('different codes hash differently', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    expect(codeHash('ABCD-EFGH-JKLM')).not.toBe(codeHash('ABCD-EFGH-JKLN'))
  })

  it('never produces the same hash as ipHash() for the same raw string — domain separation', async () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    const { ipHash } = await import('../server/utils/inquiryRateLimit.js')
    expect(codeHash('203.0.113.5')).not.toBe(ipHash('203.0.113.5'))
  })

  it('returns null for an empty/non-string code', () => {
    vi.stubEnv('INQUIRY_HASH_SECRET', 'secret')
    expect(codeHash('')).toBeNull()
    expect(codeHash('   ')).toBeNull()
    expect(codeHash(null)).toBeNull()
  })
})

describe('INVITATION_CATEGORIES / CATEGORY_LABELS', () => {
  it('has exactly the three required categories, each with a human label', () => {
    expect(INVITATION_CATEGORIES).toEqual(['event_assistant', 'giveaway', 'other'])
    for (const cat of INVITATION_CATEGORIES) {
      expect(typeof CATEGORY_LABELS[cat]).toBe('string')
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0)
    }
  })
})
