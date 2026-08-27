export default defineNuxtConfig({
  css: ['~/assets/css/tailwind.css'],
  app: {
    head: {
      title: 'Bahama Mama Swimwear',
      meta: [
        { name: 'description', content: 'Made-to-order swimwear from Grenada — modern, minimal, and crafted for you.' }
      ]
    }
  }
})
