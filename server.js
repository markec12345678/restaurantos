// RestaurantOS POS - Custom Server z WebSocket podporo
// Omogoča real-time komunikacijo s KDS zasloni
// FIX CRITICAL: WebSocket avtentikacija + rate limiting
// FIX HIGH: CORS headers + per-message WS rate limiting

const { createServer } = require('http')
const next = require('next')
const { WebSocketServer } = require('ws')
const crypto = require('crypto')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// ============================================
// WEBSOCKET UPRavljanje Z AVTENTIKACIJO
// FIX CRITICAL: Vse WS povezave ZAHTEVAJO veljaven Bearer token
// ============================================

/** @type {Set<import('ws').WebSocket>} */
const connectedClients = new Set()

/** @type {import('ws').WebSocketServer} */
let wss = null

// Heartbeat interval - pošlji ping vsakih 30 sekund
const HEARTBEAT_INTERVAL = 30000

// WS Avtentikacija: Seje v pomnilniku (sinhronizirano z auth-middleware.ts)
// Token mora biti poslan kot query parameter: ws://host/ws?token=xxx
// ali v prvem sporočilu: { type: 'AUTH', payload: { token: 'xxx' } }
const wsSessions = new Map()

// Rate limiting za WS povezave (prepreči brute-force)
const wsConnectionAttempts = new Map()
const WS_RATE_LIMIT_MAX = 10       // Maksimalno 10 poskusov
const WS_RATE_LIMIT_WINDOW = 60000 // V 1 minuti

// FIX MEDIUM: Per-message rate limiting za avtenticirane WS povezave
// Prepreči flooding/spam sporočil na WebSocket kanalu
const wsMessageCounts = new Map() // clientId -> { count, resetAt }
const WS_MSG_RATE_LIMIT = 30      // Maksimalno 30 sporočil na minuto
const WS_MSG_RATE_WINDOW = 60000  // 1 minuta

function checkWsMessageRateLimit(ws) {
  const clientId = ws.__employeeId || ws.__clientIp || 'unknown'
  const now = Date.now()
  let entry = wsMessageCounts.get(clientId)

  // Počisti potekel vnos
  if (entry && entry.resetAt <= now) {
    wsMessageCounts.delete(clientId)
    entry = null
  }

  if (!entry) {
    wsMessageCounts.set(clientId, { count: 1, resetAt: now + WS_MSG_RATE_WINDOW })
    return { allowed: true }
  }

  if (entry.count >= WS_MSG_RATE_LIMIT) {
    return { allowed: false }
  }

  entry.count++
  return { allowed: true }
}

// Periodično čiščenje per-message rate limit vnosov
setInterval(() => {
  const now = Date.now()
  for (const [clientId, entry] of wsMessageCounts) {
    if (entry.resetAt <= now) {
      wsMessageCounts.delete(clientId)
    }
  }
}, 60000)

function checkWsRateLimit(ip) {
  const now = Date.now()
  const entry = wsConnectionAttempts.get(ip)

  // Počisti potekle vnose
  if (entry && entry.resetAt <= now) {
    wsConnectionAttempts.delete(ip)
  }

  const current = wsConnectionAttempts.get(ip)
  if (current && current.count >= WS_RATE_LIMIT_MAX) {
    return false // Rate limited
  }

  if (!current) {
    wsConnectionAttempts.set(ip, { count: 1, resetAt: now + WS_RATE_LIMIT_WINDOW })
  } else {
    current.count++
  }

  return true // Dovoljeno
}

// Periodično čiščenje rate limit vnosov
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of wsConnectionAttempts) {
    if (entry.resetAt <= now) {
      wsConnectionAttempts.delete(ip)
    }
  }
}, 60000)

// FIX P3 (audit 2026-09-06): Periodično čiščenje potekelih WS sej.
// Prej: wsSessions Map je bila cleaned-up samo ob verifyWsToken klicu.
// Če uporabnik odjavi/zapre browser brez eksplicitnega logout-a, session
// ostane v Map-u dokler nekdo ne poskusi uporabiti ta token.
// Sedaj: vsakih 5 minut iteriramo čez vse sessions in izbrišemo potekle.
const WS_SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minut
setInterval(() => {
  const now = Date.now()
  let cleanedCount = 0
  for (const [token, session] of wsSessions) {
    if (session.expiresAt < now || session.absoluteExpiry < now) {
      wsSessions.delete(token)
      cleanedCount++
    }
  }
  if (cleanedCount > 0 && dev) {
    console.log(`[WS] Cleanup: izbrisanih ${cleanedCount} potekelih sej (active: ${wsSessions.size})`)
  }
}, WS_SESSION_CLEANUP_INTERVAL)

