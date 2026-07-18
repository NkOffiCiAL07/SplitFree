const CACHE_NAME = "splitfree-v3";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install: cache static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - /api/*  → network-first (fresh data), fallback cached if offline
//  - _next/static/* → cache-first (immutable hashed assets)
//  - everything else → stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            return response;
          })
      )
    );
    return;
  }

  // Pages: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached || networkFetch;
      })
    )
  );
});

// Background sync: retry failed mutations when back online
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-expenses") {
    event.waitUntil(syncPendingExpenses());
  }
});

async function syncPendingExpenses() {
  // Placeholder for future offline mutation queue
}

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "SplitFree", {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      data: { url: data.url ?? "/activity" },
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === targetUrl);
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
