/**
 * Complimentary invitation codes for The Swimsuit Mixer — generation and
 * hashing. Codes are never stored in plaintext (see the migration's banner
 * comment); only `codeHash()`'s output ever reaches the database.
 */
import { randomBytes, createHmac } from 'node:crypto'

export const INVITATION_CATEGORIES = ['event_assistant', 'giveaway', 'other']

export const CATEGORY_LABELS = {
  event_assistant: 'Event Assistant',
  giveaway: 'Giveaway',
  other: 'Other'
}

// 32-symbol alphabet, no ambiguous characters (0/O, 1/I) — a human can read
// a code aloud or copy it without second-guessing a character. 12 symbols
// from this alphabet is 32^12 (~2^60) possible codes: online guessing is
// infeasible regardless of rate limiting, which is a secondary defense
// here, not the only one.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 12

/** A fresh, human-typeable plaintext code. Never persisted as-is. */
export function generateInvitationCode() {
  const bytes = randomBytes(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  // Grouped for readability (e.g. "ABCD-EFGH-JKLM") — purely cosmetic;
  // hashing normalizes the separators away (see codeHash()).
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`
}

/**
 * HMAC-SHA256, domain-separated from server/utils/inquiryRateLimit.js's
 * ipHash() by a distinct prefix, despite deliberately reusing the same
 * INQUIRY_HASH_SECRET rather than introducing a new env var for this one
 * feature. Case/dash-insensitive so "abcd-efgh-jklm" and "ABCDEFGHJKLM"
 * hash identically — the guest shouldn't have to match the admin's casing.
 * Returns null if the secret isn't configured (fails closed for codes,
 * unlike ipHash's fail-open posture for abuse-detection-only hashing — a
 * misconfigured secret must never silently make every code "invalid").
 */
export function codeHash(code) {
  const secret = process.env.INQUIRY_HASH_SECRET
  if (!secret || typeof code !== 'string') return null
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!normalized) return null
  return createHmac('sha256', secret).update(`invite-code:${normalized}`).digest('hex')
}
