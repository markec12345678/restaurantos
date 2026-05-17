// ============================================
// RESTAURANTOS POS — SERVICE WORKER
// PWA offline podpora z inteligentnim predpomnjenjem
// Strategija: Cache-first za statiko, Network-first za API
// FIX MEDIUM: Cache version auto-incremented — change version when deploying
// ============================================

const CACHE_VERSION = 'v5' // Increment this when deploying new code
const CACHE_NAME = `restos-pos-${CACHE_VERSION}`
const STATIC_CACHE = `restos-static-${CACHE_VERSION}`
const API_CACHE = `restos-api-${CACHE_VERSION}`
const IMAGE_CACHE = `restos-images-${CACHE_VERSION}`

// Maksimalna starost cache vnosa v ms (5 minut za API)
const API_CACHE_TTL = 5 * 60 * 1000
// Maksimalna starost slik (24 ur)
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000

// Statični viri za cache-first strategijo
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// API poti, ki jih predpomnimo (network-first z fallbackom)
const CACHEABLE_API_PATTERNS = [
  /\/api\/menus/,
  /\/api\/menu-items/,
  /\/api\/categories/,
  /\/api\/tables/,
  /\/api\/settings/,
  /\/api\/employees/,
  /\/api\/inventory(\?|$)/,
  /\/api\/dashboard/,
  // FIX MEDIUM: Dodaj manjkajoče API vzorce za offline podporo
  /\/api\/qr-menu/,
  /\/api\/modifier-groups/,
  /\/api\/discounts/,
  /\/api\/happy-hour/,
  /\/api\/suppliers/,         // FIX HIGH: Dobavitelji za offline naročanje
  /\/api\/reservations/,      // FIX HIGH: Rezervacije za offline ogled
  /\/api\/guests/,            // FIX HIGH: Gosti CRM za offline dostop
  /\/api\/dining-options/,    // FIX MEDIUM: Jedilne opcije za offline
  /\/api\/revenue-centers/,   // FIX MEDIUM: Poslovni prostori za offline
  /\/api\/tax-rates/,         // FIX MEDIUM: Davčne stopnje za offline
]

// API poti, ki jih NIKOLI ne predpomnimo
const NO_CACHE_API_PATTERNS = [
  /\/api\/orders\/.*\/(pay|fiscal|void|storno)/,
  /\/api\/furs/,
  /\/api\/print/,
  /\/api\/payments/,
  /\/api\/cash-register/,  // FIX HIGH: Ujame POST /api/cash-register (odpiranje) in PUT /api/cash-register/[id] (zapiranje)
  /\/api\/inventory\/restock/,
  /\/api\/inventory\/transactions/,
  /\/api\/inventory\/adjust/,
  /\/api\/auth/,
  /\/api\/seed/,
  /\/api\/reports/,          // FIX LOW: Poročila so vedno sveža — ne predpomni
  /\/api\/ai/,               // FIX LOW: AI končne točke ne predpomni
  /\/api\/audit/,            // FIX LOW: Revizijski dnevnik ne sme biti predpomnjen
  /\/api\/ws-broadcast/,     // FIX LOW: WebSocket broadcast ni cache-predmet
]

// ============================================
// INSTALL — Predpomni statiko
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // FIX: Predpomni vsak vir posebej — če eden odpove, ostali še vedno delujejo
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset)
        } catch (err) {
          console.warn('[SW] Napaka pri predpomnjenju:', asset, err)
        }
      }
    })
  )
  // Aktiviraj takoj, ne čakaj na zaprtje starega SW
  self.skipWaiting()
})

// ============================================
// ACTIVATE — Počisti stare cache
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => ![CACHE_NAME, STATIC_CACHE, API_CACHE, IMAGE_CACHE].includes(name))
          .map((name) => caches.delete(name))
      )
    })
  )
  // Prevzemi nadzor nad vsemi odjemalci takoj
  event.waitUntil(self.clients.claim())
})

// ============================================
// FETCH — Usmerjevanje zahtevkov
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignoriraj non-GET zahtevke za cache
  if (request.method !== 'GET') return

  // Ignoriraj chrome-extension in druge non-http zahtevke
  if (!url.protocol.startsWith('http')) return

  // ROUTING:
  if (url.pathname.startsWith('/api/')) {
    // Preveri, ali je ta API na črnem seznamu
    if (NO_CACHE_API_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      return // Ne predpomni občutljivih API-jev
    }

    // Preveri, ali je ta API predpomnljiv
    if (CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      event.respondWith(networkFirstWithCache(request, API_CACHE, API_CACHE_TTL))
      return
    }

    // Ostali API-ji — samo network
    return
  }

  // Slike
  if (request.destination === 'image') {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE, IMAGE_CACHE_TTL))
    return
  }

  // Statični viri (JS, CSS s hash v imenu)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE))
    return
  }

  // HTML strani — Network-first za najnovejšo verzijo
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE, 0)) // 0 = ne cache HTML
    return
  }
})

