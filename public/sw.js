const CACHE_NAME = 'attendees-pwa-v2';

// Derive the base path lazily inside event handlers where self.registration is available
function getBase() {
  return self.registration.scope.replace(/\/$/, '');
}

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  const base = getBase();
  const PRECACHE_URLS = [
    base + '/',
    base + '/index.html',
    base + '/manifest.json',
    base + '/icons/icon-192.png',
    base + '/icons/icon-512.png',
  ];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: remove ALL old caches so stale assets never block the new build
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests except those we handle explicitly
  if (url.origin !== self.location.origin) {
    // Network-only for Supabase and other external APIs
    if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
      return; // Let browser handle it natively
    }
    return;
  }

  // Navigation requests (HTML pages) — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of successful navigation responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(getBase() + '/').then(
            (cached) => cached || new Response('<h1>Offline</h1><p>Please check your connection and try again.</p>', {
              headers: { 'Content-Type': 'text/html' },
            })
          )
        )
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts) — stale-while-revalidate
  if (
    url.pathname.match(/\.(js|css|png|svg|ico|woff2?|ttf|eot|jpg|jpeg|gif|webp)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          // Return cached immediately if available, but update in background
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Default: network-first for everything else
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
