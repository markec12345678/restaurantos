/**
 * Registracija Service Workerja za PWA podporo
 * FIX: Samodejna detekcija SW update + reload strani
 * ko je nov SW aktiviran (preprečuje stale cache probleme)
 */

import { logger } from '@/lib/logger'

/**
 * QA override za PWA runtime testiranje v dev načinu.
 *
 * Aktivacija (katerikoli pogoj):
 *  1. URL parameter `?pwa=1`  (epizodično — samo trenutni load)
 *  2. `localStorage['__RESTOS_PWA_DEV__'] === '1'`  (trajno, do izklopa)
 *
 * Namen: E2E PWA testi in ročni QA service workerja brez produkcijskega builda
 * (sandbox omejitve: produkcija standalone porabi ~3 GB RAM in sproži OOM).
 * Ostane IZKLUČNO opt-in — navaden dev ostaja zaščiten pred stale chunk-i.
 */
export function isPwaQaOverride(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('pwa') === '1') return true
    return window.localStorage.getItem('__RESTOS_PWA_DEV__') === '1'
  } catch {
    return false
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return // SSR guard
  if (!('serviceWorker' in navigator)) return

  // POMENBNO (QA 2026-09-17, runda 3): SW se registrira SAMO v produkcijski
  // build. V dev načinu Turbopak servira CHUNE z nestabilnimi imeni (src_*.js,
  // ki se OBNOVIJO z istim imenom ob vsaki spremembi) — SW cache-first strategija
  // bi v devu servirala ZASTARELE chune in pokvarila HMR/hitro razhroščevanje.
  // PWA offline ostaja popolnoma funkcionalen v produkcijskem načinu.
  //
  // IZJEMA (QA runda 13): eksplicitni QA override (?pwa=1 / localStorage flag)
  // omogoči registracijo tudi v devu za PWA runtime teste — glej isPwaQaOverride().
  if (process.env.NODE_ENV !== 'production') {
    if (!isPwaQaOverride()) {
      logger.debug('SW', 'Service Worker preskočen (dev način — zaščita pred zastarelmi chunki)')
      return
    }
    logger.warn('SW', 'PWA QA override AKTIVEN — Service Worker se registrira v dev načinu (pričakuj zastarele chune po spremembah kode!)')
  }

  // FIX BUG (QA 2026-09-17, runda 3): prej je bil listener registriran na
  // `window.addEventListener('load', …)`. V Next.js App Router se hidracija
  // pogosto zaključi ŠELE PO `load` dogodku (Turbopack/dev overhead, počasne
  // tablice) → listener NI Nikoli sprožen → Service Worker NI bil registriran
  // → offline način PWA je bil mrtav. Če je load že mimo, registriraj takoj.
  const register = () => {
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
  }

  if (document.readyState === 'complete') {
    // Load event je že mimo (hidracija po load-u) — registriraj takoj
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
