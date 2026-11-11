/**
 * Cross-step booking state for the customer-facing /bikini-mix flow (The
 * Swimsuit Mixer). A Nuxt useState singleton so selections survive
 * navigating between steps (and a refresh, within the same tab).
 *
 * Step order: 1 Experience, 2 Build Your Swimsuit, 3 Your Details,
 * 4 Review & Pay. There is no longer a separate "package" step — a single
 * ticket type has nothing to choose; its price/inclusions are shown on
 * step 4 instead.
 */
function defaultBuild() {
  return {
    garmentType: null, // 'bikini' | 'onepiece' — null until Build step's first choice
    // bikini-only:
    topSize: 'M',
    leftFabricId: null,
    rightFabricId: null,
    bottomStyle: 'tie-side', // 'tie-side' | 'classic'
    bottomSize: 'M',
    bottomCoverage: 'bikini', // 'bikini' | 'cheeky'
    bottomScrunch: false,
    bottomFabricId: null,
    // onepiece-only:
    onepieceSize: 'M',
    onepieceCoverage: 'bikini', // 'bikini' | 'cheeky'
    onepieceFabricId: null
  }
}

const BIKINI_ONLY_DEFAULTS = {
  topSize: 'M',
  leftFabricId: null,
  rightFabricId: null,
  bottomStyle: 'tie-side',
  bottomSize: 'M',
  bottomCoverage: 'bikini',
  bottomScrunch: false,
  bottomFabricId: null
}

const ONEPIECE_ONLY_DEFAULTS = {
  onepieceSize: 'M',
  onepieceCoverage: 'bikini',
  onepieceFabricId: null
}

function defaultDetails() {
  return {
    fullName: '',
    email: '',
    whatsapp: '',
    // Body measurements (Step 3 "Your Measurements") — all optional, kept
    // as strings like every other form field here and converted to
    // numbers/null only at checkout submission time.
    bust: '',
    underbust: '',
    waist: '',
    hips: '',
    // Complimentary invitation code (Step 3) — invitationCode is the raw
    // text the guest typed; invitationCategory is set ONLY once
    // server/api/bikini-mix/invitation-code/check.post.js confirms it's
    // currently valid, and is cleared the instant the code text is edited
    // again (see StepDetails.vue) — it's a UI hint for StepReview, never
    // itself trusted to grant anything. The actual redemption is always
    // re-validated server-side, inside claim_bikini_mix_comp_booking().
    invitationCode: '',
    invitationCategory: null,
    // Honeypot — hidden from real guests, tempting to bots. See
    // components/bikini-mix/customer/StepDetails.vue.
    company: ''
  }
}

export function useBikiniMixBooking() {
  const currentStep = useState('swimsuit-mixer-step', () => 1)
  const build = useState('swimsuit-mixer-build', defaultBuild)
  const details = useState('swimsuit-mixer-details', defaultDetails)
  const marketingOptIn = useState('swimsuit-mixer-marketing-opt-in', () => false)
  const policyAccepted = useState('swimsuit-mixer-policy-accepted', () => false)

  /**
   * Switching garment type clears ONLY the branch being left, back to its
   * defaults — and leaves the branch being entered untouched, so re-
   * entering a branch preserves whatever was previously chosen there.
   * Satisfies both "clear incompatible selections when switching" and
   * "preserve valid selections when navigating backward" at once. A
   * reselect of the already-active type is a no-op (never clears anything).
   */
  function setGarmentType(type) {
    if (build.value.garmentType === type) return
    if (build.value.garmentType === 'bikini') {
      Object.assign(build.value, BIKINI_ONLY_DEFAULTS)
    } else if (build.value.garmentType === 'onepiece') {
      Object.assign(build.value, ONEPIECE_ONLY_DEFAULTS)
    }
    build.value.garmentType = type
  }

  return {
    currentStep,
    build,
    details,
    marketingOptIn,
    policyAccepted,
    setGarmentType
  }
}
