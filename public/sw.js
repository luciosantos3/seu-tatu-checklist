// Service worker for the Seu Tatu checklist PWA.
// Caches the static app shell so it opens instantly and works offline;
// API calls always go to the network since the checklist data must stay fresh.

var CACHE_NAME = "seu-tatu-checklist-v1";
var SHELL_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/checklist-data.js",
  "/logo.png",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  // Never cache API calls — always hit the network so data stays current.
  if (url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/.netlify/functions/") === 0) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell: cache-first, falling back to network, then updating the cache.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || networkFetch;
    })
  );
});
