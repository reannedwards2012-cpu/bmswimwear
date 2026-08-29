// Product data now lives in the internal database (see server/database/ and
// the read-only /api/products endpoints). This file only holds the category
// list used by the UI for tabs, filters and copy.

export const categories = [
  { value: 'tops', label: 'Tops', blurb: 'Triangle, balconette & bralette' },
  { value: 'bottoms', label: 'Bottoms', blurb: 'High-waist, tie-side & cheeky' },
  { value: 'one-piece', label: 'One-Piece', blurb: 'Sculpted, plunging & playful' },
  { value: 'cover-ups', label: 'Cover-Ups', blurb: 'Beach to boardwalk' }
]
