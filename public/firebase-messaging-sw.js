importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js');

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || payload.notification?.title || 'Site 99';
  const options = {
    body: payload.data?.body || payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { path: payload.data?.path || '/app' },
    tag: payload.data?.eventKey || undefined,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.path || '/app', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find((client) => client.url.startsWith(self.location.origin));
    if (current) { await current.navigate(destination); return current.focus(); }
    return self.clients.openWindow(destination);
  })());
});