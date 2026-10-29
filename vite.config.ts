/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const commit = process.env.VERCEL_GIT_COMMIT_SHA;

export default defineConfig({
  // Shown in «Aspetto» and in the error report (declared in src/types/globals.d.ts).
  define: {
    __APP_VERSION__: JSON.stringify(process.env.MAPPEORA_VERSION_NAME ?? pkg.version + (commit ? '+' + commit.slice(0, 7) : '')),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'MappAmi – mappe concettuali',
        short_name: 'MappAmi',
        description: 'Mappe concettuali semplici, con voce, per bambini con DSA e studenti.',
        lang: 'it',
        dir: 'ltr',
        categories: ['education', 'productivity'],
        prefer_related_applications: false,
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Shown by Chrome's richer install dialog (npm run screenshots).
        screenshots: [
          { src: 'screenshots/narrow-1.webp', sizes: '1080x1920', type: 'image/webp', form_factor: 'narrow', label: 'Un ramo della mappa «La Rivoluzione francese», colorato' },
          { src: 'screenshots/narrow-2.webp', sizes: '1080x1920', type: 'image/webp', form_factor: 'narrow', label: 'Ripassa con «Indovina»: i concetti si scoprono uno alla volta' },
          { src: 'screenshots/wide-1.webp', sizes: '1920x1080', type: 'image/webp', form_factor: 'wide', label: 'La mappa «La Rivoluzione francese», a colori: il ramo «Le fasi»' },
          { src: 'screenshots/wide-2.webp', sizes: '1920x1080', type: 'image/webp', form_factor: 'wide', label: '«Aspetto e voce»: caratteri per la dislessia, anche OpenDyslexic' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,webp}'],
        // The static pages (privacy, crediti, presentazione, installa) are precached and served
        // as themselves; these files must never get the app shell as a navigation
        // fallback (robots.txt and sitemap.xml are not precached at all). Workbox
        // matches path + query, so a shared link like /privacy.html?ref=chat counts too.
        navigateFallbackDenylist: [/^\/robots\.txt(?:\?.*)?$/, /^\/sitemap\.xml(?:\?.*)?$/, /^\/og-image\.png(?:\?.*)?$/, /^\/(?:mappe-concettuali-dsa|privacy|crediti|installa)\.html(?:\?.*)?$/],
        // Only the browser's install dialog fetches them, from the network: not worth precaching for every user.
        globIgnores: ['screenshots/**'],
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
    // e2e/, e2e-csp/ and e2e-visual/ are Playwright suites (npm run test:e2e, test:csp, test:visual), not Vitest's;
    // .claude/ may hold agent worktrees with their own copy of the tests.
    exclude: ['**/node_modules/**', 'e2e/**', 'e2e-csp/**', 'e2e-visual/**', '.claude/**'],
    // The default fork pool crashes its workers on Windows ("Unhandled Errors").
    pool: 'threads',
  },
});
