const CACHE_NAME = "the-hub-v3";
const API_CACHE_NAME = "the-hub-api-v1";

// Critical API endpoints to cache for offline access
const CACHEABLE_API_ROUTES = [
  "/api/tasks",
  "/api/locations",
  "/api/arls",
  "/api/leaderboard",
  "/api/location-groups",
];

self.addEventListener("install", (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Only cache static assets — never page URLs that go through middleware redirects
      cache.addAll(["/icon-192.png", "/icon-512.png"])
    )
  );
});

self.addEventListener("activate", (event) => {
  // Clear old caches
  const keepCaches = [CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept navigation requests — let them go straight to the network
  // so middleware redirects work correctly in all browsers (fixes Safari WebKit bug)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html") || new Response("Offline", { status: 503 }))
    );
    return;
  }

  // For cacheable API routes: network-first with cache fallback
  if (request.method === "GET" && CACHEABLE_API_ROUTES.some((r) => url.pathname.startsWith(r))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the fresh response
          const clone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline — serve from cache
          return caches.match(request).then((cached) =>
            cached || new Response(JSON.stringify({ ok: false, error: { code: "OFFLINE", message: "You are offline" } }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
          );
        })
    );
    return;
  }

  // For non-navigation, non-API requests, use cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Background Sync — retry queued actions when back online
self.addEventListener("sync", (event) => {
  if (event.tag === "hub-offline-sync") {
    event.waitUntil(
      // Notify all clients to run their sync logic
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SYNC_REQUESTED" }));
      })
    );
  }
});

// Push notification handling
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "New message in The Hub",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "the-hub-message",
    renotify: true,
    requireInteraction: true,
    actions: [
      {
        action: "open",
        title: "Open",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
    data: {
      url: data.url || "/arl?tab=messaging",
      conversationId: data.conversationId,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "The Hub", options)
  );
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(event.notification.data.url)) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(event.notification.data.url);
    })
  );
});
