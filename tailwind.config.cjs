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
        sand: '#F6E7D8', // NEUTRAL — page background
        shell: '#EFDFCF', // slightly deeper neutral for alternating surfaces
        cream: '#FBF4EC', // lifted neutral for cards on tinted sections
        blush: {
          DEFAULT: '#F2A9B6', // SECONDARY
          soft: '#F8CDD5',
          deep: '#D98494'
        },
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
      }
    }
  },
  plugins: []
}
