/* ============================================================
   Rendimientos — service worker

   Es lo que permite instalar la app y abrirla sin señal, que es
   como se usa en obra: se guarda una copia de los archivos en el
   aparato la primera vez y de ahí en adelante se sirve de ahí.

   ⚠️ AL CAMBIAR CUALQUIER ARCHIVO DE LA APP, SUBIRLE UNO A CACHE.
   Sin eso, un aparato que ya tenga la app instalada puede seguir
   días con la versión vieja. Ver README.md.
   ============================================================ */
const CACHE = 'rendimientos-v1';

const ARCHIVOS = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'nube.js',
  'excel.js',
  'manifest.webmanifest',
  'icono-192.png',
  'icono-512.png',
  'icono-maskable.png'
];

self.addEventListener('install', e => {
  /* `reload` evita que el propio navegador sirva del caché HTTP una versión
     vieja justo cuando se está armando el caché nuevo. */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(llaves => Promise.all(llaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Supabase nunca se cachea: o hay señal y se sincroniza, o no hay y la app
     sigue con lo que tiene guardado en el aparato. Una respuesta vieja de la
     nube servida desde el caché sería peor que no tener respuesta. */
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  /* Primero la red, y el caché como red de emergencia. Al revés —caché
     primero— la app abriría más rápido pero habría que recargar dos veces
     para ver un cambio, y acá se cambia seguido. */
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.ok){
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
