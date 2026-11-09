const CACHE_PREFIX = 'wordroom-mobile-offline-';
// Bump when any app shell or vocabulary file changes.
const CACHE_NAME = CACHE_PREFIX + '1';
const base = self.registration.scope;
const home = new URL('./', base);
const index = new URL('index.html', base);
const files = [
  ['./', 'text/html'],
  ['icon.svg', 'image/svg+xml'],
  ['icon-192.png', 'image/png'],
  ['icon-512.png', 'image/png'],
  ['manifest.webmanifest', 'json']
];
const assetUrls = new Set(files.map(([path]) => new URL(path, base).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const entries = await Promise.all(files.map(async ([path, contentType]) => {
      const url = new URL(path, base);
      const response = await fetch(url, { cache: 'reload', redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.includes(contentType)) {
        throw new Error('Could not cache ' + path);
      }
      return [url, response];
    }));
    const cache = await caches.open(CACHE_NAME);
    try {
      await Promise.all(entries.map(([url, response]) => cache.put(url, response)));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const appNavigation = request.mode === 'navigate' && url.origin === home.origin
    && (url.pathname === home.pathname || url.pathname === index.pathname);
  if (!appNavigation && !assetUrls.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(appNavigation ? home : url)) ?? fetch(request);
  })());
});
