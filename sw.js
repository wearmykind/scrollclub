/* Service worker Scroll Club Content Plan — cuma ngurusin push notification,
   tidak melakukan caching apa pun (semua data tetap online-only lewat Supabase). */

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'Scroll Club', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'Scroll Club';
  const options = {
    body: data.body || '',
    tag: data.content_id ? ('content-' + data.content_id) : undefined,
    data: { content_id: data.content_id || null },
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const contentId = event.notification.data && event.notification.data.content_id;
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'notification-click', contentId });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow('./');
  })());
});
