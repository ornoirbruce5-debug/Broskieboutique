/* sw.js — Service Worker for Burundi Digital Marketboard / Broskie Boutique */
const VERSION = 'v3';
const PRECACHE = `bdm-precache-${VERSION}`;
const RUNTIME = `bdm-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

// Files to precache (HTML, CSS, JS, manifest, icons, placeholders)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/style.css',
  '/main.js',
  '/products.js',
  '/jokes.js',
  '/manifest.json',
  '/placeholder-poster.jpg',
  '/placeholder-bg.mp4',
  '/placeholder-qr.png',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png'
];

// Install — precache all assets
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await cache.addAll(PRECACHE_ASSETS).catch(() => Promise.resolve());
    await self.skipWaiting();
  })());
});

// Activate — cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key.startsWith('bdm-') && key !== PRECACHE && key !== RUNTIME)
          .map(key => caches.delete(key))
    );
  })());
});

// Fetch — strategies per type
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        const cache = await caches.open(RUNTIME);
        cache.put(request, network.clone());
        return network;
      } catch {
        return (await caches.match(OFFLINE_URL)) ||
               (await caches.match('/index.html')) ||
               new Response('You are offline', { status: 503 });
      }
    })());
    return;
  }

  // CSS/JS: stale-while-revalidate
  if (['style', 'script', 'worker'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, `${RUNTIME}-assets`));
    return;
  }

  // Images/icons: cache-first
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, `${RUNTIME}-images`));
    return;
  }

  // Default: try cache, else network
  event.respondWith((async () => {
    const cached = await caches.match(request);
    return cached || fetch(request);
  })());
});

// Helpers
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  return cached || networkPromise;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

// Message handler — allow SKIP_WAITING from page
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
