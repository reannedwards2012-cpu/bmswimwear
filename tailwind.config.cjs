module.exports = {
  content: [
    './app.vue',
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue'
  ],
  theme: {
    extend: {
      colors: {
        // ── Bahama Mama brand kit ────────────────────────────────
        // PRIMARY  #5A4035  SECONDARY #F2A9B6  ACCENT #E66B45  NEUTRAL #F6E7D8
        // Usage mix: 60% primary · 20% secondary · 10% accent · 10% neutral
        sand: '#FAF2EA', // lifted page background — airier, "island light"
        shell: '#F6E7D8', // brand NEUTRAL — tinted section surfaces
        cream: '#FFFDFA', // near-white warm cards
        blush: {
          DEFAULT: '#F2A9B6', // SECONDARY
          soft: '#F8D3DA',
          deep: '#D98494'
        },
        rose: '#D06B8E', // pink script accent for display headings
        seafoam: '#CFE3DC', // soft aqua — used sparingly for island freshness
        // "ocean" is a generic accent token; repointed to a readable warm
        // terracotta used for eyebrows, links and small accents on cream.
        ocean: {
          DEFAULT: '#A6472A',
          deep: '#7C3520',
          light: '#F2A9B6'
        },
        coral: {
          DEFAULT: '#E66B45', // ACCENT — primary call-to-action
          dark: '#C6512E'
        },
        terracotta: '#E66B45',
        gold: '#C1974A', // harmonised with the logo foil
        ink: '#5A4035', // PRIMARY — body text and dark sections
        brand: '#E66B45' // back-compat alias for any legacy `bg-brand`
      },
      fontFamily: {
        // Brand fonts (Seasons / Garet / Brittany) are commercial and not on
        // Google Fonts. These are close free stand-ins; drop in the licensed
        // faces via @font-face in assets/css/tailwind.css to match exactly.
        display: ['"Playfair Display"', 'Georgia', 'serif'], // ≈ Seasons (headings)
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'], // ≈ Garet (body)
        script: ['Parisienne', 'cursive'] // ≈ Brittany (accent)
      },
      letterSpacing: {
        widest2: '0.22em'
      },
      maxWidth: {
        container: '72rem'
      },
      boxShadow: {
        soft: '0 24px 60px -28px rgba(90, 64, 53, 0.28)',
        card: '0 14px 40px -20px rgba(90, 64, 53, 0.22)'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  },
  plugins: []
}
