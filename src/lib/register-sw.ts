/**
 * Registracija Service Workerja za PWA podporo
 * FIX: Samodejna detekcija SW update + reload strani
 * ko je nov SW aktiviran (preprečuje stale cache probleme)
 */

import { logger } from '@/lib/logger'

export function registerServiceWorker() {
  if (typeof window === 'undefined') return // SSR guard
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      logger.info('SW', 'Service Worker registriran', { scope: registration.scope })

      // FIX: Spremljaj za SW posodobitvami
      // Ko se nov SW namesti in aktivira, samodejno osveži stran
      if (registration.waiting) {
        // Nov SW čaka na aktivacijo — pošlji SKIP_WAITING
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        logger.info('SW', 'Nov Service Worker se namešča...')
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nov SW je nameščen — pošlji SKIP_WAITING da takoj aktivira
            newWorker.postMessage({ type: 'SKIP_WAITING' })
            logger.info('SW', 'Nov SW nameščen — pošiljam SKIP_WAITING')
          }
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // Nov SW je aktiviran — osveži stran da naloži sveže JS chunk-e
            logger.info('SW', 'Nov SW aktiviran — osvežujem stran')
            window.location.reload()
          }
        })
      })
    }).catch((err: unknown) => {
      logger.warn('SW', 'Registracija Service Workerja ni uspela', err)
    })

    // FIX: Ko se SW kontrolni spremeni (nov SW prevzame), osveži stran
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      logger.info('SW', 'SW kontrolni spremenjen — osvežujem stran')
      window.location.reload()
    })
  })
}
