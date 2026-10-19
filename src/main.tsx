import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
// React Flow's base styles first, so our theme can override them.
import '@xyflow/react/dist/style.css';
import './styles/theme.css';
import './styles/app.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isNative } from './services/platform';
import { updateReady } from './services/pwaUpdate';
import { flushAutosave } from './services/autosave';
import { logError } from './services/errorLog';

// What breaks is kept on this device only (see services/errorLog.ts): the child can copy it for whoever helps.
window.addEventListener('error', (e) => {
  // The browser's own note about a layout that took two frames: nothing broke.
  if (/^ResizeObserver loop/.test(e.message)) return;
  logError(e.error ?? e.message, 'window');
});
window.addEventListener('unhandledrejection', (e) => logError(e.reason, 'promise'));

// The native apps bundle their assets: the service worker is only for web/PWA.
if (!isNative()) {
  registerSW({
    immediate: true,
    onNeedReload: updateReady,
    // An installed app is resumed, not reopened: the browser would not look
    // for a new version for days. Look each time it comes back, and hourly.
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      const check = () => void registration.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  // The maps live only in this browser: ask it not to delete them when the
  // phone runs out of space (Chrome and Safari decide on their own, Firefox asks).
  void navigator.storage?.persisted?.().then((done) => done || navigator.storage.persist()).catch(() => {});
}

// A part loaded later (Riordina, PDF…) belongs to an older version that is
// gone: only the new version has it. Save, then load the new version.
window.addEventListener('vite:preloadError', () => {
  try {
    // Once: if the new version fails too, reloading again would not help.
    if (!navigator.onLine || sessionStorage.getItem('mappeora-reloaded')) return;
    sessionStorage.setItem('mappeora-reloaded', '1');
  } catch {
    return;
  }
  void flushAutosave().then(() => location.reload());
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outside the one in App: a crash in App's own hooks must not leave a blank page. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// It booted: the next failure of a part loaded later may recover again (an
// installed app stays open for days). Not at once, so a failure that comes
// with every start cannot reload in a loop.
setTimeout(() => {
  try {
    sessionStorage.removeItem('mappeora-reloaded');
  } catch {
    // Blocked: nothing was set either.
  }
}, 10_000);
