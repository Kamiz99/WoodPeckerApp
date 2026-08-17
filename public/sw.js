/**
 * Service worker: la app tiene que abrirse en el metro, sin cobertura.
 *
 * - Al instalarse guarda el esqueleto (HTML, manifiesto, iconos) y, leyendo el
 *   propio HTML, también el CSS y el JS de esta versión. Así basta con haberla
 *   abierto una vez.
 * - Navegación: primero la red, con la copia guardada de respaldo. Tras un
 *   despliegue nuevo no se queda pegada una versión antigua.
 * - Resto de recursos: se sirve la copia y se refresca por detrás. Los assets
 *   llevan hash en el nombre, así que una copia nunca queda obsoleta.
 */

const CACHE = 'woodpecker-v4'
const SHELL = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './apple-touch-icon.png']

async function precache() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL).catch(() => {})
  // El HTML nombra el CSS y el JS con hash: los sacamos de ahí para no tener
  // que mantener una lista a mano en cada compilación.
  const html = await cache.match('./', { ignoreVary: true })
  if (!html) return
  const text = await html.clone().text()
  const assets = [...text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])
  await Promise.all(assets.map((url) => cache.add(url).catch(() => {})))
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const offline = () => new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' })

async function navigateHandler(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    // `ignoreVary`: la petición de navegación manda cabeceras distintas a las
    // del `cache.add` de la instalación y, sin esto, no encontraría la copia.
    return (
      (await cache.match(request, { ignoreVary: true })) ||
      (await cache.match('./', { ignoreVary: true })) ||
      (await cache.match('./index.html', { ignoreVary: true })) ||
      offline()
    )
  }
}

async function assetHandler(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) {
    // Refresco en segundo plano, sin bloquear la respuesta.
    fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone())
      })
      .catch(() => {})
    return cached
  }
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return offline()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.mode === 'navigate' ? navigateHandler(request) : assetHandler(request))
})
