/**
 * Safe-field mapping for the admin inquiry API
 * (server/api/admin/inquiries/*). Keeps the exposed shape from drifting
 * between the list and detail endpoints.
 *
 * `admin_notes` is PRIVATE — it is selected only by the detail query and
 * returned only by mapInquiryDetail. It must never be added to the list
 * select/mapper or to any public/customer response (there are none for
 * inquiries — the only public route is the create endpoint, which returns
 * `{ ok: true }` and nothing else).
 *
 * No IP address or user-agent is stored, so none can leak.
 */

// The list never ships the full message body — just a short preview.
export const INQUIRY_LIST_SELECT =
  'id, created_at, first_name, last_name, email, phone, subject, message, status'

export const INQUIRY_DETAIL_SELECT =
  'id, created_at, updated_at, first_name, last_name, email, phone, subject, message, status, admin_notes'

const PREVIEW_MAX = 140

function toPreview(message) {
  const flat = String(message ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX).trimEnd()}…` : flat
}

export function mapInquiryListItem(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    messagePreview: toPreview(row.message),
    status: row.status
  }
}

export function mapInquiryDetail(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminNotes: row.admin_notes ?? null
  }
}
