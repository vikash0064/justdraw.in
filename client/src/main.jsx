import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';
import './styles/pages.css';

// ── Auto-recovery for stale dynamic module imports on new deployments ──
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload chunk missing due to new deployment. Reloading with latest bundle...', event);
  window.location.reload();
});

window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Expected a JavaScript-or-Wasm module script') ||
    msg.includes('is not a supported stylesheet MIME type')
  ) {
    const hasReloaded = sessionStorage.getItem('app_chunk_reload');
    if (!hasReloaded) {
      sessionStorage.setItem('app_chunk_reload', '1');
      console.warn('[App] New deploy detected. Auto-reloading page...');
      window.location.reload();
    }
  }
});

// Clear reload lock on successful load
window.addEventListener('load', () => {
  sessionStorage.removeItem('app_chunk_reload');
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
