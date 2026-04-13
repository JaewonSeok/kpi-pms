const SERVICE_WORKER_VERSION = 'kpi-pms-sw-v4'
const STATIC_CACHE_NAME = 'kpi-pms-static-v4'
const CORE_ASSET_PATHS = new Set(['/favicon.ico', '/icon-192.svg', '/icon-512.svg'])
const FULL_BYPASS_PATHS = new Set(['/manifest.webmanifest', '/sw.js'])
const FULL_BYPASS_PATH_PREFIXES = ['/login', '/signin', '/api/auth']
const LEGACY_CACHE_NAMES = new Set(['kpi-pms-v1', 'kpi-pms-static-v2', 'kpi-pms-static-v3'])
const CACHE_PREFIXES = ['kpi-pms']

function isKnownCacheName(cacheName) {
  return LEGACY_CACHE_NAMES.has(cacheName) || CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
}

function isDocumentRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document'
}

function shouldFullyBypassRequest(url) {
  return (
    FULL_BYPASS_PATHS.has(url.pathname) ||
    FULL_BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  )
}

function shouldBypassCache(request, url) {
  return (
    isDocumentRequest(request) ||
    shouldFullyBypassRequest(url) ||
    url.searchParams.has('callbackUrl')
  )
}

function createNoStoreRequest(request) {
  return new Request(request, { cache: 'no-store' })
}

function fetchNetworkOnly(request) {
  return fetch(createNoStoreRequest(request)).catch(() => fetch(request))
}

function logBypass(reason, url) {
  console.info(
    `[sw] bypass ${JSON.stringify({
      reason,
      path: url.pathname,
    })}`
  )
}

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.status === 200 &&
      !response.redirected &&
      !response.headers.get('location')
  )
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

  if (shouldFullyBypassRequest(url)) {
    logBypass('AUTH_OR_SW_BYPASS', url)
    return
  }

  if (shouldBypassCache(event.request, url)) {
    logBypass(isDocumentRequest(event.request) ? 'DOCUMENT_NETWORK_ONLY' : 'CALLBACK_NETWORK_ONLY', url)
    event.respondWith(fetchNetworkOnly(event.request))
    return
  }

  if (!CORE_ASSET_PATHS.has(url.pathname)) {
    return
  }

  event.respondWith(
    fetchNetworkOnly(event.request)
      .then((networkResponse) => {
        if (!isCacheableResponse(networkResponse)) {
          return networkResponse
        }

        const clone = networkResponse.clone()
        caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return networkResponse
      })
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || Response.error()
        })
      )
  )
})
