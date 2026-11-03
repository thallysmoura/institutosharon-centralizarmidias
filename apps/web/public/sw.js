/* Service worker do app Fotos Clínicas - Instituto Sharon.
   Sem cache de páginas ou dados: tudo vem da rede; só /offline.html fica guardado.
   Nunca intercepta a API nem as fotos (outro domínio/porta, dados privados de pacientes). */
const CACHE = 'sharon-fotos-v4';
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

// Notificações push (avisos do Instituto): mostra a notificação e abre/foca o app ao tocar.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Instituto Sharon', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Instituto Sharon', {
      body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.tag || 'aviso', renotify: true, data: { url: d.url || '/' },
    });
    const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    abertos.forEach((c) => c.postMessage({ tipo: 'notificacao' })); // quem está com o app aberto atualiza o sino
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertos) { if ('focus' in c) { await c.focus(); c.postMessage({ tipo: 'abrir-notificacoes' }); return; } }
    await self.clients.openWindow(url);
  })());
});
