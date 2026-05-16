// ============================================
// RESTAURANTOS POS — SERVICE WORKER
// PWA offline podpora z inteligentnim predpomnjenjem
// Strategija: Cache-first za statiko, Network-first za API
// ============================================

const CACHE_NAME = 'restos-pos-v2'
const STATIC_CACHE = 'restos-static-v2'
const API_CACHE = 'restos-api-v2'
const IMAGE_CACHE = 'restos-images-v2'

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
self.addEventListener('install', (event) => {
  console.log('[SW] Install')
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Nekateri viri niso bili predpomnjeni:', err)
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
  console.log('[SW] Activate')
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
  // 1. API zahtevki → Network-first z offline fallbackom
  // 2. Slike → Cache-first z network fallbackom
  // 3. Statični viri (JS, CSS) → Cache-first (Next.js ima že hashe)
  // 4. Ostalo → Network-first

  if (url.pathname.startsWith('/api/')) {
    // Preveri, ali je ta API na črnem seznamu
    if (NO_CACHE_API_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      return // Ne predpomni občutljivih API-jev
    }

    // Preveri, ali je ta API predpomnljiv
    if (CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      event.respondWith(networkFirstWithCache(request, API_CACHE, 300)) // 5 min cache
      return
    }

    // Ostali API-ji — samo network
    return
  }

  // Slike
  if (request.destination === 'image') {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE))
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
 * @param maxAge Maksimalna starost cache vnosa v sekundah (0 = ne predpomni)
 */
async function networkFirstWithCache(request, cacheName, maxAge = 300) {
  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok && maxAge > 0) {
      // Shrani v cache za offline uporabo
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    // Omrežje ni na voljo — poskusi cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Ni cache-ja — vrni offline odgovor
    return new Response(
      JSON.stringify({ error: 'Brez povezave — podatki niso na voljo', offline: true }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Cache-first: Poskusi cache, fallback na omrežje
 */
async function cacheFirstWithNetwork(request, cacheName) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
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

// ============================================
// BACKGROUND SYNC — Posodobi cache ko je spet online
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-orders') {
    console.log('[SW] Sync: pending orders')
    // TODO: Pošlji čakajoča naročila, ko je spet online
  }

  if (event.tag === 'sync-cache-refresh') {
    console.log('[SW] Sync: cache refresh')
    event.waitUntil(refreshApiCache())
  }
})

/**
 // Osveži API cache v ozadju
 */
async function refreshApiCache() {
  const cache = await caches.open(API_CACHE)
  const keys = await cache.keys()

  for (const request of keys) {
    try {
      const response = await fetch(request)
      if (response.ok) {
        await cache.put(request, response)
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
  } catch (err) {
    console.error('[SW] Push notification error:', err)
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
