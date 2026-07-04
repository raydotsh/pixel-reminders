const CACHE_NAME = 'pixel-companion-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Ignore failures to cache dynamically generated bundles
      return cache.addAll(ASSETS).catch(err => console.log('Asset caching warning:', err));
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Let the browser handle standard requests normally, only fallback to cache if offline
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});

// Push Notification Listener (for mobile background reminders when closed)
self.addEventListener('push', (event) => {
  let data = { title: 'Pixel Companion', body: 'Time for your goals!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Pixel Companion', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'icon-512.png',
    badge: 'icon-512.png',
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
