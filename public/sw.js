// Service worker : app installable, page hors-ligne, notifications push + pastille d'icône.
// Pas de cache des données (toujours fraîches et synchronisées iPhone ↔ Mac), sauf le formulaire
// « Nouvelle séance » : gardé pour pouvoir saisir une séance sans réseau (envoyée plus tard par <OutboxSync>).
const CACHE = "fitpulse-v3";
const NEW_WORKOUT = "/workouts/new";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Assets immuables Next : cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }
  // Navigations : réseau, sinon page hors-ligne (ou dernier formulaire de séance connu)
  if (req.mode === "navigate") {
    const isForm = url.pathname === NEW_WORKOUT;
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (isForm && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(NEW_WORKOUT, copy));
          }
          return res;
        })
        .catch(async () => (isForm && (await caches.match(NEW_WORKOUT))) || caches.match(OFFLINE)),
    );
  }
});

// ---------- Notifications push (iOS 16.4+ : app ajoutée à l'écran d'accueil) ----------
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data && e.data.text() };
  }
  const title = data.title || "FitPulse";
  const tasks = [
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  ];
  // Pastille sur l'icône : séances restantes cette semaine
  if (typeof data.badge === "number" && "setAppBadge" in self.navigator) {
    tasks.push(data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
  }
  e.waitUntil(Promise.all(tasks).catch(() => {}));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
