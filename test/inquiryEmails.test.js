import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockFetch } from './helpers/mockFetch.js'
import { sendInquiryEmails } from '../server/utils/inquiryEmails.js'

const INQUIRY = {
  id: 'inq-1',
  firstName: 'Reann',
  lastName: 'Edwards',
  email: 'reann@example.com',
  phone: '+1473',
  subject: 'Sizing & fit help',
  message: 'What size am I?'
}

beforeEach(() => {
  vi.stubEnv('BREVO_API_KEY', 'test-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sendInquiryEmails', () => {
  it('sends a customer acknowledgment + an admin notification with Reply-To = customer', async () => {
    const fetchFn = mockFetch(() => ({ status: 201, json: { messageId: 'm' } }))
    vi.stubGlobal('fetch', fetchFn)

    await sendInquiryEmails(INQUIRY)

    expect(fetchFn.records).toHaveLength(2)
    const toCustomer = fetchFn.records.find((r) => r.body.to[0].email === 'reann@example.com')
    const toAdmin = fetchFn.records.find((r) => r.body.to[0].email === 'hello@bmswimwear.com')
    expect(toCustomer).toBeTruthy()
    expect(toAdmin).toBeTruthy()
    expect(toAdmin.body.replyTo).toEqual({ email: 'reann@example.com', name: 'Reann Edwards' })
  })

  it('does NOT throw when every email request fails (inquiry already saved)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network')
      })
    )
    await expect(sendInquiryEmails(INQUIRY)).resolves.toBeUndefined()
  })

  it('still resolves when Brevo returns HTTP 500 for both', async () => {
    vi.stubGlobal('fetch', mockFetch(() => ({ status: 500, json: { code: 'err' } })))
    await expect(sendInquiryEmails(INQUIRY)).resolves.toBeUndefined()
  })

  it('with no customer email, only the admin notification is attempted', async () => {
    const fetchFn = mockFetch(() => ({ status: 201, json: {} }))
    vi.stubGlobal('fetch', fetchFn)
    await sendInquiryEmails({ ...INQUIRY, email: '' })
    expect(fetchFn.records).toHaveLength(1)
    expect(fetchFn.records[0].body.to[0].email).toBe('hello@bmswimwear.com')
    expect(fetchFn.records[0].body.replyTo).toEqual({ email: 'hello@bmswimwear.com' })
  })
})
