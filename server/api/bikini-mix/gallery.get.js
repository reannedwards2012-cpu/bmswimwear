/**
 * GET /api/bikini-mix/gallery
 *
 * Public. Active customization-gallery images only, ordered for display.
 * Same real-data-only handling as event.get.js/fabrics.get.js — no mock
 * fallback, 503 reserved for "migration not applied".
 */
import { supabaseAdmin } from '../../utils/supabaseAdmin.js'
import { GALLERY_IMAGE_SELECT, mapGalleryImage } from '../../utils/bikiniMixMappers.js'

export default defineEventHandler(async (event) => {
  try {
    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('bikini_mix_gallery_images')
      .select(GALLERY_IMAGE_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) {
      const notConfigured = error.code === '42P01' || error.code === 'PGRST205'
      if (notConfigured) {
        setResponseStatus(event, 503)
        return { configured: false }
      }
      console.error('[bikini-mix/gallery] query failed:', error.message)
      setResponseStatus(event, 500)
      return { configured: false, error: 'Could not load gallery images.' }
    }

    return { configured: true, images: (data ?? []).map(mapGalleryImage) }
  } catch (err) {
    console.error('[bikini-mix/gallery] unexpected error:', err?.message)
    setResponseStatus(event, 500)
    return { configured: false, error: 'Could not load gallery images.' }
  }
})
