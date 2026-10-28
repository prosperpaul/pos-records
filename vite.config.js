import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      // Fonts and icons are cached too, so the app looks right with no data.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        // Basic Latin fonts cover the app's English text. The extra-letter fonts (e.g. for ẹ, ọ, ṣ in
        // Yoruba) are fetched only when such text appears, so they don't need to be stored up front.
        globIgnores: ['**/*-vietnamese-*', '**/*-latin-ext-*', '**/maskable-*', '**/apple-touch-*'],
      },
      manifest: {
        name: 'POS Records',
        short_name: 'POS Records',
        description: 'Track cash, machine balances and profit for your POS stand.',
        theme_color: '#f5f0e6',
        background_color: '#f5f0e6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
