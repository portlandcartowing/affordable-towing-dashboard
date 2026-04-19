// ---------------------------------------------------------------------------
// ACT Dispatch Service Worker
//
// Handles push notifications when the app is closed or phone is locked.
// When a push arrives, shows a notification. Tapping the notification
// opens the driver app.
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  let data = { title: "Incoming Call", body: "New call on ACT Dispatch", url: "/driver" };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // Use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "incoming-call",
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      actions: [
        { action: "answer", title: "Answer" },
        { action: "decline", title: "Decline" },
      ],
      data: { url: data.url },
    })
  );
});

// Handle notification click — open the driver app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/driver";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If the app is already open, focus it
      for (const client of clients) {
        if (client.url.includes("/driver") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
