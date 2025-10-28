const CACHE_NAME = "myapp-cache-v1";
const urlsToCache = [
  "/music/",
  "/music/index.html",
  "/music/style.css",
  "/music/script.js",
  "/music/images/icon-192.png",
  "/music/images/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
