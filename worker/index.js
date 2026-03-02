// Custom service worker code injected into next-pwa's generated SW
// This file is compiled and merged by next-pwa via customWorkerDir

// Push notification handling
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // Fallback if payload isn't valid JSON
    data = { title: "The Hub", body: event.data.text() || "New notification" };
  }

  const options = {
    body: data.body || "New notification from The Hub",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Use notification type + ID as tag so different notifications don't replace each other
    tag: data.tag || `hub-${data.conversationId || Date.now()}`,
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
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(targetUrl)) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(targetUrl);
    })
  );
});
