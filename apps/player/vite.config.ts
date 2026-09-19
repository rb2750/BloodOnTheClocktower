import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.BOTC_PLAYER_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'icon-*.png'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/art/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'character-art',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Ravenswood — Player',
        short_name: 'Ravenswood',
        description:
          'Your character, the script, and your notes. For Blood on the Clocktower. Unofficial and non-commercial.',
        theme_color: '#12151c',
        background_color: '#12151c',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { host: true, port: 5174 },
  preview: { host: true, port: 4174 },
})
