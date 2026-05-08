// RestaurantOS POS - Service Worker
// Omogoča namestitev na tablico (PWA), delno offline delovanje
// in sinhronizacijo naročil, ko je povezava spet na voljo

const CACHE_NAME = 'restaurantos-v2'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Offline čakalna vrsta za naročila
const OFFLINE_ORDER_QUEUE = 'offline-order-queue'

// ============================================
// INSTALL - Cache app shell aggressively
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// ============================================
// ACTIVATE - Clean old caches
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// ============================================
// FETCH - Strategy: Network first for API, Cache first for static
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests (razen za background sync)
  if (request.method !== 'GET') return

  // API calls - Network first (vedno sveži podatki za POS)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(request)
        })
    )
    return
  }

  // WebSocket zahteve — ne cahiraj
  if (url.pathname === '/ws') {
    return
  }

  // Static assets - Cache first, then network (aggressive caching za hitrejši zagon)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
    })
  )
})

// ============================================
// BACKGROUND SYNC - Sinhronizacija naročil, ko je povezava spet na voljo
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-orders') {
    event.waitUntil(syncOfflineOrders())
  }
})

async function syncOfflineOrders() {
  try {
    const db = await openOfflineDB()
    const orders = await getAllOfflineOrders(db)

    for (const order of orders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.data),
        })

        if (response.ok) {
          await deleteOfflineOrder(db, order.id)
        }
      } catch (err) {
        console.error('[SW] Napaka pri sinhronizaciji naročila:', err)
        // Poskusi znova naslednjič
      }
    }
  } catch (err) {
    console.error('[SW] Napaka pri sinhronizaciji:', err)
  }
}

// IndexedDB helper za offline naročila
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('restaurantos-offline', 1)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAllOfflineOrders(db: IDBDatabase) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readonly')
    const store = tx.objectStore('orders')
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function deleteOfflineOrder(db: IDBDatabase, id: string) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readwrite')
    const store = tx.objectStore('orders')
    const request = store.delete(id)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// PUSH NOTIFICATION (za prihodnjo uporabo)
// ============================================
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const title = data.title || 'RestaurantOS'
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'default',
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    // Neveljavni push podatki
  }
})

// ============================================
// MESSAGE HANDLER - za komunikacijo z aplikacijo
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Shrani offline naročilo v IndexedDB
  if (event.data && event.data.type === 'SAVE_OFFLINE_ORDER') {
    event.waitUntil(
      openOfflineDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = (db as IDBDatabase).transaction('orders', 'readwrite')
          const store = tx.objectStore('orders')
          const request = store.put({
            id: event.data.orderId || Date.now().toString(),
            data: event.data.orderData,
            createdAt: new Date().toISOString(),
          })
          request.onsuccess = () => {
            // Poskusi takoj sinhronizirati
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
              self.registration.sync.register('sync-offline-orders')
            }
            resolve(undefined)
          }
          request.onerror = () => reject(request.error)
        })
      })
    )
  }
})
