/* ═══════════════════════════════════════════════════════════════════════════
   KEYFRAME SERVICE WORKER — Section 4.2
   Built with vite-plugin-pwa (injectManifest). Workbox replaces
   `self.__WB_MANIFEST` at build time with the revisioned asset list.
   ═══════════════════════════════════════════════════════════════════════════ */

/* eslint-env serviceworker */
/* global self, caches, clients, fetch, Response, URL */

const SW_VERSION = 'keyframe-v1.0.0';
const CACHE_SHELL = `${SW_VERSION}-shell`;
const CACHE_FONTS = `${SW_VERSION}-fonts`;
const CACHE_STATIC = `${SW_VERSION}-static`;

const SHELL_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/* Injected by workbox at build time. Falls back to [] if not injected. */
const WB_MANIFEST = self.__WB_MANIFEST || [];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function isApiRequest(url) {
  return (
    url.hostname === 'r.jina.ai' ||
    url.hostname.endsWith('.r.jina.ai') ||
    url.hostname === 'api.groq.com' ||
    url.hostname.endsWith('.groq.com')
  );
}

function isFontRequest(url) {
  return (
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    /\.woff2?$/i.test(url.pathname)
  );
}

function isStaticAsset(request, url) {
  if (request.destination === 'script' || request.destination === 'style') return true;
  if (request.destination === 'image') return true;
  return /\.(js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname);
}

function offlineApiResponse() {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'No internet connection.',
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/* ── Strategies ────────────────────────────────────────────────────────── */

// NETWORK ONLY — AI responses and scraped content are never cached.
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (err) {
    if (request.headers.get('accept')?.includes('application/json') || isApiRequest(new URL(request.url))) {
      return offlineApiResponse();
    }
    throw err;
  }
}

// CACHE FIRST — long-lived immutable assets and fonts.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: cacheName === CACHE_FONTS });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Opaque cross-origin font responses (status 0) are still cacheable.
      if (response.type === 'opaque' || response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
    }
    return response;
  } catch (err) {
    const fallback = await cache.match(request, { ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
}

// NETWORK FIRST — fresh HTML wins, offline.html when the network fails.
async function networkFirst(request, cacheName, offlineFallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === 'GET') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (offlineFallback) {
      const shell = await caches.open(CACHE_SHELL);
      const offline = await shell.match(offlineFallback);
      if (offline) return offline;
    }
    throw err;
  }
}

/* ── Install / Activate ────────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      const urls = new Set(SHELL_FILES);
      for (const entry of WB_MANIFEST) {
        const url = typeof entry === 'string' ? entry : entry && entry.url;
        if (!url) continue;
        if (url === '/sw.js' || url.endsWith('sw.js')) continue;
        urls.add(url.startsWith('/') || /^https?:/.test(url) ? url : `/${url}`);
      }
      // Individually settled: one bad URL must never break the install.
      await Promise.allSettled(
        [...urls].map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('keyframe-') && !key.startsWith(SW_VERSION))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* ── Fetch routing ─────────────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is intercepted; API POSTs also pass through this handler.
  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1. API calls (Jina, Groq) — NETWORK ONLY, never cached.
  if (isApiRequest(url)) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (request.method !== 'GET') return;

  // 2. Font files — CACHE FIRST, long TTL.
  if (isFontRequest(url)) {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  // 3. HTML navigation — NETWORK FIRST + offline.html fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CACHE_SHELL, '/offline.html'));
    return;
  }

  // 4. Static assets — CACHE FIRST.
  if (isStaticAsset(request, url) && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // 5. Everything else — NETWORK FIRST.
  event.respondWith(networkFirst(request, CACHE_STATIC, '/offline.html'));
});

/* ── Messages ──────────────────────────────────────────────────────────── */

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});
