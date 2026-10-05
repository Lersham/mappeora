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

// The native apps bundle their assets: the service worker is only for web/PWA.
if (!isNative()) registerSW({ immediate: true, onNeedReload: updateReady });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