/**
 * Preveri veljavnost Bearer tokena za WS povezavo
 * Token se preverja iz: 1) query parametra ?token=xxx  2) AUTH sporočila
 * @param {string} token - Bearer token
 * @returns {object|null} - Seja ali null
 */
function verifyWsToken(token) {
  if (!token || typeof token !== 'string') return null

  // Preveri dolžino tokena (32 bytov = 64 hex znakov)
  if (token.length !== 64 || !/^[a-f0-9]+$/.test(token)) return null

  const session = wsSessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now() || session.absoluteExpiry < Date.now()) {
    wsSessions.delete(token)
    return null
  }

  return session
}

// Expose za sinhronizacijo sej iz auth-middleware.ts
globalThis.__wsSessionStore = wsSessions
globalThis.__wsVerifyToken = verifyWsToken

/**
 * Oddaj sporočilo vsem povezanim odjemalcem
 * @param {string} type - Tip dogodka
 * @param {any} payload - Podatki dogodka
 */
function broadcastEvent(type, payload, channels = null) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  })

  let sentCount = 0
  for (const client of connectedClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      // Če so specificirani channeli, preveri subscription
      if (channels && channels.length > 0) {
        const subscribed = client.__subscribedChannels
        if (!subscribed || !channels.some(ch => subscribed.has(ch))) {
          continue // client ni subscriben na ta channel
        }
      }
      try {
        client.send(message)
        sentCount++
      } catch (err) {
        console.error('[WS] Napaka pri pošiljanju:', err.message)
        connectedClients.delete(client)
      }
    }
  }

  if (dev && sentCount > 0) {
    console.log(`[WS] Oddano: ${type} → ${sentCount} odjemalcev${channels ? ` (channels: ${channels.join(',')})` : ''}`)
  }
}

// Expose broadcast za uporabo v API-jih
globalThis.__wsBroadcast = broadcastEvent

// Helper za outbox-specific broadcast (samo subscribers)
globalThis.__wsBroadcastOutbox = function(payload) {
  broadcastEvent('OUTBOX_UPDATE', payload, ['outbox'])
}

/**
 * Preveri povezave in odstrani nepovezane odjemalce
 */
function heartbeatCheck() {
  for (const client of connectedClients) {
    // Če klient ni odgovoril na prejšnji ping, zapri povezavo
    if (!client.__isAlive) {
      client.terminate()
      connectedClients.delete(client)
      continue
    }
    client.__isAlive = false
    client.ping()
  }
}

// ============================================
// ZAGON STREŽNIKA
// ============================================

// ============================================
// CORS KONFIGURACIJA ZA CUSTOM SERVER
// FIX HIGH: Dodani CORS headerji za cross-origin zahteve
// ============================================
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
const CORS_MAX_AGE = 86400 // 24 ur — predpomnjenje preflight zahtevkov

