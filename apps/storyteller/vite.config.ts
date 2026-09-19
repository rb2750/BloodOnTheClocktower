import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from a subpath on GitHub Pages; overridden for local dev and previews.
const base = process.env.BOTC_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      // Reloading mid-game would be a disaster, so the app never reloads itself:
      // it raises a toast and lets the Storyteller choose the moment.
      injectRegister: null,
      workbox: {
        // The shell, fonts and icons are precached so the app boots offline.
        // Character art is ~8MB across 355 files, which would make the first
        // install painfully slow, so it is cached on demand instead: a game
        // touches perhaps 25 characters, and the token falls back to initials
        // for anything not yet cached.
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
        name: 'Grimoire — Storyteller',
        short_name: 'Grimoire',
        description:
          'A Storyteller companion for Blood on the Clocktower. Unofficial and non-commercial.',
        theme_color: '#0b0d12',
        background_color: '#0b0d12',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
