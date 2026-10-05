import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
// React Flow's base styles first, so our theme can override them.
import '@xyflow/react/dist/style.css';
import './styles/theme.css';
import './styles/app.css';
import App from './App';
import { isNative } from './services/platform';
import { updateReady } from './services/pwaUpdate';
import { flushAutosave } from './services/autosave';

// The native apps bundle their assets: the service worker is only for web/PWA.
if (!isNative()) registerSW({ immediate: true, onNeedReload: updateReady });

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
    <App />
  </StrictMode>,
);
