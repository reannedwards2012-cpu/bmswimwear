// Realistic fixture data for the admin "Swimsuit Mixer" dashboard, used ONLY
// as a local fallback when an admin GET call comes back `configured: false`
// (the Swimsuit Mixer migration hasn't been applied to this database yet —
// see server/utils/bikiniMixMigrationGuard.js). Each admin page reaches for
// this itself; it is never served by any endpoint and never touches the
// network. Shapes match exactly what server/utils/bikiniMixMappers.js's
// mapEvent / mapBikiniMixFabric / mapBookingListItem / mapBookingDetail /
// mapGalleryImage return, so swapping back to the real API once the
// migration lands needs no changes to the pages that consume this.

export function mockEvent() {
  return {
    id: 'default',
    eventName: 'The Swimsuit Mixer by Bahama Mama',
    eventDate: '2026-12-12',
    eventDateIsTentative: false,
    venue: 'The Closet, Grand Anse Shopping Center',
    venueIsConfirmed: true,
    bookingDeadline: '2026-12-05',
    cancellationDeadline: '2026-11-20',
    capacity: 12,
    isBookingsOpen: true,
    promoVideoUrl: null,
    promoVideoThumbnailUrl: null,
    regularPriceXcdCents: 25000,
    earlyBirdPriceXcdCents: 22500,
    earlyBirdSlots: 3,
    compEventAssistantSlots: 2,
    compGiveawaySlots: 1,
    compOtherSlots: 0,
    ticketInclusions: [
      'Your choice of bikini or one-piece swimsuit',
      'Straps included',
      'Up to 6 premium beads',
      'Up to 4 pony beads',
      '1 premium charm',
      '2 basic charms',
      '1 iron-on decal',
      'Up to 20 rhinestones',
      'Wine',
      'Finger foods'
    ],
    holdMinutes: 15,
    topSizeGuide: [
      { size: 'XS', bust: '', underbust: '' },
      { size: 'S', bust: '', underbust: '' },
      { size: 'M', bust: '', underbust: '' },
      { size: 'L', bust: '', underbust: '' },
      { size: 'XL', bust: '', underbust: '' }
    ],
    bottomSizeGuide: [
      { size: 'XS', waist: '24–26', hip: '34–36' },
      { size: 'S', waist: '26–28', hip: '36–38' },
      { size: 'M', waist: '28–30', hip: '38–40' },
      { size: 'L', waist: '30–32', hip: '40–42' },
      { size: 'XL', waist: '32–34', hip: '42–44' }
    ],
    sizeGuideComplete: true,
    updatedAt: new Date().toISOString()
  }
}

