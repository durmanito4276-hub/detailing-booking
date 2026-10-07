const CACHE = 'booking-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon.svg'])
  ))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return

// Страницы: сначала сеть, без сети — из кэша
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return r
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

// Картинки и иконки: сначала кэш
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then((hit) =>
        hit || fetch(e.request).then((r) => {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
          return r
        })
      )
    )
  }
})
