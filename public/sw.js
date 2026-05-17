// ============================================
// RESTAURANTOS POS — SERVICE WORKER
// PWA offline podpora z inteligentnim predpomnjenjem
// Strategija: Cache-first za statiko, Network-first za API
// ============================================

const CACHE_NAME = 'restos-pos-v3'
const STATIC_CACHE = 'restos-static-v3'
const API_CACHE = 'restos-api-v3'
const IMAGE_CACHE = 'restos-images-v3'

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
]

// API poti, ki jih NIKOLI ne predpomnimo
const NO_CACHE_API_PATTERNS = [
  /\/api\/orders\/.*\/(pay|fiscal|void|storno)/,
  /\/api\/furs/,
  /\/api\/print/,
  /\/api\/payments/,
  /\/api\/cash-register\/(open|close)/,
  /\/api\/inventory\/restock/,
  /\/api\/inventory\/transactions/,
]

// ============================================
// INSTALL — Predpomni statiko
// ============================================
self.addEventListener('install', () => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Nekateri viri morda niso na voljo — tiho nadaljuj
      })
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
  self.clients.claim()
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

  // WebSocket — ne predpomni
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return

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
      // FIX C-SW1: Dodaj timestamp header za TTL preverjanje
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cache-timestamp', Date.now().toString())
      const body = await responseToCache.blob()
      const cachedResponse = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      })
      cache.put(request, cachedResponse)
    }

    return networkResponse
  } catch {
    // Omrežje ni na voljo — poskusi cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      // FIX C-SW2: Preveri TTL — ne vrni odcelega cache-ja
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
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    // FIX C-SW3: Preveri TTL za slike
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
      const body = await networkResponse.clone().blob()
      const cachedResponse = new Response(body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      })
      cache.put(request, cachedResponse)
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
      const body = await networkResponse.clone().blob()
      const cachedResponse = new Response(body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers,
      })
      cache.put(request, cachedResponse)
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
    // FIX C-SW4: Implementiraj sync za čakajoča naročila
    event.waitUntil(syncPendingOrders())
  }

  if (event.tag === 'sync-cache-refresh') {
    event.waitUntil(refreshApiCache())
  }
})

/**
 * Pošlji čakajoča naročila, ko je spet online
 */
async function syncPendingOrders() {
  try {
    // Poizvedi IndexedDB za čakajoča naročila (če je offlineDB na voljo)
    const db = await openOfflineDB()
    if (!db) return

    const tx = db.transaction('pendingOrders', 'readonly')
    const store = tx.objectStore('pendingOrders')
    const orders = await idbRequestToPromise(store.getAll())

    for (const order of orders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.data),
        })

        if (response.ok) {
          // Uspešno poslano — izbriši iz čakalne vrste
          const deleteTx = db.transaction('pendingOrders', 'readwrite')
          const deleteStore = deleteTx.objectStore('pendingOrders')
          deleteStore.delete(order.id)
          await idbRequestToPromise(deleteTx.done)
        }
      } catch {
        // Poskus znova naslednjič
        break
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
      const request = indexedDB.open('restaurantos-offline', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('pendingOrders')) {
          db.createObjectStore('pendingOrders', { keyPath: 'id' })
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
 */
async function refreshApiCache() {
  const cache = await caches.open(API_CACHE)
  const keys = await cache.keys()

  for (const request of keys) {
    try {
      const response = await fetch(request)
      if (response.ok) {
        const headers = new Headers(response.headers)
        headers.set('sw-cache-timestamp', Date.now().toString())
        const body = await response.clone().blob()
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
      // Če je okno že odprto, fokusiraj
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Drugače odpri novo okno
      return self.clients.openWindow(url)
    })
  )
})
