/**
 * sw.js
 * Service Worker de la PWA "Registro de Usuarios".
 *
 * Estrategia: cache-first para el shell de la app (HTML/CSS/JS/manifest/
 * íconos), para que la app abra aunque no haya conexión. Las llamadas a
 * la API (fetch a API_BASE en app.js) NO se cachean aquí: ese flujo ya
 * lo maneja la lógica offline-first con SQLite local en app.js.
 */

const CACHE_NAME = 'usuarios-pwa-v4';

const ARCHIVOS_DEL_SHELL = [
  './',
  './index.html',
  './app.js',
  './estilos.css',
  './manifest.json',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './assets/wasm-v1/sql-wasm.wasm'
];

// ------------------------------------------------------------------
// Instalación: precachea el shell de la app
// ------------------------------------------------------------------
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ARCHIVOS_DEL_SHELL.map((url) =>
          fetch(url, { cache: 'reload' }).then((respuesta) => cache.put(url, respuesta))
        )
      )
    )
  );
  self.skipWaiting();
});

// ------------------------------------------------------------------
// Activación: limpia caches de versiones anteriores
// ------------------------------------------------------------------
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

// ------------------------------------------------------------------
// Fetch: cache-first para el shell; deja pasar todo lo demás
// (incluyendo las peticiones a la API del backend) directo a la red.
// ------------------------------------------------------------------
self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // No interceptar peticiones a la API (otro origen/puerto: backend)
  if (url.port === '3000' || url.pathname.startsWith('/api')) {
    return;
  }

  // Solo interceptar peticiones GET propias del shell
  if (evento.request.method !== 'GET') {
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respuestaCache) => {
      if (respuestaCache) {
        return respuestaCache;
      }

      return fetch(evento.request)
        .then((respuestaRed) => {
          // Guarda copia en cache para la próxima vez que esté offline
          const copia = respuestaRed.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, copia));
          return respuestaRed;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
