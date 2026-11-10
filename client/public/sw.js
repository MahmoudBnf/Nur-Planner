// Service worker: the small script the phone keeps installed for the app.
// - Shows notifications sent by the PC (Web Push), even when the app is closed.
// - Keeps a copy of the app's files, so it opens instantly and can say
//   "can't reach your PC" instead of the browser's error page.
// Your data (/api) is never cached: it always comes live from the PC.
const CACHE = 'nur-shell-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/phone-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Pages: fresh from the PC when reachable (so updates arrive), the saved copy otherwise.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('/', copy));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }
  // Built files have a hash in their name, so a saved copy is always right.
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  })));
});

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data?.json() || {}; } catch { m = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Nur Planner', {
    body: m.body || '',
    tag: m.tag,
    icon: '/icons/phone-192.png',
    badge: '/icons/badge-96.png',
    data: { url: m.url || '/' },
    vibrate: [120, 60, 120],
  }));
});

// Tapping a notification opens the app on the right page (or focuses it if open).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => new URL(c.url).origin === location.origin);
    if (open) return open.focus().then((c) => c.navigate(url));
    return self.clients.openWindow(url);
  }));
});
