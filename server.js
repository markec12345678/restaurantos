// RestaurantOS POS - Custom Server z WebSocket podporo
// Omogoča real-time komunikacijo s KDS zasloni

const { createServer } = require('http')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// ============================================
// WEBSOCKET UPRavljanje
// ============================================

/** @type {Set<import('ws').WebSocket>} */
const connectedClients = new Set()

/** @type {import('ws').WebSocketServer} */
let wss = null

// Heartbeat interval - pošlji ping vsakih 30 sekund
const HEARTBEAT_INTERVAL = 30000

/**
 * Oddaj sporočilo vsem povezanim odjemalcem
 * @param {string} type - Tip dogodka
 * @param {any} payload - Podatki dogodka
 */
function broadcastEvent(type, payload) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  })

  let sentCount = 0
  for (const client of connectedClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
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
    console.log(`[WS] Oddano: ${type} → ${sentCount} odjemalcev`)
  }
}

// Expose broadcast za uporabo v API-jih
globalThis.__wsBroadcast = broadcastEvent

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

app.prepare().then(() => {
  const server = createServer((req, res) => {
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
  })

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress
    console.log(`[WS] Nova povezava: ${clientIp} (skupaj: ${connectedClients.size + 1})`)

    // Dodaj klienta
    connectedClients.add(ws)
    ws.__isAlive = true
    ws.__connectedAt = new Date()

    // Odgovori na pong (heartbeat potrditev)
    ws.on('pong', () => {
      ws.__isAlive = true
    })

    // Obdelaj vhodna sporočila
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())

        // Klient lahko pošlje identifikacijo
        if (msg.type === 'IDENTIFY') {
          ws.__clientType = msg.payload?.clientType || 'unknown'
          ws.__clientName = msg.payload?.clientName || ''
          console.log(`[WS] Klient identificiran: ${ws.__clientType} (${ws.__clientName})`)
        }

        // Klient lahko tudi oddaja dogodke (npr. POS terminal pošlje NEW_ORDER)
        if (msg.type && msg.payload) {
          broadcastEvent(msg.type, msg.payload)
        }
      } catch (err) {
        console.error('[WS] Neveljavno sporočilo:', err.message)
      }
    })

    // Ob zaprtju povezave
    ws.on('close', (code, reason) => {
      connectedClients.delete(ws)
      console.log(`[WS] Povezava zaprta: ${clientIp} (koda: ${code}, skupaj: ${connectedClients.size})`)
    })

    ws.on('error', (err) => {
      console.error(`[WS] Napaka na povezavi: ${err.message}`)
      connectedClients.delete(ws)
    })

    // Pošlji pozdravno sporočilo
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        message: 'RestaurantOS WebSocket strežnik',
        clientCount: connectedClients.size,
      },
      timestamp: new Date().toISOString(),
    }))
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
