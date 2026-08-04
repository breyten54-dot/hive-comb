// Minimal app-shell cache. NEVER caches /api/* — that data must always be live.
// (BUILD-STANDARDS #6: a stale-while-revalidate SW on Stella kept serving the PREVIOUS bundle
// after a deploy; this SW versions its cache name so a redeploy can bust it — bump CACHE below
// on any future shell change.)
const CACHE = "comb-shell-v11";
const SHELL = ["/", "/manifest.webmanifest", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // always network, never cached
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
