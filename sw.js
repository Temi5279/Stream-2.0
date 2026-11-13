const VERSION = "stream-v2";
const SHELL = ["./", "live/", "discover/", "profile/", "style.css", "pwa.js", "app.js", "watch/", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle our own files. Videos and other sites go straight to the network.
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    // Pages: network first, cached copy when offline
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match("./")))
    );
    return;
  }
  // Movie list: always try the network first so new films show up
  if (url.pathname.endsWith("movies.json")) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  // Styles, scripts, icons: cached copy first
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
