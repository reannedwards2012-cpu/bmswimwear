import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch } from './helpers/mockFetch.js'
import {
  sendTransactionalEmail,
  upsertContact,
  BREVO_SENDER,
  brevoConfigured
} from '../server/utils/brevo.js'

beforeEach(() => {
  vi.stubEnv('BREVO_API_KEY', 'test-key-123')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('brevo.sendTransactionalEmail', () => {
  it('POSTs to /smtp/email with the centralised sender + api key, returns messageId', async () => {
    const fetchFn = mockFetch(() => ({ status: 201, json: { messageId: 'msg-1' } }))
    vi.stubGlobal('fetch', fetchFn)

    const r = await sendTransactionalEmail({
      to: 'her@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi'
    })

    expect(r).toEqual({ ok: true, status: 201, messageId: 'msg-1', error: null })
    const call = fetchFn.records[0]
    expect(call.url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(call.opts.headers['api-key']).toBe('test-key-123')
    expect(call.body.sender).toEqual(BREVO_SENDER)
    expect(call.body.replyTo).toEqual({ email: 'hello@bmswimwear.com' })
    expect(call.body.to).toEqual([{ email: 'her@example.com' }])
  })

  it('honours an explicit replyTo', async () => {
    const fetchFn = mockFetch(() => ({ status: 201, json: {} }))
    vi.stubGlobal('fetch', fetchFn)
    await sendTransactionalEmail({
      to: 'admin@bmswimwear.com',
      subject: 'x',
      text: 'x',
      replyTo: { email: 'customer@example.com', name: 'A B' }
    })
    expect(fetchFn.records[0].body.replyTo).toEqual({ email: 'customer@example.com', name: 'A B' })
  })

  it('rejects a send with no recipient or no subject, without calling fetch', async () => {
    const fetchFn = mockFetch(() => ({ status: 201 }))
    vi.stubGlobal('fetch', fetchFn)
    expect(await sendTransactionalEmail({ to: 'a@b.co', text: 't' })).toMatchObject({
      ok: false,
      error: 'invalid-request'
    })
    expect(await sendTransactionalEmail({ subject: 's', text: 't' })).toMatchObject({
      ok: false,
      error: 'invalid-request'
    })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('returns { ok:false } on an HTTP error without throwing', async () => {
    vi.stubGlobal('fetch', mockFetch(() => ({ status: 500, json: { code: 'server_error' } })))
    const r = await sendTransactionalEmail({ to: 'a@b.co', subject: 's', text: 't' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(500)
  })

  it('returns { ok:false } without throwing when fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom')
      })
    )
    const r = await sendTransactionalEmail({ to: 'a@b.co', subject: 's', text: 't' })
    expect(r).toMatchObject({ ok: false, status: 0 })
    expect(typeof r.error).toBe('string')
  })

  it('does nothing (and never calls fetch) when BREVO_API_KEY is absent', async () => {
    vi.stubEnv('BREVO_API_KEY', '')
    const fetchFn = mockFetch(() => ({ status: 201 }))
    vi.stubGlobal('fetch', fetchFn)
    const r = await sendTransactionalEmail({ to: 'a@b.co', subject: 's', text: 't' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('not-configured')
    expect(fetchFn).not.toHaveBeenCalled()
    expect(brevoConfigured()).toBe(false)
  })
})

describe('brevo.upsertContact', () => {
  it('created:true on a 201 (brand-new contact)', async () => {
    const fetchFn = mockFetch(() => ({ status: 201, json: { id: 42 } }))
    vi.stubGlobal('fetch', fetchFn)
    const r = await upsertContact({ email: 'new@example.com', listIds: [3] })
    expect(r).toMatchObject({ ok: true, status: 201, created: true })
    expect(fetchFn.records[0].body).toMatchObject({
      email: 'new@example.com',
      updateEnabled: true,
      listIds: [3]
    })
  })

  it('duplicate signup is graceful success (204, created:false)', async () => {
    vi.stubGlobal('fetch', mockFetch(() => ({ status: 204 })))
    const r = await upsertContact({ email: 'dupe@example.com', listIds: [3] })
    expect(r).toMatchObject({ ok: true, status: 204, created: false })
  })

  it('returns { ok:false } on a 400', async () => {
    vi.stubGlobal('fetch', mockFetch(() => ({ status: 400, json: { code: 'invalid_parameter' } })))
    const r = await upsertContact({ email: 'bad', listIds: [3] })
    expect(r).toMatchObject({ ok: false, created: false })
  })
})
