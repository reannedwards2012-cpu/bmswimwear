/**
 * Client-held checkout id for a Bikini Mixer booking — mirrors
 * composables/useCheckout.js's fingerprint/sessionStorage pattern.
 *
 * The id regenerates whenever anything that changes the authoritative
 * payable amount or the booking itself changes (package, bikini selections,
 * guest details), so a Go2Pay Payment Request minted for one combination can
 * never be reused to charge another. Reused as-is (same id) across retries
 * of the same combination, which is what makes server/api/bikini-mix/
 * checkout.post.js's claim idempotent on repeat submits.
 */
const STORE_KEY = 'bm-bikini-mix-checkout'

function fingerprint(build, selectedPackage, personalizationName, details) {
  return [
    selectedPackage || '',
    build.topSize,
    build.leftFabricId,
    build.rightFabricId,
    build.bottomStyle,
    build.bottomCoverage,
    build.bottomSize,
    build.bottomFabricId,
    personalizationName || '',
    details.fullName,
    details.email,
    details.whatsapp
  ].join('|')
}

function readStore() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null')
  } catch {
    return null
  }
}

export function useBikiniMixCheckout() {
  function checkoutId(build, selectedPackage, personalizationName, details) {
    const fp = fingerprint(build, selectedPackage, personalizationName, details)
    const stored = readStore()
    if (stored?.id && stored.fp === fp) return stored.id

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    try {
      sessionStorage?.setItem(STORE_KEY, JSON.stringify({ id, fp }))
    } catch {
      /* storage unavailable — id still valid for this request */
    }
    return id
  }

  function readCheckoutId() {
    return readStore()?.id || null
  }

  function clearCheckoutId() {
    try {
      sessionStorage?.removeItem(STORE_KEY)
    } catch {
      /* ignore */
    }
  }

  return { checkoutId, readCheckoutId, clearCheckoutId }
}
