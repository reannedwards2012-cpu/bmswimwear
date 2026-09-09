import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  subscribeToNewsletter,
  normalizeEmail,
  isValidEmail
} from '../server/utils/newsletterSubscribe.js'

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

describe('normalizeEmail / isValidEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  HER@Example.COM ')).toBe('her@example.com')
    expect(normalizeEmail(null)).toBe('')
  })
  it('validates format and length', () => {
    expect(isValidEmail('her@example.com')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('nope@nope')).toBe(false)
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(`${'a'.repeat(160)}@x.co`)).toBe(false)
  })
})

describe('subscribeToNewsletter', () => {
  it('valid + new contact → subscribed, contact upserted with the normalized email', async () => {
    const upsertContact = vi.fn(async () => ({ ok: true, created: true }))
    const r = await subscribeToNewsletter({ email: '  New@Example.com ' }, { upsertContact })
    expect(r).toEqual({ ok: true, status: 'subscribed' })
    expect(upsertContact).toHaveBeenCalledWith({ email: 'new@example.com' })
  })

  it('duplicate signup (existing contact) → graceful success', async () => {
    const upsertContact = vi.fn(async () => ({ ok: true, created: false }))
    const r = await subscribeToNewsletter({ email: 'dupe@example.com' }, { upsertContact })
    expect(r).toEqual({ ok: true, status: 'already' })
  })

  it('invalid email → not ok, contact never touched', async () => {
    const upsertContact = vi.fn()
    const r = await subscribeToNewsletter({ email: 'not-an-email' }, { upsertContact })
    expect(r).toEqual({ ok: false, status: 'invalid' })
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('Brevo contact failure → NOT a false success', async () => {
    const upsertContact = vi.fn(async () => ({ ok: false, created: false }))
    const r = await subscribeToNewsletter({ email: 'her@example.com' }, { upsertContact })
    expect(r).toEqual({ ok: false, status: 'failed' })
  })

  it('never sends email — no welcome dependency is used or expected', async () => {
    const upsertContact = vi.fn(async () => ({ ok: true, created: true }))
    // deps intentionally has no sendWelcome / sendTransactionalEmail
    await expect(
      subscribeToNewsletter({ email: 'her@example.com' }, { upsertContact })
    ).resolves.toEqual({ ok: true, status: 'subscribed' })
  })
})
