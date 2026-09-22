// Centralized Quantum Service Worker for Scan My Order
// Handles Background Web Push & Notification Click Navigation

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: "Scan My Order",
      body: event.data.text()
    };
  }

  const title = payload.title || "Scan My Order Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/logo.png",
    badge: payload.badge || "/logo.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: payload.data?.type || "smo-notification",
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.data?.url || "/",
      ...payload.data
    }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Broadcast to any open client tabs
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: "PUSH_RECEIVED",
            payload
          });
        }
      })
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url.includes(targetUrl) || targetUrl === "/") {
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
