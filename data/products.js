// Placeholder catalogue — no backend yet. The `image` values use picsum.photos
// so nothing ever renders broken; swap each for real brand photography (drop
// files in /public and point `image` at e.g. '/products/sol-one-piece.jpg').

const img = (seed) => `https://picsum.photos/seed/${seed}/900/1125`

export const categories = [
  { value: 'tops', label: 'Tops', blurb: 'Triangle, balconette & bralette' },
  { value: 'bottoms', label: 'Bottoms', blurb: 'High-waist, tie-side & cheeky' },
  { value: 'one-piece', label: 'One-Piece', blurb: 'Sculpted, plunging & playful' },
  { value: 'cover-ups', label: 'Cover-Ups', blurb: 'Beach to boardwalk' }
]

export const products = [
  // ── Tops ──────────────────────────────────────────────
  {
    id: 'sandbar-triangle',
    name: 'Sandbar Triangle Top',
    price: '$88',
    category: 'tops',
    badge: 'Bestseller',
    image: img('bahama-sandbar'),
    description: 'Sliding triangle top with hand-finished gold hardware.'
  },
  {
    id: 'marina-balconette',
    name: 'Marina Balconette Top',
    price: '$98',
    category: 'tops',
    image: img('bahama-marina'),
    description: 'Structured cups and adjustable straps for real support.'
  },
  {
    id: 'reef-bralette',
    name: 'Reef Longline Bralette',
    price: '$92',
    category: 'tops',
    badge: 'New',
    image: img('bahama-reef'),
    description: 'Ribbed longline bralette with a stay-put banded hem.'
  },
  // ── Bottoms ───────────────────────────────────────────
  {
    id: 'palm-highwaist',
    name: 'Palm High-Waist Brief',
    price: '$84',
    category: 'bottoms',
    badge: 'Bestseller',
    image: img('bahama-palm'),
    description: 'Retro high rise with a smoothing bonded waistband.'
  },
  {
    id: 'cove-tie',
    name: 'Cove Tie-Side Bottom',
    price: '$78',
    category: 'bottoms',
    image: img('bahama-cove'),
    description: 'Adjustable tie sides with weighted metal tips.'
  },
  {
    id: 'dune-highleg',
    name: 'Dune High-Leg Brief',
    price: '$80',
    category: 'bottoms',
    image: img('bahama-dune'),
    description: 'High-cut leg and cheeky back for an elongated line.'
  },
  // ── One-Piece ─────────────────────────────────────────
  {
    id: 'sol-one-piece',
    name: 'Sol Scoop-Back One-Piece',
    price: '$148',
    category: 'one-piece',
    badge: 'Bestseller',
    image: img('bahama-sol'),
    description: 'Sculpting scoop back with a clean high leg.'
  },
  {
    id: 'harbour-wrap',
    name: 'Harbour Faux-Wrap One-Piece',
    price: '$158',
    category: 'one-piece',
    image: img('bahama-harbour'),
    description: 'Plunging faux-wrap front with a supportive shelf bra.'
  },
  {
    id: 'lagoon-halter',
    name: 'Lagoon Halter One-Piece',
    price: '$152',
    category: 'one-piece',
    badge: 'New',
    image: img('bahama-lagoon'),
    description: 'High-neck halter with an open back and removable cups.'
  },
  // ── Cover-Ups ─────────────────────────────────────────
  {
    id: 'islander-swimdress',
    name: 'Islander Swim Dress',
    price: '$168',
    category: 'cover-ups',
    badge: 'Custom favourite',
    image: img('bahama-islander'),
    description: 'Swim-to-street dress in quick-dry crepe with side slits.'
  },
  {
    id: 'breeze-kaftan',
    name: 'Breeze Linen Kaftan',
    price: '$188',
    category: 'cover-ups',
    image: img('bahama-breeze'),
    description: 'Floor-length washed linen-blend with a hand-rolled hem.'
  },
  {
    id: 'shoreline-shirt',
    name: 'Shoreline Camp Shirt',
    price: '$128',
    category: 'cover-ups',
    image: img('bahama-shoreline'),
    description: 'Oversized silky camp-collar shirt — beach layer or resort staple.'
  }
]
