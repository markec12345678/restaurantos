// RestaurantOS POS - Custom Server z WebSocket podporo
// Omogoča real-time komunikacijo s KDS zasloni

// Globalni error handlerji - preprečujejo crash procesa
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT] ', err.message, err.stack || '')
})
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED] ', err)
})

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// ============================================
// WEBSOCKET UPRAVLJANJE
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
    const parsedUrl = parse(req.url, true)
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

    connectedClients.add(ws)
    ws.__isAlive = true
    ws.__connectedAt = new Date()

    ws.on('pong', () => {
      ws.__isAlive = true
    })

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())

        if (msg.type === 'IDENTIFY') {
          ws.__clientType = msg.payload?.clientType || 'unknown'
          ws.__clientName = msg.payload?.clientName || ''
          console.log(`[WS] Klient identificiran: ${ws.__clientType} (${ws.__clientName})`)
        }

        if (msg.type && msg.payload) {
          broadcastEvent(msg.type, msg.payload)
        }
      } catch (err) {
        console.error('[WS] Neveljavno sporočilo:', err.message)
      }
    })

    ws.on('close', (code, reason) => {
      connectedClients.delete(ws)
      console.log(`[WS] Povezava zaprta: ${clientIp} (koda: ${code}, skupaj: ${connectedClients.size})`)
    })

    ws.on('error', (err) => {
      console.error(`[WS] Napaka na povezavi: ${err.message}`)
      connectedClients.delete(ws)
    })

    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        message: 'RestaurantOS WebSocket strežnik',
        clientCount: connectedClients.size,
      },
      timestamp: new Date().toISOString(),
    }))
  })

  const heartbeatTimer = setInterval(heartbeatCheck, HEARTBEAT_INTERVAL)

  wss.on('close', () => {
    clearInterval(heartbeatTimer)
  })

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

    for (const client of connectedClients) {
      client.send(JSON.stringify({
        type: 'SERVER_SHUTDOWN',
        payload: { message: 'Strežnik se ustavlja' },
        timestamp: new Date().toISOString(),
      }))
      client.close(1001, 'Server shutting down')
    }
    connectedClients.clear()

    if (wss) wss.close()

    server.close(() => {
      console.log('[Server] Strežnik ustavljen')
      process.exit(0)
    })

    setTimeout(() => {
      console.error('[Server] Force exit')
      process.exit(1)
    }, 5000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})
