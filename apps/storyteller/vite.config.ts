import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Stamped at build time, shown at the foot of the home screen, so two phones
// can compare numbers across a table and a stale build has nowhere to hide.
const git = (args: string) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}
const BUILD = `${git('rev-list --count HEAD') || '0'} · ${git('rev-parse --short HEAD') || 'dev'}`

// Served from a subpath on GitHub Pages; overridden for local dev and previews.
const base = process.env.BOTC_BASE ?? '/'

export default defineConfig({
  base,
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'prompt',
      // Reloading mid-game would be a disaster, so the app never reloads itself:
      // it raises a toast and lets the Storyteller choose the moment.
      injectRegister: null,
      workbox: {
        // The player companion is a separate app inside this one's scope, so
        // the navigation fallback must not answer for it. Without this, a phone
        // that has opened the Storyteller once is served the Storyteller again
        // when it scans a code.
        navigateFallbackDenylist: [new RegExp(`^${base}player/`)],
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
        theme_color: '#0c0c0d',
        background_color: '#0c0c0d',
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
