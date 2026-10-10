import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/globals.css';

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICE WORKER REGISTRATION — Section 4.4
   The app must never crash if SW registration fails.
   ═══════════════════════════════════════════════════════════════════════════ */
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 60 minutes

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // The dev server serves public/sw.js verbatim (no workbox injection), so we
  // only register in production — devOptions.enabled is false by design.
  if (!import.meta.env.PROD) {
    console.info('[Keyframe] Service worker registration skipped in dev.');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Surface an already-waiting worker (e.g. user returned mid-update).
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent('sw-update-available', { detail: { registration } })
          );
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              window.dispatchEvent(
                new CustomEvent('sw-update-available', {
                  detail: { registration },
                })
              );
            }
          });
        });

        // Poll for a new deployment every 60 minutes.
        setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL);

        // Also check when the tab regains focus, but no more than once a minute.
        let lastFocusCheck = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - lastFocusCheck < 60 * 1000) return;
          lastFocusCheck = Date.now();
          registration.update().catch(() => {});
        });
      })
      .catch((error) => {
        console.warn('[Keyframe] Service worker registration failed:', error);
      });
  });
}

registerServiceWorker();

/* ── Mount ─────────────────────────────────────────────────────────────── */
const container = document.getElementById('root');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
