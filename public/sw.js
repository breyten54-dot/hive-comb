// Minimal app-shell cache. NEVER caches /api/*, /vault/*, or *.json — those must stay live.
// (BUILD-STANDARDS #6: a stale-while-revalidate SW on Stella kept serving the PREVIOUS bundle
// after a deploy; this SW versions its cache name so a redeploy can bust it — bump CACHE below
// on any future shell change.)
const CACHE = "comb-shell-v61";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192-maskable.png",
  "/icon-512-maskable.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // always network, never cached
  if (url.pathname.startsWith("/vault/")) return; // OneDrive files change on disk — always live
  // Live JSON panels (open-todos, eta, meetings, …) — never cache-first
  if (url.pathname.endsWith(".json")) return;
  /* HTML shell: network-first so Opera/PWA never sticks on an old index.html */
  const isShell = e.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.endsWith("/sw.js");
  if (isShell) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && e.request.method === "GET" && url.pathname !== "/sw.js") {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
