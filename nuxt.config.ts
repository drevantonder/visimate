// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/ui',
    '@nuxt/test-utils',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    '@vueuse/nuxt'
  ],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    googleApiKey: process.env.NUXT_GOOGLE_API_KEY,
    googleProgrammableSearchEngineId: process.env.NUXT_GOOGLE_PROGRAMMABLE_SEARCH_ENGINE_ID,
    dbPath: process.env.NUXT_DB_PATH,
    rateLimit: {
      requests: 5, // Max requests
      interval: 10,  // Interval in seconds
    },
    public: {
      googleApiKey: process.env.NUXT_PUBLIC_GOOGLE_API_KEY,
    }
  }
})