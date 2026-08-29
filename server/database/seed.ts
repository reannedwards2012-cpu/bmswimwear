import type { ProductCategory } from './schema'

export interface ProductSeed {
  id: string
  title: string
  description: string
  priceCents: number
  category: ProductCategory
  imageUrl: string
  stock: number
}

const img = (seed: string) => `https://picsum.photos/seed/${seed}/900/1125`

// 12 mock premium items — 3 per category. Image URLs are placeholders
// (picsum.photos) and will be swapped for brand photography.
export const PRODUCT_SEED: ProductSeed[] = [
  // ── Tops ──────────────────────────────────────────────
  { id: 'sandbar-triangle', title: 'Sandbar Triangle Top', priceCents: 8800, category: 'tops', stock: 24, imageUrl: img('bahama-sandbar'), description: 'Sliding triangle top with hand-finished gold hardware.' },
  { id: 'marina-balconette', title: 'Marina Balconette Top', priceCents: 9800, category: 'tops', stock: 12, imageUrl: img('bahama-marina'), description: 'Structured cups and adjustable straps for real support.' },
  { id: 'reef-bralette', title: 'Reef Longline Bralette', priceCents: 9200, category: 'tops', stock: 3, imageUrl: img('bahama-reef'), description: 'Ribbed longline bralette with a stay-put banded hem.' },

  // ── Bottoms ───────────────────────────────────────────
  { id: 'palm-highwaist', title: 'Palm High-Waist Brief', priceCents: 8400, category: 'bottoms', stock: 26, imageUrl: img('bahama-palm'), description: 'Retro high rise with a smoothing bonded waistband.' },
  { id: 'cove-tie', title: 'Cove Tie-Side Bottom', priceCents: 7800, category: 'bottoms', stock: 18, imageUrl: img('bahama-cove'), description: 'Adjustable tie sides with weighted metal tips.' },
  { id: 'dune-highleg', title: 'Dune High-Leg Brief', priceCents: 8000, category: 'bottoms', stock: 0, imageUrl: img('bahama-dune'), description: 'High-cut leg and cheeky back for an elongated line.' },

  // ── One-Piece ─────────────────────────────────────────
  { id: 'sol-one-piece', title: 'Sol Scoop-Back One-Piece', priceCents: 14800, category: 'one-piece', stock: 14, imageUrl: img('bahama-sol'), description: 'Sculpting scoop back with a clean high leg.' },
  { id: 'harbour-wrap', title: 'Harbour Faux-Wrap One-Piece', priceCents: 15800, category: 'one-piece', stock: 9, imageUrl: img('bahama-harbour'), description: 'Plunging faux-wrap front with a supportive shelf bra.' },
  { id: 'lagoon-halter', title: 'Lagoon Halter One-Piece', priceCents: 15200, category: 'one-piece', stock: 4, imageUrl: img('bahama-lagoon'), description: 'High-neck halter with an open back and removable cups.' },

  // ── Cover-Ups ─────────────────────────────────────────
  { id: 'islander-swimdress', title: 'Islander Swim Dress', priceCents: 16800, category: 'cover-ups', stock: 10, imageUrl: img('bahama-islander'), description: 'Swim-to-street dress in quick-dry crepe with side slits.' },
  { id: 'breeze-kaftan', title: 'Breeze Linen Kaftan', priceCents: 18800, category: 'cover-ups', stock: 7, imageUrl: img('bahama-breeze'), description: 'Floor-length washed linen-blend with a hand-rolled hem.' },
  { id: 'shoreline-shirt', title: 'Shoreline Camp Shirt', priceCents: 12800, category: 'cover-ups', stock: 16, imageUrl: img('bahama-shoreline'), description: 'Oversized silky camp-collar shirt — beach layer or resort staple.' }
]
