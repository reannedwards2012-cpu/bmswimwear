/**
 * Cross-step booking state for the customer-facing /bikini-mix flow.
 * A Nuxt useState singleton so selections survive navigating between steps
 * (and a refresh, within the same tab).
 *
 * Step order: 1 Invitation, 2 Build Your Bikini, 3 Your Details,
 * 4 Choose Your Package, 5 Review & Pay.
 */
function defaultBuild() {
  return {
    topSize: 'M',
    bottomSize: 'M',
    leftFabricId: null,
    rightFabricId: null,
    bottomFabricId: null,
    bottomStyle: 'tie-side', // 'tie-side' | 'classic'
    bottomCoverage: 'bikini' // 'bikini' | 'cheeky'
  }
}

function defaultDetails() {
  return {
    fullName: '',
    email: '',
    whatsapp: ''
  }
}

export function useBikiniMixBooking() {
  const currentStep = useState('bikini-mix-step', () => 1)
  const build = useState('bikini-mix-build', defaultBuild)
  const details = useState('bikini-mix-details', defaultDetails)
  const selectedPackage = useState('bikini-mix-package', () => null) // 'classic_mix' | 'the_works' | null
  const personalizationName = useState('bikini-mix-personalization', () => '')
  const marketingOptIn = useState('bikini-mix-marketing-opt-in', () => false)
  const policyAccepted = useState('bikini-mix-policy-accepted', () => false)

  function selectPackage(pkg) {
    selectedPackage.value = pkg
  }

  return {
    currentStep,
    build,
    details,
    selectedPackage,
    personalizationName,
    marketingOptIn,
    policyAccepted,
    selectPackage
  }
}
