const CACHE_NAME = "splitfree-v7";
const OFFLINE_URL = "/offline";
// Only public, session-independent files. (Pre-caching "/dashboard" while signed out stored a redirect to
// the login page, which then can't be used to answer a navigation.)
const STATIC_ASSETS = [
  "/offline",
  "/manifest.json",
  "/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install: cache static shell + offline page
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
//  - /api/*          → network-first, fallback cached, fallback null (no offline page for API)
//  - /_next/static/* → cache-first (immutable hashed assets)
//  - pages           → network-first, fallback to cache, then /offline
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network-first. Only successful responses are cached, and the cached
  // copy is used solely as an offline fallback.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ??
            new Response(JSON.stringify({ error: { message: "You are offline" } }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
          );
        })
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

  // Let the browser handle Next.js RSC/prefetch fetches — they share a URL with the HTML
  // page, so caching them here can serve the wrong payload type and defeats Next's router cache.
  if (request.headers.has("RSC") || request.headers.has("Next-Router-Prefetch")) return;
  if (request.mode !== "navigate") return;

  // Pages: network-first. Always show the live page (correct sign-in state, newest deploy); only when the
  // network fails fall back to the last cached copy, then to the offline page. Redirected responses are
  // never cached, so a login redirect can't be replayed in place of a real page.
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        const offlinePage = await caches.match(OFFLINE_URL);
        return offlinePage ?? new Response("Offline", { status: 503 });
      }
    })()
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
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Splitr Pro", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Splitr Pro", {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      data: { url: data.url ?? "/activity" },
      tag: data.tag, // same-type notifications replace each other instead of stacking
      renotify: !!data.tag,
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/dashboard", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      // Reuse an open tab of the app (and send it to the right page) instead of opening another
      const existing = windowClients.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        return "navigate" in existing ? existing.navigate(target) : undefined;
      }
      return clients.openWindow(target);
    })
  );
});
