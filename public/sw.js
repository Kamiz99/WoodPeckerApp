/**
 * Service worker mínimo: cachea al vuelo lo que se va usando (stale-while-revalidate)
 * para poder entrenar sin conexión después de la primera visita.
 */

const CACHE = 'woodpecker-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)

      if (cached) {
        event.waitUntil(network.catch(() => undefined))
        return cached
      }

      // Navegación sin red y sin caché: devolvemos el index cacheado si existe.
      return network.catch(async () => {
        if (request.mode === 'navigate') {
          const index = await cache.match('./index.html')
          if (index) return index
        }
        return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' })
      })
    }),
  )
})
