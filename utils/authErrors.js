/**
 * Friendly, on-brand copy for Supabase Auth error messages, and the password
 * hint shown on the sign-up / reset-password forms.
 *
 * Supabase's raw messages are mostly usable but a few are long/technical — map
 * those; pass the rest through (they're already clear, e.g. "Password should be
 * at least 10 characters").
 */

export const PASSWORD_HINT =
  'At least 8 characters, with upper- and lower-case letters, a number, and a symbol.'

export function friendlyAuthError(message) {
  const m = String(message || '')

  if (/invalid login credentials/i.test(m)) return 'That email or password isn’t right.'
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox.'
  if (/password should contain at least one character of each/i.test(m)) return PASSWORD_HINT
  if (/rate limit|too many requests/i.test(m)) {
    return 'Too many attempts — please wait a minute and try again.'
  }
  if (/for security purposes.*\d+\s*seconds/i.test(m)) {
    return 'Please wait a moment before trying that again.'
  }
  if (/user already registered/i.test(m)) {
    return 'That email already has an account — try signing in or resetting your password.'
  }

  return m
}
