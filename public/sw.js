// =====================================================================
//  SERVICE WORKER JUSTICIAFÁCIL
//  - Muestra notificaciones (push) VIBRANDO y pegadas en la barra,
//    con vibración MÁS FUERTE/LARGA cuando son importantes
//    (validaciones, firmas pendientes).
//  - SOLO guarda la portada para abrir sin internet (network-first).
// =====================================================================
const CACHE = "justiciafacil-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    try { const c = await caches.open(CACHE); await c.add("/"); } catch {}
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode !== "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      try { return await fetch(req); }
      catch {
        const cached = await caches.match("/");
        return cached || Response.error();
      }
    })()
  );
});

// ===== NOTIFICACIONES (Web Push) =====
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "JusticiaFácil";
  const body = data.body || "Tienes un aviso nuevo";
  const url = data.url || "/";
  const importante = !!data.importante;

  // Importante (validación/firma pendiente): vibración larga y repetida,
  // como timbre, al máximo — para que no se pase por alto.
  // Normal (tarea, aviso de calendario): vibración corta, una sola vez.
  const vibrate = importante
    ? [400, 200, 400, 200, 400, 200, 400, 200, 400]
    : [200, 100, 200];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || (importante ? "importante" : "aviso"),
      renotify: true,
      requireInteraction: importante,
      vibrate,
      data: { url },
      actions: [{ action: "abrir", title: "Abrir" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try { await c.focus(); if ("navigate" in c) await c.navigate(url); return; } catch {}
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});
