/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MappAmi – mappe concettuali',
        short_name: 'MappAmi',
        description: 'Mappe concettuali semplici, con voce, per bambini con DSA e studenti.',
        lang: 'it',
        theme_color: '#3b6ea5',
        background_color: '#fdf8ec',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // OCR engine and Italian model (Tesseract.js), downloaded on first use.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:tesseract\.js|tesseract\.js-core|@tesseract\.js-data)@?/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Fluent Emoji illustrations: previews in the picker (pinned version).
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/microsoft\/fluentui-emoji@/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'illustrations',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              // Only real images: a failed download must not stay for a year.
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Example maps (public/esempi): fetched on demand, then available offline.
            urlPattern: ({ url }) => url.pathname.includes('/esempi/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'esempi', expiration: { maxEntries: 50 } },
          },
        ],
      },
    }),
  ],
  build: {
    // elkjs (lazy-loaded auto layout) is a single ~1.4 MB chunk by design.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    // e2e/ is the Playwright suite (npm run test:e2e), not Vitest's.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
