/* AI škola – service worker
 * Offline aplikácia: shell sa cacheuje pri prvej návšteve,
 * ďalej cache-first pre statické súbory a network-first pre navigáciu.
 *
 * Pri každej novej verzii sa CACHE_NAME zmení, takže `activate` zmaže
 * všetky staré cache a prevezme kontrolu nad otvorenými oknami.
 */
const CURRENT_CACHE_NAME = 'ai-skola-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CURRENT_CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

// Odstránenie starých verzií cache + okamžité prevzatie otvorených okien.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CURRENT_CACHE_NAME) {
              return caches.delete(cache)
            }
            return undefined
          }),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigácia: najprv sieť, fallback na uložený shell (offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CURRENT_CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Ostatné súbory (hashed assety, ikony): cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CURRENT_CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
