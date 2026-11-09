/**
 * DB row → admin API shape mapping for The Swimsuit Mixer (formerly Bikini
 * Mix). Mirrors the style of server/utils/stockistMappers.js / orderMappers.js.
 */

export const formatBookingNumber = (n) => `BKM-${String(n).padStart(6, '0')}`

export const EVENT_SELECT = `
  id, event_name, event_date, event_date_is_tentative, venue, venue_is_confirmed,
  booking_deadline, cancellation_deadline, capacity, is_bookings_open, promo_video_url,
  promo_video_thumbnail_url,
  regular_price_xcd_cents, early_bird_price_xcd_cents, early_bird_slots, ticket_inclusions,
  hold_minutes, top_size_guide, bottom_size_guide, updated_at
`.trim()

// ── public (customer-facing) shape ───────────────────────────────────────
// Deliberately a SEPARATE select + mapper, not a filtered version of the
// admin one — so it's structurally impossible for a future admin-side field
// addition to leak through here by accident. `capacity` and `hold_minutes`
// are never selected at all (not just omitted from the response); only
// `is_bookings_open` (a boolean) crosses this boundary, never the number
// behind it, matching the brief's "very limited spots, never a count" — the
// same posture now applies to early-bird: `earlyBirdAvailable` is a
// boolean computed by the endpoint, never a remaining-slot count.
export const PUBLIC_EVENT_SELECT = `
  event_name, event_date, event_date_is_tentative, venue, venue_is_confirmed,
  booking_deadline, cancellation_deadline, is_bookings_open, promo_video_url,
  promo_video_thumbnail_url,
  regular_price_xcd_cents, early_bird_price_xcd_cents, early_bird_slots, ticket_inclusions,
  top_size_guide, bottom_size_guide
`.trim()

/**
 * @param earlyBirdAvailable computed by the endpoint, not a column — see
 * PUBLIC_EVENT_SELECT's comment above `early_bird_slots`. Unlike overall
 * event capacity (never sent to the public API, per the brief), the
 * early-bird slot COUNT is deliberately public — the brief's own copy is
 * "Early Bird — EC$225 | Only 3 tickets available", which requires the
 * number itself, not just a boolean. `earlyBirdAvailable` is the boolean
 * that decides whether to show that banner at all; `earlyBirdSlots` is the
 * number inside it once shown.
 * @param earlyBirdRemaining computed by the endpoint from the same
 * read-only count as `earlyBirdAvailable` (see event.get.js) — how many of
 * `earlyBirdSlots` are still unclaimed right now, for "Only N spots left"
 * copy. Same optimistic-hint caveat as `earlyBirdAvailable`: this is an
 * unlocked read, never the authority — only claim_bikini_mix_booking()'s
 * locked count at checkout time decides who actually gets the price.
 */
export function mapPublicEvent(row, earlyBirdAvailable, earlyBirdRemaining) {
  return {
    eventName: row.event_name,
    eventDate: row.event_date,
    eventDateIsTentative: row.event_date_is_tentative,
    venue: row.venue,
    venueIsConfirmed: row.venue_is_confirmed,
    bookingDeadline: row.booking_deadline,
    cancellationDeadline: row.cancellation_deadline,
    isBookingsOpen: row.is_bookings_open,
    promoVideoUrl: row.promo_video_url,
    promoVideoThumbnailUrl: row.promo_video_thumbnail_url,
    regularPriceXcdCents: row.regular_price_xcd_cents,
    earlyBirdPriceXcdCents: row.early_bird_price_xcd_cents,
    earlyBirdSlots: row.early_bird_slots,
    earlyBirdAvailable: !!earlyBirdAvailable,
    earlyBirdRemaining: Math.max(0, Number.isFinite(earlyBirdRemaining) ? earlyBirdRemaining : row.early_bird_slots ?? 0),
    ticketInclusions: row.ticket_inclusions ?? [],
    topSizeGuide: row.top_size_guide ?? [],
    bottomSizeGuide: row.bottom_size_guide ?? []
  }
}

