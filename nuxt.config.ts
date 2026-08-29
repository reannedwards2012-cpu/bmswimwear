export default defineNuxtConfig({
  css: ['~/assets/css/tailwind.css'],

  experimental: {
    appManifest: false
  },

  // Nuxt ignores a root postcss.config.*; Tailwind must be wired here.
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },

  // Internal product database — server-side only. The SQLite file lives in
  // .data/ (git-ignored) and is never exposed to the browser; the frontend
  // only ever talks to the read-only /api/products endpoints.

  app: {
    head: {
      title: 'Bahama Mama Swimwear — Made-to-order Caribbean swimwear',
      meta: [
        {
          name: 'description',
          content:
            'Bahama Mama Swimwear — made-to-order and custom swimwear handcrafted in the Caribbean. Confident, feminine, affordable luxury for island days everywhere.'
        },
        { name: 'theme-color', content: '#5A4035' },
        { property: 'og:title', content: 'Bahama Mama Swimwear' },
        {
          property: 'og:description',
          content:
            'Made-to-order and custom Caribbean swimwear. Affordable luxury, designed to fit you.'
        },
        { property: 'og:type', content: 'website' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: ''
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Parisienne&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Poppins:wght@300;400;500;600&display=swap'
        }
      ]
    }
  }
})