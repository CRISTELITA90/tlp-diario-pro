const CACHE = 'tlp-pro-v7';

const ASSETS = [
  '/',
  '/index.html',
  '/script.js',
  '/identidad.js',
  '/pulso-sos.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clientes => {
        // Avisamos a las pestanas abiertas de que hay version nueva.
        clientes.forEach(c => c.postMessage({ tipo: 'sw-actualizado', cache: CACHE }));
      })
  );
});

/* Estrategia:
   - El HTML y el codigo (.js) van a RED PRIMERO. Si hay conexion, siempre ves
     la ultima version desplegada; la copia en cache solo entra si fallas red.
     Asi un despliegue nuevo se ve al instante en vez de quedarse congelado.
   - El resto (iconos, manifest, lo que sea) sigue en CACHE PRIMERO, que es
     mas rapido y no cambia casi nunca.
   Esto es lo que fallaba antes: index.html iba de cache primero, asi que la
   app seguia mostrando el codigo antiguo aunque el servidor ya tuviera el nuevo. */

function esCodigo(req) {
  if (req.mode === 'navigate') return true;
  const url = new URL(req.url);
  return url.origin === self.location.origin && /\.(js|json)$/.test(url.pathname);
}

self.addEventListener('fetch', e => {
  const req = e.request;

  if (req.method !== 'GET') return;

  if (esCodigo(req)) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(r => r || fetch(req))
  );
});