/** A size-guide row is "filled in" once every non-size field is non-empty. */
function rowsComplete(rows) {
  if (!Array.isArray(rows) || !rows.length) return false
  return rows.every((row) =>
    Object.entries(row)
      .filter(([key]) => key !== 'size')
      .every(([, value]) => typeof value === 'string' && value.trim() !== '')
  )
}

export function mapEvent(row) {
  const topSizeGuide = row.top_size_guide ?? []
  const bottomSizeGuide = row.bottom_size_guide ?? []
  return {
    id: row.id,
    eventName: row.event_name,
    eventDate: row.event_date,
    eventDateIsTentative: row.event_date_is_tentative,
    venue: row.venue,
    venueIsConfirmed: row.venue_is_confirmed,
    bookingDeadline: row.booking_deadline,
    cancellationDeadline: row.cancellation_deadline,
    capacity: row.capacity,
    isBookingsOpen: row.is_bookings_open,
    promoVideoUrl: row.promo_video_url,
    promoVideoThumbnailUrl: row.promo_video_thumbnail_url,
    regularPriceXcdCents: row.regular_price_xcd_cents,
    earlyBirdPriceXcdCents: row.early_bird_price_xcd_cents,
    earlyBirdSlots: row.early_bird_slots,
    ticketInclusions: row.ticket_inclusions ?? [],
    holdMinutes: row.hold_minutes,
    topSizeGuide,
    bottomSizeGuide,
    // Launch gate (requirement: "the booking page must not go live until the
    // sizing information is finalized") — computed, not stored, since it
    // only needs checking at launch time, not on every write.
    //
    // Top sizing is intentionally NOT this bust/underbust table — it's the
    // approved fixed cup-size approximation (XS=A, S=B, M=C, L=D, XL=DD),
    // hardcoded as customer-facing copy in components/bikini-mix/customer/
    // StepBuild.vue, not admin-configured data. top_size_guide stays in the
    // schema as optional future detail, but a blank one must never block
    // launch — only the finalized bottom (waist/hip) guide gates it.
    sizeGuideComplete: rowsComplete(bottomSizeGuide),
    updatedAt: row.updated_at
  }
}

export const BIKINI_MIX_FABRIC_SELECT = `
  id, fabric_id, is_active, eligible_for_onepiece, sort_order, created_at,
  fabrics(id, name, slug, type, hex_color, image_url, status, is_active)
`.trim()

export function mapBikiniMixFabric(row) {
  return {
    id: row.id,
    fabricId: row.fabric_id,
    isActive: row.is_active,
    eligibleForOnepiece: row.eligible_for_onepiece === true,
    sortOrder: row.sort_order,
    fabric: row.fabrics
      ? {
          id: row.fabrics.id,
          name: row.fabrics.name,
          slug: row.fabrics.slug,
          type: row.fabrics.type,
          hexColor: row.fabrics.hex_color,
          imageUrl: row.fabrics.image_url,
          status: row.fabrics.status,
          isActive: row.fabrics.is_active
        }
      : null
  }
}

export const BOOKING_LIST_SELECT = `
  id, booking_number, status, hold_expires_at, package, retail_price_xcd_cents, charged_usd_cents,
  garment_type, early_bird_quoted, early_bird_applied, early_bird_mismatch_at,
  full_name, email, whatsapp, paid_at, created_at, is_test
`.trim()

export const BOOKING_DETAIL_SELECT = `
  id, booking_number, status, hold_expires_at, package, retail_price_xcd_cents, charged_usd_cents,
  garment_type, bottom_scrunch,
  top_size, left_fabric_id, left_fabric_name_snapshot, left_fabric_hex_snapshot,
  right_fabric_id, right_fabric_name_snapshot, right_fabric_hex_snapshot,
  bottom_style, bottom_coverage, bottom_size,
  bottom_fabric_id, bottom_fabric_name_snapshot, bottom_fabric_hex_snapshot,
  onepiece_size, onepiece_coverage,
  onepiece_fabric_id, onepiece_fabric_name_snapshot, onepiece_fabric_hex_snapshot,
  bust_inches, underbust_inches, waist_inches, hips_inches,
  early_bird_quoted, early_bird_applied, early_bird_mismatch_at,
  full_name, email, whatsapp, personalization_name, marketing_opt_in, terms_accepted_at,
  payment_provider, go2pay_order_id, payment_id, paid_at, admin_notes,
  paid_email_sent_at, base_prepared_at, is_test, created_at, updated_at
`.trim()