// Mirrors the REAL, currently-active fabric inventory (pulled read-only
// from production earlier this project — same 20 fabrics the customer-facing
// preview page uses), so this admin preview's eligibility toggles are
// exercising real names/ids, not placeholder ones.
export function mockFabrics() {
  const rows = [
    { fabricId: 'fd0daacf-b09e-4e31-8285-9b9a83aa09ea', name: 'Abstract Multicolour', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/babee695-45ae-4389-8883-c4a2add593fd.jpg', eligibleForOnepiece: false },
    { fabricId: 'df1f272c-2dd9-4ee5-9a7c-c6fcbc5848a6', name: 'Animal Print', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/7046b779-4f91-4e2c-92e7-deb61a8987a3.jpg', eligibleForOnepiece: false },
    { fabricId: '4a5837ed-b4e6-46c9-ad33-b35a58cccd68', name: 'Baby Blue', hexColor: '#7BC9EF', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: '98f24fde-5b29-45c0-aa00-0406d6139ce4', name: 'Baby Pink', hexColor: '#FFB2C6', imageUrl: null, eligibleForOnepiece: false },
    { fabricId: '4b7ead52-b5af-4604-87e7-198f80ca1e30', name: 'Black', hexColor: '#111111', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: '8250c369-3860-46b5-a470-37ed74b5b901', name: 'Chocolate', hexColor: '#704336', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: 'f2c75d60-3621-472c-83d8-a268bb6aae0f', name: 'Coral', hexColor: '#EF5284', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: '50e4417f-d2b9-42ed-a81f-17b68f71218d', name: 'Fluorescent Green', hexColor: '#7FF22C', imageUrl: null, eligibleForOnepiece: false },
    { fabricId: 'cd17b481-304a-4bc8-b922-23e2de5504bd', name: 'Hot Pink', hexColor: '#F62BAD', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: 'bd7de9e3-4f3f-46d2-9b20-7c9b0244a01d', name: 'Ivory', hexColor: '#F6E7D8', imageUrl: null, eligibleForOnepiece: false },
    { fabricId: '44c6a609-d934-4686-8134-4c98c40b78c5', name: 'Metallic Pineapple', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/5c702b4e-6a11-4307-99b1-a855fcfe6310.webp', eligibleForOnepiece: false },
    { fabricId: '0abaff0d-01aa-4474-9173-e28ff48e862e', name: 'Mosaic Lines', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/711b3dd7-36d5-4a84-b97b-f35d5e795641.jpg', eligibleForOnepiece: true },
    { fabricId: '09470e3e-c7f9-43cc-9fee-a17314b31519', name: 'Polka Dot', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/ce07e15f-5df7-458c-956b-7a1e4b73a7f3.jpg', eligibleForOnepiece: false },
    { fabricId: 'e4f53a7e-1953-4ec9-81aa-12ce23107638', name: 'Red', hexColor: '#D9021F', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', name: 'Royal Blue', hexColor: '#2252E5', imageUrl: null, eligibleForOnepiece: false },
    { fabricId: '82a8ec4b-d654-4700-a06a-8b86c2c9d123', name: 'Teal', hexColor: '#0F9EA8', imageUrl: null, eligibleForOnepiece: false },
    { fabricId: '2715953b-52e5-4a62-b640-4d2f84e4cc16', name: 'Tie-Dye', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/50c81e37-a8e9-4622-9f77-885444c16b10.webp', eligibleForOnepiece: false },
    { fabricId: '03897b58-dc53-4a7e-8016-dedc883f7035', name: 'Tropical Floral', hexColor: null, imageUrl: 'https://judugfcqidaidjyfsesc.supabase.co/storage/v1/object/public/fabric-images/4c3d5675-442c-43db-ac1b-f6046c7c246b.jpg', eligibleForOnepiece: false },
    { fabricId: 'c917f4d4-6c70-4e5d-b8f4-8418fddd194d', name: 'White', hexColor: '#FFFFFF', imageUrl: null, eligibleForOnepiece: true },
    { fabricId: 'bc047091-78dd-4256-934e-ab62dadfcd97', name: 'Yellow', hexColor: '#FFED29', imageUrl: null, eligibleForOnepiece: true }
  ]
  return rows.map((r) => ({
    fabricId: r.fabricId,
    name: r.name,
    slug: r.name.toLowerCase().replace(/\s+/g, '-'),
    type: r.imageUrl ? 'print' : 'solid',
    hexColor: r.hexColor,
    imageUrl: r.imageUrl,
    status: 'available',
    bikiniMixActive: true,
    eligibleForOnepiece: r.eligibleForOnepiece
  }))
}

function swatch(hex) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='${hex}'/></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export function mockGalleryImages() {
  return [
    { id: 'g1', imageUrl: swatch('%23E6397C'), caption: 'Gold chain strap', category: 'strap', includedInTicket: true, sortOrder: 1, isActive: true, createdAt: '2026-10-15T00:00:00Z' },
    { id: 'g2', imageUrl: swatch('%23F3EFE8'), caption: 'Pearl beads', category: 'bead', includedInTicket: true, sortOrder: 2, isActive: true, createdAt: '2026-10-15T00:00:00Z' },
    { id: 'g3', imageUrl: swatch('%2326408B'), caption: 'Shell charm', category: 'charm', includedInTicket: true, sortOrder: 3, isActive: true, createdAt: '2026-10-16T00:00:00Z' },
    { id: 'g4', imageUrl: swatch('%23C1974A'), caption: 'Crystal rhinestones', category: 'rhinestone', includedInTicket: true, sortOrder: 4, isActive: true, createdAt: '2026-10-16T00:00:00Z' },
    { id: 'g5', imageUrl: swatch('%23D98278'), caption: 'Sun iron-on decal', category: 'iron_on', includedInTicket: false, sortOrder: 5, isActive: true, createdAt: '2026-10-17T00:00:00Z' },
    { id: 'g6', imageUrl: swatch('%232A8C82'), caption: 'Finished bikini example', category: 'finished_swimsuit', includedInTicket: true, sortOrder: 6, isActive: true, createdAt: '2026-10-18T00:00:00Z' },
    { id: 'g7', imageUrl: swatch('%23E66B45'), caption: 'Oversized gold charm (not yet approved)', category: 'charm', includedInTicket: false, sortOrder: 7, isActive: false, createdAt: '2026-10-19T00:00:00Z' }
  ]
}

// A handful of bookings covering every status, both garment types, and the
// Early Bird edge cases (applied, quoted-but-lost, and the rare honored-
// at-the-cutoff mismatch) — so every admin view (list, detail, production,
// early-bird status) has something real to show.
// A few bookings have measurements on file, most don't — demonstrates the
// "fully optional, any combination" requirement rather than every row
// looking the same.
const MEASUREMENTS_BY_ID = {
  b1: { bustInches: 36.5, underbustInches: 30, waistInches: 28.5, hipsInches: 39 }, // all four
  b2: { bustInches: null, underbustInches: null, waistInches: 27, hipsInches: 37.5 }, // partial
  b3: { bustInches: 34, underbustInches: 29, waistInches: null, hipsInches: null } // partial
}

export function mockBookings() {
  const raw = [
    {
      id: 'b1', bookingNumber: 'BKM-000001', status: 'confirmed', displayStatus: 'confirmed', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 22500, chargedUsdCents: 8333, earlyBirdQuoted: true, earlyBirdApplied: true, earlyBirdMismatch: false,
      fullName: 'Alicia Baptiste', email: 'alicia@example.com', whatsapp: '+1 473 555 0101', paidAt: '2026-11-01T14:22:00Z', createdAt: '2026-11-01T14:10:00Z', isTest: false,
      bottomScrunch: false, topSize: 'M', leftFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', leftFabricName: 'Royal Blue', leftFabricHex: '#2252E5',
      rightFabricId: 'f2c75d60-3621-472c-83d8-a268bb6aae0f', rightFabricName: 'Coral', rightFabricHex: '#EF5284',
      bottomStyle: 'tie-side', bottomCoverage: 'bikini', bottomSize: 'M', bottomFabricId: '4b7ead52-b5af-4604-87e7-198f80ca1e30', bottomFabricName: 'Black', bottomFabricHex: '#111111',
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: true, termsAcceptedAt: '2026-11-01T14:09:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-1001', paymentId: 'PAY-1001',
      adminNotes: null, paidEmailSentAt: '2026-11-01T14:23:00Z', basePreparedAt: '2026-11-03T09:00:00Z'
    },
    {
      id: 'b2', bookingNumber: 'BKM-000002', status: 'confirmed', displayStatus: 'confirmed', package: 'ticket', garmentType: 'onepiece',
      retailPriceXcdCents: 22500, chargedUsdCents: 8333, earlyBirdQuoted: true, earlyBirdApplied: true, earlyBirdMismatch: false,
      fullName: 'Marisol Charles', email: 'marisol@example.com', whatsapp: '+1 473 555 0102', paidAt: '2026-11-01T16:05:00Z', createdAt: '2026-11-01T15:58:00Z', isTest: false,
      bottomScrunch: false, topSize: null, leftFabricId: null, leftFabricName: null, leftFabricHex: null, rightFabricId: null, rightFabricName: null, rightFabricHex: null,
      bottomStyle: null, bottomCoverage: null, bottomSize: null, bottomFabricId: null, bottomFabricName: null, bottomFabricHex: null,
      onepieceSize: 'S', onepieceCoverage: 'cheeky', onepieceFabricId: 'e4f53a7e-1953-4ec9-81aa-12ce23107638', onepieceFabricName: 'Red', onepieceFabricHex: '#D9021F',
      personalizationName: null, marketingOptIn: false, termsAcceptedAt: '2026-11-01T15:57:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-1002', paymentId: 'PAY-1002',
      adminNotes: null, paidEmailSentAt: '2026-11-01T16:06:00Z', basePreparedAt: null
    },
    {
      id: 'b3', bookingNumber: 'BKM-000003', status: 'confirmed', displayStatus: 'confirmed', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 22500, chargedUsdCents: 8333, earlyBirdQuoted: true, earlyBirdApplied: false, earlyBirdMismatch: true,
      fullName: 'Deja Williams', email: 'deja@example.com', whatsapp: '+1 473 555 0103', paidAt: '2026-11-02T10:40:00Z', createdAt: '2026-11-02T10:12:00Z', isTest: false,
      bottomScrunch: true, topSize: 'L', leftFabricId: 'c917f4d4-6c70-4e5d-b8f4-8418fddd194d', leftFabricName: 'White', leftFabricHex: '#FFFFFF',
      rightFabricId: 'c917f4d4-6c70-4e5d-b8f4-8418fddd194d', rightFabricName: 'White', rightFabricHex: '#FFFFFF',
      bottomStyle: 'classic', bottomCoverage: 'cheeky', bottomSize: 'L', bottomFabricId: 'c917f4d4-6c70-4e5d-b8f4-8418fddd194d', bottomFabricName: 'White', bottomFabricHex: '#FFFFFF',
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: true, termsAcceptedAt: '2026-11-02T10:11:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-1003', paymentId: 'PAY-1003',
      adminNotes: 'Reservation had expired by the time payment cleared; honored as a courtesy per policy.', paidEmailSentAt: '2026-11-02T10:41:00Z', basePreparedAt: null
    },
    {
      id: 'b4', bookingNumber: 'BKM-000004', status: 'pending_payment', displayStatus: 'pending_payment', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 25000, chargedUsdCents: null, earlyBirdQuoted: false, earlyBirdApplied: false, earlyBirdMismatch: false,
      fullName: 'Kimona Phillip', email: 'kimona@example.com', whatsapp: '+1 473 555 0104', paidAt: null, createdAt: '2026-11-04T18:30:00Z', isTest: false,
      bottomScrunch: false, topSize: 'S', leftFabricId: 'cd17b481-304a-4bc8-b922-23e2de5504bd', leftFabricName: 'Hot Pink', leftFabricHex: '#F62BAD',
      rightFabricId: 'bc047091-78dd-4256-934e-ab62dadfcd97', rightFabricName: 'Yellow', rightFabricHex: '#FFED29',
      bottomStyle: 'tie-side', bottomCoverage: 'bikini', bottomSize: 'S', bottomFabricId: 'cd17b481-304a-4bc8-b922-23e2de5504bd', bottomFabricName: 'Hot Pink', bottomFabricHex: '#F62BAD',
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: false, termsAcceptedAt: '2026-11-04T18:29:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-1004', paymentId: null,
      adminNotes: null, paidEmailSentAt: null, basePreparedAt: null
    },
    {
      id: 'b5', bookingNumber: 'BKM-000005', status: 'pending_payment', displayStatus: 'expired', package: 'ticket', garmentType: 'onepiece',
      retailPriceXcdCents: 22500, chargedUsdCents: null, earlyBirdQuoted: true, earlyBirdApplied: false, earlyBirdMismatch: false,
      fullName: 'Renee Joseph', email: 'renee@example.com', whatsapp: '+1 473 555 0105', paidAt: null, createdAt: '2026-10-29T09:00:00Z', isTest: false,
      bottomScrunch: false, topSize: null, leftFabricId: null, leftFabricName: null, leftFabricHex: null, rightFabricId: null, rightFabricName: null, rightFabricHex: null,
      bottomStyle: null, bottomCoverage: null, bottomSize: null, bottomFabricId: null, bottomFabricName: null, bottomFabricHex: null,
      onepieceSize: 'M', onepieceCoverage: 'bikini', onepieceFabricId: '4b7ead52-b5af-4604-87e7-198f80ca1e30', onepieceFabricName: 'Black', onepieceFabricHex: '#111111',
      personalizationName: null, marketingOptIn: false, termsAcceptedAt: '2026-10-29T08:59:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-1005', paymentId: null,
      adminNotes: null, paidEmailSentAt: null, basePreparedAt: null
    },
    {
      id: 'b6', bookingNumber: 'BKM-000006', status: 'paid_needs_review', displayStatus: 'paid_needs_review', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 25000, chargedUsdCents: 9259, earlyBirdQuoted: false, earlyBirdApplied: false, earlyBirdMismatch: false,
      fullName: 'Ola Fletcher', email: 'ola@example.com', whatsapp: '+1 473 555 0106', paidAt: '2026-11-03T20:15:00Z', createdAt: '2026-11-03T20:00:00Z', isTest: false,
      bottomScrunch: false, topSize: 'XL', leftFabricId: '8250c369-3860-46b5-a470-37ed74b5b901', leftFabricName: 'Chocolate', leftFabricHex: '#704336',
      rightFabricId: '8250c369-3860-46b5-a470-37ed74b5b901', rightFabricName: 'Chocolate', rightFabricHex: '#704336',
      bottomStyle: 'classic', bottomCoverage: 'bikini', bottomSize: 'XL', bottomFabricId: '8250c369-3860-46b5-a470-37ed74b5b901', bottomFabricName: 'Chocolate', bottomFabricHex: '#704336',
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: true, termsAcceptedAt: '2026-11-03T19:59:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-1006', paymentId: 'PAY-1006',
      adminNotes: 'Event was already at capacity when this payment cleared — needs manual review/refund decision.', paidEmailSentAt: null, basePreparedAt: null
    },
    {
      id: 'b7', bookingNumber: 'BKM-000007', status: 'cancelled', displayStatus: 'cancelled', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 25000, chargedUsdCents: null, earlyBirdQuoted: false, earlyBirdApplied: false, earlyBirdMismatch: false,
      fullName: 'Ingrid Felix', email: 'ingrid@example.com', whatsapp: '+1 473 555 0107', paidAt: null, createdAt: '2026-10-25T12:00:00Z', isTest: false,
      bottomScrunch: false, topSize: 'M', leftFabricId: null, leftFabricName: null, leftFabricHex: null, rightFabricId: null, rightFabricName: null, rightFabricHex: null,
      bottomStyle: null, bottomCoverage: null, bottomSize: null, bottomFabricId: null, bottomFabricName: null, bottomFabricHex: null,
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: false, termsAcceptedAt: '2026-10-25T11:59:00Z', paymentProvider: null, go2payOrderId: null, paymentId: null,
      adminNotes: 'Customer requested cancellation by email.', paidEmailSentAt: null, basePreparedAt: null
    },
    {
      id: 'b8', bookingNumber: 'BKM-000008', status: 'confirmed', displayStatus: 'confirmed', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 25000, chargedUsdCents: 9259, earlyBirdQuoted: false, earlyBirdApplied: false, earlyBirdMismatch: false,
      fullName: 'Admin Test Run', email: 'test@bahamamama.internal', whatsapp: '+1 473 555 0000', paidAt: '2026-11-04T08:00:00Z', createdAt: '2026-11-04T07:58:00Z', isTest: true,
      bottomScrunch: false, topSize: 'M', leftFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', leftFabricName: 'Royal Blue', leftFabricHex: '#2252E5',
      rightFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', rightFabricName: 'Royal Blue', rightFabricHex: '#2252E5',
      bottomStyle: 'tie-side', bottomCoverage: 'bikini', bottomSize: 'M', bottomFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', bottomFabricName: 'Royal Blue', bottomFabricHex: '#2252E5',
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: false, termsAcceptedAt: '2026-11-04T07:57:00Z', paymentProvider: 'go2pay', go2payOrderId: 'GP-TEST-1', paymentId: 'PAY-TEST-1',
      adminNotes: null, paidEmailSentAt: null, basePreparedAt: null
    },
    {
      id: 'b9', bookingNumber: 'BKM-000009', status: 'confirmed', displayStatus: 'confirmed', package: 'ticket', garmentType: 'bikini',
      retailPriceXcdCents: 0, chargedUsdCents: null, earlyBirdQuoted: false, earlyBirdApplied: false, earlyBirdMismatch: false,
      isComplimentary: true, invitationCategory: 'event_assistant',
      fullName: 'Tanya Mitchell', email: 'tanya@example.com', whatsapp: '+1 473 555 0109', paidAt: '2026-11-05T12:00:00Z', createdAt: '2026-11-05T11:58:00Z', isTest: false,
      bottomScrunch: false, topSize: 'S', leftFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', leftFabricName: 'Royal Blue', leftFabricHex: '#2252E5',
      rightFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', rightFabricName: 'Royal Blue', rightFabricHex: '#2252E5',
      bottomStyle: 'tie-side', bottomCoverage: 'bikini', bottomSize: 'S', bottomFabricId: '66d41852-404e-4dae-8dbd-7e3fd156669d', bottomFabricName: 'Royal Blue', bottomFabricHex: '#2252E5',
      onepieceSize: null, onepieceCoverage: null, onepieceFabricId: null, onepieceFabricName: null, onepieceFabricHex: null,
      personalizationName: null, marketingOptIn: false, termsAcceptedAt: '2026-11-05T11:57:00Z', paymentProvider: 'complimentary', go2payOrderId: null, paymentId: null,
      adminNotes: null, paidEmailSentAt: '2026-11-05T12:01:00Z', basePreparedAt: null
    }
  ]

  return raw.map((b) => ({
    ...b,
    isComplimentary: b.isComplimentary ?? false,
    invitationCategory: b.invitationCategory ?? null,
    earlyBirdMismatchAt: b.earlyBirdMismatch ? '2026-11-02T10:39:00Z' : null,
    updatedAt: b.createdAt,
    bustInches: null,
    underbustInches: null,
    waistInches: null,
    hipsInches: null,
    ...(MEASUREMENTS_BY_ID[b.id] || {})
  }))
}

export function mockInvitationCodes() {
  return [
    { id: 'ic1', category: 'event_assistant', status: 'redeemed', notes: 'for Tanya', redeemedByBookingId: 'b9', redeemedAt: '2026-11-05T12:00:00Z', createdAt: '2026-11-04T09:00:00Z' },
    { id: 'ic2', category: 'event_assistant', status: 'active', notes: null, redeemedByBookingId: null, redeemedAt: null, createdAt: '2026-11-04T09:00:00Z' },
    { id: 'ic3', category: 'giveaway', status: 'active', notes: 'Instagram giveaway winner', redeemedByBookingId: null, redeemedAt: null, createdAt: '2026-11-06T15:00:00Z' }
  ]
}

function groupCount(rows, keyFn) {
  const totals = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    const k = JSON.stringify(key)
    totals.set(k, { ...key, count: (totals.get(k)?.count ?? 0) + 1 })
  }
  return [...totals.values()].sort((a, b) => b.count - a.count)
}

// Same grouping logic as server/api/admin/bikini-mix/production-summary.get.js,
// applied to the mock bookings above (confirmed, non-test only) — so the
// Production tab's cutting totals and checklist are real derived data, not
// a separately hand-written fixture that could drift out of sync.
export function mockProductionSummary() {
  const rows = mockBookings().filter((b) => b.status === 'confirmed' && !b.isTest)
  const bikiniRows = rows.filter((r) => r.garmentType !== 'onepiece')
  const onepieceRows = rows.filter((r) => r.garmentType === 'onepiece')

  const leftTriangles = groupCount(bikiniRows, (r) => ({ colour: r.leftFabricName, size: r.topSize }))
  const rightTriangles = groupCount(bikiniRows, (r) => ({ colour: r.rightFabricName, size: r.topSize }))
  const bottoms = groupCount(bikiniRows, (r) => ({
    style: r.bottomStyle === 'tie-side' ? 'Tie-Side' : 'Classic',
    coverage: r.bottomCoverage === 'cheeky' ? 'Cheeky' : 'Bikini',
    scrunch: r.bottomScrunch ? 'Scrunch' : 'No scrunch',
    size: r.bottomSize,
    colour: r.bottomFabricName
  }))
  const onePieces = groupCount(onepieceRows, (r) => ({
    coverage: r.onepieceCoverage === 'cheeky' ? 'Cheeky' : 'Bikini',
    size: r.onepieceSize,
    colour: r.onepieceFabricName
  }))

  const bookings = rows.map((r) => ({
    id: r.id,
    bookingNumber: r.bookingNumber,
    fullName: r.fullName,
    garmentType: r.garmentType,
    ticketTier: r.earlyBirdApplied ? 'Early Bird' : 'Regular',
    topSize: r.topSize,
    leftFabricName: r.leftFabricName,
    rightFabricName: r.rightFabricName,
    bottomStyle: r.bottomStyle === 'tie-side' ? 'Tie-Side' : 'Classic',
    bottomCoverage: r.bottomCoverage === 'cheeky' ? 'Cheeky' : 'Bikini',
    bottomScrunch: r.bottomScrunch === true,
    bottomSize: r.bottomSize,
    bottomFabricName: r.bottomFabricName,
    onepieceSize: r.onepieceSize,
    onepieceCoverage: r.onepieceCoverage === 'cheeky' ? 'Cheeky' : 'Bikini',
    onepieceFabricName: r.onepieceFabricName,
    basePreparedAt: r.basePreparedAt
  }))

  return { confirmedCount: rows.length, leftTriangles, rightTriangles, bottoms, onePieces, bookings }
}
