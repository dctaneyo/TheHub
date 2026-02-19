const CACHE_NAME = "the-hub-v2";

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
  // Clear old caches (removes the v1 cache that had /, /arl, /login cached)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept navigation requests — let them go straight to the network
  // so middleware redirects work correctly in all browsers (fixes Safari WebKit bug)
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }

  // For non-navigation requests, use cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
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
