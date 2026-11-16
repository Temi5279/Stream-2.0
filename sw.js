const DL = "stream-downloads"; // downloaded films live here and survive updates
const VERSION = "stream-v24";
const SHELL = ["./", "live/", "discover/", "profile/", "profiles/", "settings/", "downloads/", "style.css", "pwa.js", "app.js", "player.js", "watch/", "movie/", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];

// Pages that need the internet. Offline they show a plain "No internet connection" page.
// Downloaded films are played from the saved copy, including seeking
async function serveDownload(req) {
  const cache = await caches.open(DL);
  const hit = await cache.match(req.url);
  if (!hit) return new Response("Not downloaded", { status: 404 });
  const type = hit.headers.get("Content-Type") || "video/mp4";
  const range = req.headers.get("range");
  if (!range) return hit;
  const blob = await hit.blob(), size = blob.size, m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (!m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
  return new Response(blob.slice(start, end + 1), { status: 206, headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}
const dlMeta = (id) => new URL("__dl/" + id + ".json", self.registration.scope).href;

self.addEventListener("backgroundfetchsuccess", (e) => {
  const bf = e.registration, fid = encodeURIComponent(bf.id.split("~")[0]);
  e.waitUntil((async () => {
    const cache = await caches.open(DL);
    for (const r of await bf.matchAll()) await cache.put(new URL("__dl/" + fid, self.registration.scope).href, await r.responseReady);
    const mr = await cache.match(dlMeta(fid));
    const meta = mr ? await mr.json() : { id: bf.id.split("~")[0] };
    meta.status = "done"; meta.size = bf.downloaded;
    await cache.put(dlMeta(fid), new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
    await e.updateUI({ title: "Download complete" });
  })().catch(async (err) => {
    // Saving the film failed (for example the phone ran out of space): keep a note so the app can say so
    const cache = await caches.open(DL), mr = await cache.match(dlMeta(fid));
    if (mr) { const meta = await mr.json(); meta.status = "failed"; meta.reason = "storage"; await cache.put(dlMeta(fid), new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } })); }
  }));
});
async function markFailed(e) {
  const fid = encodeURIComponent(e.registration.id.split("~")[0]), cache = await caches.open(DL), mr = await cache.match(dlMeta(fid));
  if (!mr) return; // the member already removed it
  const meta = await mr.json(); meta.status = "failed"; meta.reason = e.registration.failureReason || "cancelled";
  await cache.put(dlMeta(fid), new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }));
}
self.addEventListener("backgroundfetchfail", (e) => e.waitUntil(markFailed(e)));
self.addEventListener("backgroundfetchabort", (e) => e.waitUntil(markFailed(e)));
self.addEventListener("backgroundfetchclick", (e) => e.waitUntil(clients.openWindow(new URL("downloads/", self.registration.scope).href)));

const ONLINE_ONLY = /\/(help|privacy|terms|cookies|legal|welcome|signin|signup|check|account)(\/|$)/;
function offlinePage() {
  return new Response('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#040a22"><title>No internet connection</title></head>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;background:radial-gradient(900px 500px at 50% 0,#10299e,#040a22 70%);color:#eaf0ff;font-family:Segoe UI,Roboto,system-ui,sans-serif;padding:24px">' +
    '<div><h1 style="font-size:1.6rem;margin:0 0 10px">No internet connection</h1><p style="color:#94a3d9;margin:0 0 22px">Please try connecting to the internet.</p>' +
    '<button onclick="location.reload()" style="padding:13px 30px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:linear-gradient(180deg,#7f98ff,#1d3fd8);color:#fff;font:inherit;font-weight:700;cursor:pointer">Retry</button></div></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("install", (e) => {
  // Add files one by one so a single missing file can never stop the app from installing
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== DL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle our own files. Videos and other sites go straight to the network.
  // Keep the sign-in and live-TV libraries so they also work offline
  if (req.method === "GET" && url.origin === location.origin && url.pathname.indexOf("/__dl/") > -1 && !/\.json$/.test(url.pathname)) {
    e.respondWith(serveDownload(req));
    return;
  }
  if (req.method === "GET" && /^(www\.gstatic\.com\/firebasejs|cdn\.jsdelivr\.net\/npm\/hls\.js)/.test(url.host + url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (req.mode === "navigate" && ONLINE_ONLY.test(url.pathname)) {
    e.respondWith(fetch(req).catch(() => offlinePage()));
    return;
  }
  if (req.mode === "navigate") {
    // Show the saved page straight away and refresh it in the background, so slow data never freezes a page
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = (await cache.match(req)) || (/\/(watch|movie)\/$/.test(url.pathname) ? await cache.match(req, { ignoreSearch: true }) : null);
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
      if (hit) { try { e.waitUntil(net.catch(() => {})); } catch (err) {} return hit; }
      return net.catch(async () => (await cache.match("./")) || offlinePage());
    })());
    return;
  }
  if (/(movies|channels|epg)\.json$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  // Styles, scripts, icons: cached copy first
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
