self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch listener: fulfills PWA installability requirements
  // without interfering with API calls or Supabase real-time sync.
});

// --------------------------------------------------------------------------
// Web Push
// --------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  // Chrome on Android only grants userVisibleOnly subscriptions, so every push
  // MUST result in a visible notification or the browser penalises the origin.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'קייטרינג טעמא', body: event.data ? event.data.text() : '' };
  }

  const url = payload.url || '/tasks';

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192x192.png',
    // Android draws the badge as the monochrome status-bar icon.
    badge: '/icon-192x192.png',
    dir: 'rtl',
    lang: 'he',
    // Replaces an earlier digest instead of stacking duplicates.
    tag: payload.tag || 'taama-tasks',
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url },
    actions: [{ action: 'open', title: 'פתח משימות' }],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'קייטרינג טעמא', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/tasks';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an already-open tab / PWA window rather than opening another.
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});

// Chrome may rotate a subscription; re-register so the device keeps receiving.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : undefined)
      .then((subscription) =>
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        })
      )
      .catch(() => {})
  );
});
