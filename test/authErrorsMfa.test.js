import { describe, it, expect } from 'vitest'
import { friendlyAuthError } from '../utils/authErrors.js'

describe('friendlyAuthError — Phase 3 MFA messages', () => {
  it('maps an invalid TOTP code to a clear, actionable message', () => {
    expect(friendlyAuthError('Invalid TOTP code entered')).toBe('That code isn’t right — check your authenticator app and try again.')
  })

  it('maps an expired challenge to a distinct "expired" message, not the generic invalid-code one', () => {
    const msg = friendlyAuthError('MFA challenge has expired')
    expect(msg).toContain('expired')
    expect(msg).not.toContain('isn’t right')
  })

  it('passes through an unrecognized message unchanged', () => {
    expect(friendlyAuthError('Something totally unexpected')).toBe('Something totally unexpected')
  })
})
