export default defineNuxtConfig({
  css: ['~/assets/css/tailwind.css'],

  experimental: {
    appManifest: false
  },

  // Browser-safe Supabase config for Auth (publishable key only — NEVER the
  // secret key, which stays server-only in server/utils/supabaseAdmin.js).
  // Values are inlined from Netlify build env; override at runtime with
  // NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY if needed.
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || ''
    }
  },

  // Nuxt ignores a root postcss.config.*; Tailwind must be wired here.
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {}
    }
  },

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