'use client'

export const SERVICE_WORKER_VERSION = 'kpi-pms-sw-v3'
export const AUTH_SERVICE_WORKER_RESET_KEY = 'kpi-pms-auth-sw-reset'
const CONTROLLER_CHANGE_RELOAD_KEY = 'kpi-pms-sw-controller-reload'
const KNOWN_CACHE_PREFIXES = ['kpi-pms']
const VERSION_REQUEST_TIMEOUT_MS = 1500

export function isKnownServiceWorkerCacheKey(cacheKey: string) {
  return KNOWN_CACHE_PREFIXES.some((prefix) => cacheKey.startsWith(prefix))
}

export async function clearKnownServiceWorkerCaches() {
  if (typeof caches === 'undefined') {
    return
  }

  const cacheKeys = await caches.keys()
  await Promise.all(
    cacheKeys
      .filter((cacheKey) => isKnownServiceWorkerCacheKey(cacheKey))
      .map((cacheKey) => caches.delete(cacheKey))
  )
}

export async function unregisterServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
  return registrations.length
}

export function clearPendingControllerReloadFlag() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(CONTROLLER_CHANGE_RELOAD_KEY)
}

export function bindControllerChangeReload() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => undefined
  }

  const handleControllerChange = () => {
    if (window.sessionStorage.getItem(CONTROLLER_CHANGE_RELOAD_KEY) === '1') {
      return
    }

    window.sessionStorage.setItem(CONTROLLER_CHANGE_RELOAD_KEY, '1')
    console.info('[pwa] Activated updated service worker, reloading the page')
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
  }
}

export async function requestActiveServiceWorkerVersion(timeoutMs = VERSION_REQUEST_TIMEOUT_MS) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || typeof MessageChannel === 'undefined') {
    return null
  }

  const controller = navigator.serviceWorker.controller
  if (!controller) {
    return null
  }

  return new Promise<string | null>((resolve) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => {
      resolve(null)
    }, timeoutMs)

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer)

      const message = event.data
      if (message?.type === 'SW_VERSION' && typeof message.version === 'string') {
        resolve(message.version)
        return
      }

      resolve(null)
    }

    try {
      controller.postMessage({ type: 'GET_VERSION' }, [channel.port2])
    } catch {
      window.clearTimeout(timer)
      resolve(null)
    }
  })
}

export async function recoverAuthServiceWorkerIfNeeded(pathname: string) {
  if (
    typeof window === 'undefined' ||
    process.env.NODE_ENV !== 'production' ||
    !('serviceWorker' in navigator) ||
    !pathname.startsWith('/login')
  ) {
    return false
  }

  const controller = navigator.serviceWorker.controller
  const registrations = await navigator.serviceWorker.getRegistrations()
  const controllerVersion = await requestActiveServiceWorkerVersion()

  if (controllerVersion === SERVICE_WORKER_VERSION) {
    window.sessionStorage.removeItem(AUTH_SERVICE_WORKER_RESET_KEY)
    return false
  }

  const hasScopedRegistration = registrations.some((registration) =>
    registration.scope.startsWith(window.location.origin)
  )

  if (!controller && !hasScopedRegistration) {
    window.sessionStorage.removeItem(AUTH_SERVICE_WORKER_RESET_KEY)
    return false
  }

  if (window.sessionStorage.getItem(AUTH_SERVICE_WORKER_RESET_KEY) === '1') {
    console.warn('[pwa] Auth page is still controlled by an unknown service worker after one recovery attempt')
    return false
  }

  window.sessionStorage.setItem(AUTH_SERVICE_WORKER_RESET_KEY, '1')

  await Promise.all([unregisterServiceWorkers(), clearKnownServiceWorkerCaches()])
  console.info('[pwa] Cleared legacy service worker state before loading the login page again')
  window.location.reload()

  return true
}

export function promoteWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  const activateWaitingWorker = (worker?: ServiceWorker | null) => {
    worker?.postMessage({ type: 'SKIP_WAITING' })
  }

  activateWaitingWorker(registration.waiting)

  const handleUpdateFound = () => {
    const nextWorker = registration.installing
    if (!nextWorker) {
      return
    }

    nextWorker.addEventListener('statechange', () => {
      if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
        activateWaitingWorker(nextWorker)
      }
    })
  }

  registration.addEventListener('updatefound', handleUpdateFound)

  return () => {
    registration.removeEventListener('updatefound', handleUpdateFound)
  }
}
