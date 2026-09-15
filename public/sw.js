/*
 * SomaShare service worker — offline-first PWA support.
 *
 * Strategies:
 *  - Navigations            → network-first, fall back to cached shell ("/")
 *  - Static assets          → stale-while-revalidate
 *  - API GETs (vault data)  → network-first, fall back to cached JSON
 *  - Resource downloads     → network-first; every successful download is
 *    mirrored into the DOWNLOADS cache so it can be reopened offline.
 */
const VERSION = "v1";
const SHELL_CACHE = `soma-shell-${VERSION}`;
const DATA_CACHE = `soma-data-${VERSION}`;
const DOWNLOAD_CACHE = "soma-downloads"; // versionless: saved papers survive deploys

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/fonts/SomaSerif-Regular.woff2",
  "/fonts/SomaSerif-SemiBold.woff2",
  "/fonts/SomaSerif-Bold.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url).catch(() => undefined)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE && k !== DOWNLOAD_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Is this request for a stored resource file download? */
function downloadMatch(pathname) {
  return /^\/api\/resources\/[^/]+\/download$/.test(pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    // Chromium quirk: when a fetch listener exists, POSTs with bodies must
    // be answered with respondWith() or they fail — forward them unchanged.
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ---- saved downloads: network-first, mirror into DOWNLOADS cache ----
  if (downloadMatch(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DOWNLOAD_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ??
              new Response(JSON.stringify({ error: "offline and file not saved" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // ---- vault data API: network-first with cache fallback ----
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ??
              new Response(JSON.stringify({ offline: true, error: "offline" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // ---- page navigations: network-first, fallback to shell ----
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/", clone));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // ---- static assets: stale-while-revalidate ----
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
