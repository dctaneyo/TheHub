const CACHE_NAME = "the-hub-v4";
const API_CACHE_NAME = "the-hub-api-v1";

const CACHEABLE_API_ROUTES = [
  "/api/tasks",
  "/api/locations",
  "/api/arls",
  "/api/leaderboard",
  "/api/location-groups",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/icon-192.png", "/icon-512.png"])
    )
  );
});

self.addEventListener("activate", (event) => {
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

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html") || new Response("Offline", { status: 503 }))
    );
    return;
  }

  if (request.method === "GET" && CACHEABLE_API_ROUTES.some((r) => url.pathname.startsWith(r))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
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

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Background Sync
self.addEventListener("sync", (event) => {
  if (event.tag === "hub-offline-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SYNC_REQUESTED" }));
      })
    );
  }
});

// ── Push notification handling ──
// iOS Safari does NOT support: requireInteraction, actions, vibrate
// Keep options minimal for cross-platform compatibility
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "The Hub", body: event.data.text() || "New notification" };
  }

  const options = {
    body: data.body || "New notification from The Hub",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Dynamic tag so notifications don't silently replace each other
    tag: data.tag || ("hub-" + (data.conversationId || Date.now())),
    renotify: true,
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

  const targetUrl = (event.notification.data && event.notification.data.url) || "/arl?tab=messaging";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl)) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
