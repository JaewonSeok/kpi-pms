'use client'

import { useEffect } from 'react'
import {
  bindControllerChangeReload,
  clearKnownServiceWorkerCaches,
  clearPendingControllerReloadFlag,
  promoteWaitingServiceWorker,
  recoverAuthServiceWorkerIfNeeded,
  unregisterServiceWorkers,
} from '@/lib/pwa-service-worker'

async function disableServiceWorkerCaching() {
  await Promise.all([unregisterServiceWorkers(), clearKnownServiceWorkerCaches()])
}

export function PWARegister({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    let cancelled = false
    let releaseWaitingWorkerListener: () => void = () => {}
    const releaseControllerChangeReload = bindControllerChangeReload()

    clearPendingControllerReloadFlag()

    const registerServiceWorker = async () => {
      if (!enabled || process.env.NODE_ENV !== 'production') {
        await disableServiceWorkerCaching()
        console.info('[pwa] Skipping service worker registration', {
          enabled,
          nodeEnv: process.env.NODE_ENV,
        })
        return
      }

      const recoveredAuthPage = await recoverAuthServiceWorkerIfNeeded(window.location.pathname)
      if (cancelled || recoveredAuthPage) {
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      })

      releaseWaitingWorkerListener = promoteWaitingServiceWorker(registration)
      await registration.update()
    }

    registerServiceWorker().catch((error) => {
      console.error('Service worker registration failed', error)
    })

    return () => {
      cancelled = true
      releaseWaitingWorkerListener()
      releaseControllerChangeReload()
    }
  }, [enabled])

  return null
}