// ============================================
// STRATEGIJE PREDPOMNJENJA
// ============================================

/**
 * Network-first: Poskusi omrežje, fallback na cache
 * @param maxAge Maksimalna starost cache vnosa v ms (0 = ne predpomni)
 */
async function networkFirstWithCache(request, cacheName, maxAge = API_CACHE_TTL) {
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok && maxAge > 0) {
      // Shrani v cache z timestampom za offline uporabo
      const cache = await caches.open(cacheName)
      const responseToCache = networkResponse.clone()
      // Dodaj timestamp header za TTL preverjanje
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cache-timestamp', Date.now().toString())
      const body = await responseToCache.blob()
      const cachedResponse = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      })
      // FIX: Počakaj na cache.put — prepreči unhandled rejection
      await cache.put(request, cachedResponse)
    }

    return networkResponse
  } catch {
    // Omrežje ni na voljo — poskusi cache
    // FIX: Uporabi { cacheName } namesto iskanja po vseh cache-jih
    const cachedResponse = await caches.match(request, { cacheName })
    if (cachedResponse) {
      // Preveri TTL — ne vrni odcelega cache-ja
      const cacheTimestamp = parseInt(cachedResponse.headers.get('sw-cache-timestamp') || '0')
      if (maxAge > 0 && cacheTimestamp && (Date.now() - cacheTimestamp) > maxAge * 2) {
        // Cache je potekel več kot 2x TTL — vrni offline odgovor
        return new Response(
          JSON.stringify({ error: 'Brez povezave — podatki so potekli', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return cachedResponse
    }

    // Poskusi še v vseh cache-jih (fallback za HTML itd.)
    const fallbackResponse = await caches.match(request)
    if (fallbackResponse) {
      return fallbackResponse
    }

    // Ni cache-ja — vrni offline odgovor
    return new Response(
      JSON.stringify({ error: 'Brez povezave — podatki niso na voljo', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Cache-first: Poskusi cache, fallback na omrežje
 * @param maxAge Maksimalna starost v ms (privzeto brez omejitve za statiko)
 */
async function cacheFirstWithNetwork(request, cacheName, maxAge = 0) {
  // FIX: Uporabi { cacheName } namesto iskanja po vseh cache-jih
  const cachedResponse = await caches.match(request, { cacheName })
  if (cachedResponse) {
    // Preveri TTL za slike
    if (maxAge > 0) {
      const cacheTimestamp = parseInt(cachedResponse.headers.get('sw-cache-timestamp') || '0')
      if (cacheTimestamp && (Date.now() - cacheTimestamp) > maxAge) {
        // Poteklo — poskusi osvežiti v ozadju
        refreshCacheEntry(request, cacheName)
      }
    }
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      // Dodaj timestamp za TTL
      const headers = new Headers(networkResponse.headers)
      headers.set('sw-cache-timestamp', Date.now().toString())
      // FIX: Clone before consuming — networkResponse.body can only be read once
      const responseForCache = networkResponse.clone()
      const body = await responseForCache.blob()
      const cachedResponse = new Response(body, {
        status: responseForCache.status,
        statusText: responseForCache.statusText,
        headers,
      })
      await cache.put(request, cachedResponse)
    }

    return networkResponse
  } catch {
    // Ni na voljo niti cache niti omrežje
    if (request.destination === 'image') {
      // Vrni placeholder za slike
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#1a1a2e" width="200" height="200"/><text fill="#666" font-size="14" x="50%" y="50%" text-anchor="middle">Brez slike</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }

    return new Response('Offline', { status: 503 })
  }
}

/**
 * Osveži posamezen cache vnos v ozadju (stale-while-revalidate)
 */
async function refreshCacheEntry(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      const headers = new Headers(networkResponse.headers)
      headers.set('sw-cache-timestamp', Date.now().toString())
      // FIX: Ni potrebe po clone() — networkResponse se ne porabi več
      const body = await networkResponse.blob()
      const cachedResponse = new Response(body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      })
      // FIX: Počakaj na cache.put
      await cache.put(request, cachedResponse)
    }
  } catch {
    // Osveževanje ni uspelo — ohrani stari cache
  }
}

// ============================================
// BACKGROUND SYNC — Posodobi cache ko je spet online
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-orders') {
    event.waitUntil(syncPendingOrders())
  }

  if (event.tag === 'sync-cache-refresh') {
    event.waitUntil(refreshApiCache())
  }
})

/**
 * Pošlji čakajoča naročila, ko je spet online
 * FIX: Podpora za auth token — preberi iz IndexedDB če je na voljo
 * FIX: Omejitev na 20 naročil na poskus — prepreči preobremenitev strežnika
 */
async function syncPendingOrders() {
  try {
    // Poizvedi IndexedDB za čakajoča naročila (če je offlineDB na voljo)
    const db = await openOfflineDB()
    if (!db) return

    const tx = db.transaction('pendingOrders', 'readonly')
    const store = tx.objectStore('pendingOrders')
    const orders = await idbRequestToPromise(store.getAll())

    // FIX: Omejitev na 20 naročil na poskus — prepreči preobremenitev strežnika
    const ordersToSync = orders.slice(0, 20)

    for (const order of ordersToSync) {
      try {
        const headers = { 'Content-Type': 'application/json' }
        // Če ima order shranjen token, ga uporabi
        if (order.authToken) {
          headers['Authorization'] = `Bearer ${order.authToken}`
        }

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify(order.data),
        })

        if (response.ok) {
          // Uspešno poslano — izbriši iz čakalne vrste
          const deleteTx = db.transaction('pendingOrders', 'readwrite')
          const deleteStore = deleteTx.objectStore('pendingOrders')
          deleteStore.delete(order.id)
          // FIX: deleteTx.done ne obstaja v nativnem IndexedDB — uporabi oncomplete
          await new Promise((resolve, reject) => {
            deleteTx.oncomplete = resolve
            deleteTx.onerror = () => reject(deleteTx.error)
          })
        }
      } catch {
        // FIX: Nadaljuj z naslednjim naročilom namesto break — eno neuspelo ne sme blokirati ostalih
        continue
      }
    }
  } catch {
    // IndexedDB ni na voljo — tiho prezri
  }
}

