/**
 * Registracija Service Workerja za PWA podporo
 * Premaknjeno iz inline skripte v layout.tsx za konsistentno logiranje
 */

import { logger } from '@/lib/logger'

export function registerServiceWorker() {
  if (typeof window === 'undefined') return // SSR guard
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      logger.warn('SW', 'Registracija Service Workerja ni uspela', err)
    })
  })
}