/** 'pending_payment' past its hold is shown as expired — WITHOUT mutating the row. */
function displayStatus(row) {
  if (row.status === 'pending_payment' && row.hold_expires_at && new Date(row.hold_expires_at) < new Date()) {
    return 'expired'
  }
  return row.status
}

export function mapBookingListItem(row) {
  return {
    id: row.id,
    bookingNumber: formatBookingNumber(row.booking_number),
    status: row.status,
    displayStatus: displayStatus(row),
    package: row.package,
    garmentType: row.garment_type,
    retailPriceXcdCents: row.retail_price_xcd_cents,
    chargedUsdCents: row.charged_usd_cents,
    earlyBirdQuoted: row.early_bird_quoted === true,
    earlyBirdApplied: row.early_bird_applied === true,
    earlyBirdMismatch: row.early_bird_mismatch_at != null,
    fullName: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    isTest: row.is_test === true
  }
}

export function mapBookingDetail(row) {
  return {
    id: row.id,
    bookingNumber: formatBookingNumber(row.booking_number),
    status: row.status,
    displayStatus: displayStatus(row),
    package: row.package,
    garmentType: row.garment_type,
    bottomScrunch: row.bottom_scrunch === true,
    retailPriceXcdCents: row.retail_price_xcd_cents,
    chargedUsdCents: row.charged_usd_cents,
    earlyBirdQuoted: row.early_bird_quoted === true,
    earlyBirdApplied: row.early_bird_applied === true,
    earlyBirdMismatchAt: row.early_bird_mismatch_at,
    topSize: row.top_size,
    leftFabricId: row.left_fabric_id,
    leftFabricName: row.left_fabric_name_snapshot,
    leftFabricHex: row.left_fabric_hex_snapshot,
    rightFabricId: row.right_fabric_id,
    rightFabricName: row.right_fabric_name_snapshot,
    rightFabricHex: row.right_fabric_hex_snapshot,
    bottomStyle: row.bottom_style,
    bottomCoverage: row.bottom_coverage,
    bottomSize: row.bottom_size,
    bottomFabricId: row.bottom_fabric_id,
    bottomFabricName: row.bottom_fabric_name_snapshot,
    bottomFabricHex: row.bottom_fabric_hex_snapshot,
    onepieceSize: row.onepiece_size,
    onepieceCoverage: row.onepiece_coverage,
    onepieceFabricId: row.onepiece_fabric_id,
    onepieceFabricName: row.onepiece_fabric_name_snapshot,
    onepieceFabricHex: row.onepiece_fabric_hex_snapshot,
    bustInches: row.bust_inches,
    underbustInches: row.underbust_inches,
    waistInches: row.waist_inches,
    hipsInches: row.hips_inches,
    fullName: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    // Only ever populated on historical 'the_works' bookings — new
    // 'ticket' bookings never collect this (no personalization during
    // registration per the redesign). Kept purely for backward
    // compatibility so old bookings remain fully viewable.
    personalizationName: row.personalization_name,
    marketingOptIn: row.marketing_opt_in,
    termsAcceptedAt: row.terms_accepted_at,
    paymentProvider: row.payment_provider,
    go2payOrderId: row.go2pay_order_id,
    paymentId: row.payment_id,
    paidAt: row.paid_at,
    adminNotes: row.admin_notes,
    paidEmailSentAt: row.paid_email_sent_at,
    basePreparedAt: row.base_prepared_at,
    isTest: row.is_test === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export const GALLERY_IMAGE_SELECT = `
  id, image_url, caption, category, included_in_ticket, sort_order, is_active, created_at
`.trim()

export function mapGalleryImage(row) {
  return {
    id: row.id,
    imageUrl: row.image_url,
    caption: row.caption,
    category: row.category,
    includedInTicket: row.included_in_ticket === true,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at
  }
}