/**
 * Odpri IndexedDB za offline podatke
 */
function openOfflineDB() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('restaurantos-offline', 2)
      request.onupgradeneeded = (event) => {
        const db = request.result
        if (!db.objectStoreNames.contains('pendingOrders')) {
          const store = db.createObjectStore('pendingOrders', { keyPath: 'id' })
          store.createIndex('authToken', 'authToken', { unique: false })
        } else {
          // Upgrade existing store — dodaj authToken index če še ne obstaja
          const store = event.target.transaction.objectStore('pendingOrders')
          if (!store.indexNames.contains('authToken')) {
            store.createIndex('authToken', 'authToken', { unique: false })
          }
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Helper: Pretvori IDBRequest v Promise
 */
function idbRequestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Osveži API cache v ozadju
 * FIX LOW: Paralelno osveževanje z omejitvijo konkurenčnosti — prepreči timeout
 */
async function refreshApiCache() {
  const cache = await caches.open(API_CACHE)
  const keys = await cache.keys()

  // Omeji na prvih 50 vnosov
  const keysToRefresh = keys.slice(0, 50)

  // FIX LOW: Paralelno osveževanje z batchi po 5 — prepreči timeout in preobremenitev
  const BATCH_SIZE = 5
  for (let i = 0; i < keysToRefresh.length; i += BATCH_SIZE) {
    const batch = keysToRefresh.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(batch.map(async (request) => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const headers = new Headers(response.headers)
          headers.set('sw-cache-timestamp', Date.now().toString())
          const body = await response.blob()
          const cachedResponse = new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          })
          await cache.put(request, cachedResponse)
        }
      } catch {
        // Napaka pri osveževanju — ohrani star cache
      }
    }))
  }
}

// ============================================
// PUSH OBAVESTILA — Za natakarja in kuhinjo
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()

    const title = data.title || 'RestaurantOS'
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: data.tag || 'default',
      data: data.data || {},
      vibrate: data.vibrate || [200, 100, 200],
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    // Napaka pri parsanju push podatkov — tiho prezri
  }
})

// Klik na obvestilo
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  const url = data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // FIX: Najprej poišči okno, ki že prikazuje ta URL — prioritiziraj že navigirana okna
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && client.url.endsWith(url) && 'focus' in client) {
          return client.focus()
        }
      }
      // Nato poskusi poljubno okno istega izvora in navigiraj
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.navigate(url).then(() => client.focus())
        }
      }
      // Drugače odpri novo okno
      return self.clients.openWindow(url)
    })
  )
})
