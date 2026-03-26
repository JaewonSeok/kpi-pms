const SERVICE_WORKER_VERSION = 'kpi-pms-sw-v3'
const STATIC_CACHE_NAME = 'kpi-pms-static-v3'
const CORE_ASSET_PATHS = new Set(['/favicon.ico', '/manifest.webmanifest', '/icon-192.svg', '/icon-512.svg'])
const AUTH_BYPASS_PATH_PREFIXES = ['/login', '/api/auth']
const LEGACY_CACHE_NAMES = new Set(['kpi-pms-v1', 'kpi-pms-static-v2'])
const CACHE_PREFIXES = ['kpi-pms']

function isKnownCacheName(cacheName) {
  return LEGACY_CACHE_NAMES.has(cacheName) || CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
}

function isDocumentRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document'
}

function isAuthCriticalPath(pathname) {
  return AUTH_BYPASS_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function shouldBypassCache(request, url) {
  return isDocumentRequest(request) || isAuthCriticalPath(url.pathname)
}

function createNoStoreRequest(request) {
  return new Request(request, { cache: 'no-store' })
}

function fetchNetworkOnly(request) {
  return fetch(createNoStoreRequest(request)).catch(() => fetch(request))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(Array.from(CORE_ASSET_PATHS))
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key === STATIC_CACHE_NAME) {
              return Promise.resolve()
            }

            if (isKnownCacheName(key)) {
              return caches.delete(key)
            }

            return Promise.resolve()
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  const message = event.data ?? {}

  if (message.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (message.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({
      type: 'SW_VERSION',
      version: SERVICE_WORKER_VERSION,
      cacheName: STATIC_CACHE_NAME,
    })
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (shouldBypassCache(event.request, url)) {
    event.respondWith(fetchNetworkOnly(event.request))
    return
  }

  if (!CORE_ASSET_PATHS.has(url.pathname)) {
    return
  }

  event.respondWith(
    fetchNetworkOnly(event.request)
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse
        }

        const clone = networkResponse.clone()
        caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return networkResponse
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }

          return caches.match('/manifest.webmanifest')
        })
      )
  )
})
