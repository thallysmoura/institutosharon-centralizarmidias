/* Service worker do app Fotos Clínicas — Instituto Sharon.
   Estratégia: rede primeiro para tudo do mesmo domínio, com cache como reserva (funciona offline após a 1ª visita).
   Nunca intercepta a API nem as fotos (outro domínio/porta, dados privados de pacientes). */
const CACHE = 'sharon-fotos-v1';
const SHELL = ['/', '/login', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/img/emblem.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API e fotos ficam fora do cache

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') return (await caches.match('/offline.html')) || Response.error();
        return Response.error();
      }),
  );
});
