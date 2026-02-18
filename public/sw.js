const CACHE_NAME = "the-hub-v1";
const urlsToCache = ["/", "/arl", "/login", "/api/health"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
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
