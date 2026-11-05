/**
 * Client-held checkout id for a Swimsuit Mixer booking — mirrors
 * composables/useCheckout.js's fingerprint/sessionStorage pattern.
 *
 * The id regenerates whenever anything that changes the booking itself
 * changes (garment type, bikini or one-piece selections, scrunch, guest
 * details), so a Go2Pay Payment Request minted for one combination can
 * never be reused to charge another. Reused as-is (same id) across retries
 * of the same combination, which is what makes server/api/bikini-mix/
 * checkout.post.js's claim idempotent on repeat submits. The payable
 * amount itself is never part of the fingerprint — it's decided entirely
 * server-side (regular vs. early-bird), never something the client could
 * influence by including/excluding it here.
 */
const STORE_KEY = 'bm-swimsuit-mixer-checkout'

function fingerprint(build, details) {
  return [
    build.garmentType || '',
    build.topSize,
    build.leftFabricId,
    build.rightFabricId,
    build.bottomStyle,
    build.bottomCoverage,
    build.bottomSize,
    build.bottomFabricId,
    build.bottomScrunch ? '1' : '0',
    build.onepieceSize,
    build.onepieceCoverage,
    build.onepieceFabricId,
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
  function checkoutId(build, details) {
    const fp = fingerprint(build, details)
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
