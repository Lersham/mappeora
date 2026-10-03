/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mappeora – mappe concettuali',
        short_name: 'Mappeora',
        description: 'Mappe concettuali semplici, con voce, per bambini con DSA e studenti.',
        lang: 'it',
        theme_color: '#3b6ea5',
        background_color: '#fdf8ec',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            // Pictograms already used in a map must keep showing offline.
            urlPattern: /^https:\/\/static\.arasaac\.org\/pictograms\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'arasaac-pictograms',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // OCR engine and Italian model (Tesseract.js), downloaded on first use.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:tesseract\.js|tesseract\.js-core|@tesseract\.js-data)@?/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-engine',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fluent Emoji illustrations: previews in the picker (pinned version).
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/gh\/microsoft\/fluentui-emoji@/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'illustrations',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Example maps (public/esempi): fetched on demand, then available offline.
            urlPattern: ({ url }) => url.pathname.includes('/esempi/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'esempi' },
          },
          {
            urlPattern: /^https:\/\/api\.arasaac\.org\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'arasaac-search',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
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
  },
});
