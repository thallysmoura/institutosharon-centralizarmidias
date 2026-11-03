/* Service worker do app Fotos Clínicas - Instituto Sharon.
   Sem cache de páginas ou dados: tudo vem da rede; só /offline.html fica guardado.
   Nunca intercepta a API nem as fotos (outro domínio/porta, dados privados de pacientes). */
const CACHE = 'sharon-fotos-v3';
const SHELL = ['/offline.html', '/icons/icon-192.png'];

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
  if (url.origin !== self.location.origin) return; // API e fotos ficam fora
  if (url.pathname.startsWith('/backend/') || url.pathname.startsWith('/_next/webpack-hmr')) return;
  // Sem cache: sempre a rede. Só a página offline é servida quando não há conexão.
  e.respondWith(
    fetch(req, { cache: 'no-store' }).catch(async () => {
      if (req.mode === 'navigate') return (await caches.match('/offline.html')) || Response.error();
      return Response.error();
    }),
  );
});