function addCorsHeaders(req, res) {
  const origin = req.headers.origin
  if (!origin) return

  // Če so dovoljeni origini nastavljeni, preveri; sicer dovoli vse (razvoj)
  if (CORS_ALLOWED_ORIGINS.length > 0) {
    if (!CORS_ALLOWED_ORIGINS.includes(origin)) return
  }

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', CORS_MAX_AGE)
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // FIX HIGH: Dodaj CORS headerje
    addCorsHeaders(req, res)

    // Obdelaj OPTIONS preflight zahtevek
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Next.js handle needs pathname + query (like url.parse returns)
    const u = new URL(req.url, `http://${hostname}:${port}`)
    const parsedUrl = {
      pathname: u.pathname,
      query: Object.fromEntries(u.searchParams),
    }
    handle(req, res, parsedUrl)
  })

  // Ustvari WebSocket strežnik na isti HTTP instanci
  wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 1024, // 1MB max
    // FIX CRITICAL: Preveri avtentikacijo pred vzpostavitvijo povezave
    verifyClient: (info, callback) => {
      const clientIp = info.req.socket.remoteAddress

      // Rate limiting za povezave
      if (!checkWsRateLimit(clientIp)) {
        console.warn(`[WS] Rate limited: ${clientIp}`)
        callback(false, 429, 'Preveč povezav. Poskusite znova čez minuto.')
        return
      }

      // Preveri token iz query parametra: ws://host/ws?token=xxx
      const url = new URL(info.req.url, `http://${hostname}:${port}`)
      const token = url.searchParams.get('token')

      if (token) {
        const session = verifyWsToken(token)
        if (session) {
          // Avtenticirana povezava — shrani sejo na req za kasnejšo uporabo
          info.req.__wsSession = session
          callback(true)
          return
        }
        // Neveljaven token — zavrni
        console.warn(`[WS] Neveljaven token od: ${clientIp}`)
        callback(false, 401, 'Neveljaven ali potekel žeton. Prijavite se ponovno.')
        return
      }

      // Brez tokena — dovoli povezavo, vendar OZNAČI kot neavtenticirano
      // Klient mora poslati AUTH sporočilo v 10 sekundah
      info.req.__wsSession = null
      callback(true)
    },
  })

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress
    const session = req.__wsSession || null
    const isAuthenticated = !!session

    // Če ni avtenticiran takoj, nastavi timeout za AUTH
    let authTimeout = null
    if (!isAuthenticated) {
      authTimeout = setTimeout(() => {
        if (!ws.__isAuthenticated) {
          console.warn(`[WS] Timeout — brez avtentikacije: ${clientIp}`)
          ws.close(4001, 'Avtentikacija je obvezna. Pošljite token v 10 sekundah.')
        }
      }, 10000) // 10 sekund za AUTH
    }

    // Dodaj klienta
    ws.__isAlive = true
    ws.__connectedAt = new Date()
    ws.__isAuthenticated = isAuthenticated
    ws.__session = session
    ws.__clientIp = clientIp

    if (isAuthenticated) {
      ws.__employeeId = session.employeeId
      ws.__role = session.role
      connectedClients.add(ws)
      console.log(`[WS] Avtenticirana povezava: ${clientIp} (${session.role}:${session.employeeId}) — skupaj: ${connectedClients.size}`)
    } else {
      console.log(`[WS] Čaka avtentikacijo: ${clientIp}`)
    }

    // Odgovori na pong (heartbeat potrditev)
    ws.on('pong', () => {
      ws.__isAlive = true
    })

    // Obdelaj vhodna sporočila
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())

        // FIX CRITICAL: Obdelaj AUTH sporočilo za neavtenticirane povezave
        if (msg.type === 'AUTH' && !ws.__isAuthenticated) {
          const token = msg.payload?.token
          if (!token) {
            ws.close(4002, 'Manjka žeton za avtentikacijo.')
            return
          }

          const authSession = verifyWsToken(token)
          if (!authSession) {
            ws.close(4003, 'Neveljaven ali potekel žeton.')
            return
          }

          // Avtenticiran!
          ws.__isAuthenticated = true
          ws.__session = authSession
          ws.__employeeId = authSession.employeeId
          ws.__role = authSession.role
          connectedClients.add(ws)

          if (authTimeout) {
            clearTimeout(authTimeout)
            authTimeout = null
          }

          console.log(`[WS] Avtenticiran preko sporočila: ${clientIp} (${authSession.role}) — skupaj: ${connectedClients.size}`)

          // Pošlji potrditev
          ws.send(JSON.stringify({
            type: 'AUTH_SUCCESS',
            payload: {
              role: authSession.role,
              employeeId: authSession.employeeId,
            },
            timestamp: new Date().toISOString(),
          }))
          return // Ne obdeluj naprej
        }

        // Zavrni vsa sporočila od neavtenticiranih povezav
        if (!ws.__isAuthenticated) {
          ws.send(JSON.stringify({
            type: 'AUTH_REQUIRED',
            payload: { message: 'Avtentikacija je obvezna. Pošljite { type: "AUTH", payload: { token: "xxx" } }' },
            timestamp: new Date().toISOString(),
          }))
          return
        }

        // Klient lahko pošlje identifikacijo
        if (msg.type === 'IDENTIFY') {
          ws.__clientType = msg.payload?.clientType || 'unknown'
          ws.__clientName = msg.payload?.clientName || ''
          console.log(`[WS] Klient identificiran: ${ws.__clientType} (${ws.__clientName})`)
        }

        // OUTBOX subscription — client želi prejemati outbox updates
        if (msg.type === 'SUBSCRIBE_OUTBOX') {
          ws.__subscribedChannels = ws.__subscribedChannels || new Set()
          ws.__subscribedChannels.add('outbox')
          ws.send(JSON.stringify({
            type: 'SUBSCRIPTION_CONFIRMED',
            payload: { channel: 'outbox' },
            timestamp: new Date().toISOString(),
          }))
          console.log(`[WS] Client ${ws.__employeeId || 'unknown'} subscribed to outbox`)
          return
        }

        // Unsubscribe
        if (msg.type === 'UNSUBSCRIBE_OUTBOX') {
          if (ws.__subscribedChannels) {
            ws.__subscribedChannels.delete('outbox')
          }
          return
        }

        // FIX MEDIUM: Per-message rate limiting — prepreči flooding
        const rateResult = checkWsMessageRateLimit(ws)
        if (!rateResult.allowed) {
          ws.send(JSON.stringify({
            type: 'RATE_LIMITED',
            payload: { message: 'Preveč sporočil. Počakajte trenutek.' },
            timestamp: new Date().toISOString(),
          }))
          console.warn(`[WS] Rate limited sporočilo od: ${ws.__employeeId || ws.__clientIp}`)
          return
        }

        // FIX: Preveri dovoljenja za oddajo dogodkov
        // Samo avtenticirani uporabniki z dovoljenji lahko oddajajo dogodke
        const ALLOWED_BROADCAST_TYPES = [
          'NEW_ORDER', 'ORDER_UPDATED', 'ITEM_STATUS_CHANGED',
          'ORDER_CANCELLED', 'ORDER_FIRED', 'ITEM_STATUS_UPDATE',
          'STOCK_LOW', 'CALL_WAITER',
        ]

        if (msg.type && msg.payload && ALLOWED_BROADCAST_TYPES.includes(msg.type)) {
          broadcastEvent(msg.type, msg.payload)
        } else if (msg.type && msg.payload && !ALLOWED_BROADCAST_TYPES.includes(msg.type)) {
          console.warn(`[WS] Zavrnjen nedovoljen tip dogodka: ${msg.type} od ${ws.__employeeId}`)
        }
      } catch (err) {
        console.error('[WS] Neveljavno sporočilo:', err.message)
      }
    })

    // Ob zaprtju povezave
    ws.on('close', (code, reason) => {
      if (authTimeout) {
        clearTimeout(authTimeout)
        authTimeout = null
      }
      connectedClients.delete(ws)
      console.log(`[WS] Povezava zaprta: ${clientIp} (koda: ${code}, skupaj: ${connectedClients.size})`)
    })

    ws.on('error', (err) => {
      console.error(`[WS] Napaka na povezavi: ${err.message}`)
      if (authTimeout) {
        clearTimeout(authTimeout)
        authTimeout = null
      }
      connectedClients.delete(ws)
    })

    // Pošlji pozdravno sporočilo
    if (isAuthenticated) {
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        payload: {
          message: 'RestaurantOS WebSocket strežnik — avtenticiran',
          clientCount: connectedClients.size,
          authenticated: true,
          role: session.role,
        },
        timestamp: new Date().toISOString(),
      }))
    } else {
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        payload: {
          message: 'RestaurantOS WebSocket strežnik — potrebna avtentikacija',
          authenticated: false,
          authRequired: true,
        },
        timestamp: new Date().toISOString(),
      }))
    }
  })

  // Zaženi heartbeat preverjanje
  const heartbeatTimer = setInterval(heartbeatCheck, HEARTBEAT_INTERVAL)

  wss.on('close', () => {
    clearInterval(heartbeatTimer)
  })

  // Zaženi HTTP strežnik
  server.listen(port, hostname, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║  RestaurantOS POS Strežnik                   ║
║  ─────────────────────────────────────────── ║
║  HTTP:     http://${hostname}:${port}              ║
║  WebSocket: ws://${hostname}:${port}/ws            ║
║  Način:    ${dev ? 'razvoj' : 'produkcija'}                          ║
╚══════════════════════════════════════════════╝
    `)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Ustavljanje strežnika...')

    // Zapri vse WebSocket povezave
    for (const client of connectedClients) {
      client.send(JSON.stringify({
        type: 'SERVER_SHUTDOWN',
        payload: { message: 'Strežnik se ustavlja' },
        timestamp: new Date().toISOString(),
      }))
      client.close(1001, 'Server shutting down')
    }
    connectedClients.clear()

    // Zapri WebSocket strežnik
    if (wss) wss.close()

    // Zapri HTTP strežnik
    server.close(() => {
      console.log('[Server] Strežnik ustavljen')
      process.exit(0)
    })

    // Force exit po 5 sekundah
    setTimeout(() => {
      console.error('[Server] Force exit')
      process.exit(1)
    }, 5000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})
