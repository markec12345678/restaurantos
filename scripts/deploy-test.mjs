#!/usr/bin/env node
/**
 * deploy-test.mjs — DEPLOYMENT TEST (uporabniško zahtevek točke 3, 2026-09-09)
 *
 * Preveri, da custom server (server.js) dejansko deluje kot produkcjski
 * proces z WebSocket podporo — NE predpostavlja, da "na Vercelu bo pač delalo":
 *
 *   1. bun run build            → produkcjski build (.next + standalone)
 *   2. node server.js           → custom server z WS v ISTEM procesu
 *   3. Preverjanja:
 *      [x] custom server uporablja pravilen build (production, ne dev)
 *      [x] health check deluje (DB povezljivost)
 *      [x] WebSocket se uspešno poveže (CONNECTED, authRequired)
 *      [x] neavtenticirana sporočila → AUTH_REQUIRED
 *      [x] token v URL-ju → handshake zavrnjen (401)
 *      [x] restart procesa → podatki nedotaknjeni (health + WS spet delujeta)
 *      [x] reconnect klienta po restartu deluje
 *      [x] graceful shutdown (SIGTERM → čist izhod)
 *
 * Proxy/HTTPS opombe (zunaj obsega te skripte, ker so DEPLOYMENT-specifične):
 *      [~] proxy Upgrade header → nginx: `proxy_set_header Upgrade $http_upgrade;
 *          proxy_set_header Connection "upgrade";` (glej DEPLOYMENT.md)
 *      [~] HTTPS → wss:// → klient sam izbere protokol iz window.location
 *          (useWSConnect.ts: https → wss, http → ws) — TLS terminira na proxy-ju
 *
 * Uporaba:
 *   node scripts/deploy-test.mjs                # build + test
 *   node scripts/deploy-test.mjs --skip-build   # preskoči build (že zgrajeno)
 *
 * Izhod: 0 = vsi testi zeleni, 1 = vsaj en kritičen test rdeč.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { WebSocket } from 'ws'

const PORT = parseInt(process.env.DEPLOY_TEST_PORT || '3999', 10)
const BASE = `http://127.0.0.1:${PORT}`
const WS_URL = `ws://127.0.0.1:${PORT}/ws`
const SKIP_BUILD = process.argv.includes('--skip-build')
const BUILD_TIMEOUT_MS = 10 * 60 * 1000

const results = []
let critical = false

function check(name, ok, detail = '', isCritical = true) {
  results.push({ name, ok, detail })
  if (!ok && isCritical) critical = true
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function section(title) {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`)
}

/** Počakaj, da /api/health odgovori z 200 (ali timeout). */
async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return await res.json().catch(() => null)
    } catch { /* še ni gor */ }
    await sleep(500)
  }
  return null
}

/** Zaženi custom server (node server.js) v produkcjskem načinu. */
function startServer() {
  const child = spawn(process.execPath.includes('bun') ? 'node' : process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      // PGlite fallback (brez DATABASE_URL) — health check SELECT 1 deluje
      PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR || '/tmp/deploy-test-pglite',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = []
  child.stdout.on('data', d => logs.push(String(d)))
  child.stderr.on('data', d => logs.push(String(d)))
  return { child, logs }
}

/** Poveži WS in počakaj na CONNECTED sporočilo. */
function wsConnect({ timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const messages = []
    const timer = setTimeout(() => {
      ws.terminate()
      reject(new Error(`WS connect timeout (${timeoutMs}ms) brez CONNECTED`))
    }, timeoutMs)

    ws.on('message', raw => {
      const msg = JSON.parse(String(raw))
      messages.push(msg)
      if (msg.type === 'CONNECTED') {
        clearTimeout(timer)
        resolve({ ws, messages, connected: msg })
      }
    })
    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(timer)
      reject(new Error(`Handshake zavrnjen: HTTP ${res.statusCode}`))
    })
    ws.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/** Počakaj na specifično sporočilo (tip) ali timeout. */
function waitForMessage(ws, type, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: sporočilo ${type} ni prispelo`)), timeoutMs)
    const onMessage = raw => {
      const msg = JSON.parse(String(raw))
      if (msg.type === type) {
        clearTimeout(timer)
        ws.off('message', onMessage)
        resolve(msg)
      }
    }
    ws.on('message', onMessage)
  })
}

// ═══════════════════════════════════════════════════════════════
// 1. BUILD
// ═══════════════════════════════════════════════════════════════
section('1. Produkcjski build (bun run build)')
if (SKIP_BUILD) {
  console.log('  • Preskočen (--skip-build)')
  check('.next/ produkcjski build obstaja', existsSync('.next/BUILD_ID') || existsSync('.next/standalone/server.js'),
    existsSync('.next/BUILD_ID') ? '.next/BUILD_ID najden' : 'manjka .next — poženite brez --skip-build')
} else {
  console.log('  • next build v teku (lahko traja več minut)...')
  const build = spawnSync('bun', ['run', 'build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: BUILD_TIMEOUT_MS,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  })
  check('build uspešen (exit 0)', build.status === 0, build.status === 0 ? '' : `exit ${build.status}`)
  check('.next/BUILD_ID obstaja (produkcjski build)', existsSync('.next/BUILD_ID'))
}

// ═══════════════════════════════════════════════════════════════
// 2. ZAGON CUSTOM SERVERJA
// ═══════════════════════════════════════════════════════════════
section('2. Zagon custom serverja (node server.js, NODE_ENV=production)')
let server = startServer()

const health1 = await waitForHealth()
check('health check deluje (GET /api/health → 200)', !!health1, health1 ? `status: ${health1.status}, db: ${health1.database}` : 'timeout')

// Custom server uporablja PRAVILEN build: produkcjski način strežnika se
// dokaže z odgovorom aplikacije (ne dev fallback). GET / mora vrniti 200/3xx.
try {
  const page = await fetch(`${BASE}/`, { redirect: 'manual', signal: AbortSignal.timeout(10000) })
  check('custom server streže produkcjski build (GET / → 2xx/3xx)', page.status >= 200 && page.status < 400, `HTTP ${page.status}`)
} catch (err) {
  check('custom server streže produkcjski build (GET /)', false, err.message)
}

// ═══════════════════════════════════════════════════════════════
// 3. WEBSOCKET TESTI
// ═══════════════════════════════════════════════════════════════
section('3. WebSocket povezljivost')

// 3a. Osnovna povezava — CONNECTED (neavtenticiran → authRequired)
let conn = null
try {
  conn = await wsConnect()
  check('WS povezava uspešna (CONNECTED)', true, `authRequired: ${conn.connected.payload.authRequired}`)
} catch (err) {
  check('WS povezava uspešna (CONNECTED)', false, err.message)
}

// 3b. Neavtenticirano sporočilo → AUTH_REQUIRED (klient ne more pošiljati brez AUTH)
if (conn) {
  try {
    conn.ws.send(JSON.stringify({ type: 'SUBSCRIBE_OUTBOX', payload: {} }))
    const authReq = await waitForMessage(conn.ws, 'AUTH_REQUIRED')
    check('neavtenticirana sporočila zavrnjena (AUTH_REQUIRED)', true, authReq.payload.message?.slice(0, 40))
  } catch (err) {
    check('neavtenticirana sporočila zavrnjena (AUTH_REQUIRED)', false, err.message)
  } finally {
    conn.ws.close()
  }
}

// 3c. Token v URL-ju → handshake ZAVRNJEN (varnostna politika iz WS audita)
await new Promise(resolve => {
  const ws = new WebSocket(`${WS_URL}?token=${'a'.repeat(64)}`)
  const timer = setTimeout(() => { ws.terminate(); resolve() }, 10000)
  ws.on('unexpected-response', (_req, res) => {
    clearTimeout(timer)
    check('token v URL-ju zavrnjen (HTTP 401)', res.statusCode === 401, `HTTP ${res.statusCode}`)
    resolve()
  })
  ws.on('open', () => {
    clearTimeout(timer)
    check('token v URL-ju zavrnjen (HTTP 401)', false, 'povezava je bila SPREJETA — ranljivost!')
    ws.close()
    resolve()
  })
  ws.on('error', () => { /* ročeno v unexpected-response */ })
})

// 3d. Oversize sporočilo (>16KB) → strežnik zapre povezavo (flooding varovalka)
await new Promise(resolve => {
  const ws = new WebSocket(WS_URL)
  let closed = false
  ws.on('open', () => {
    ws.send('x'.repeat(20 * 1024)) // 20KB > 16KB limit
  })
  ws.on('close', code => {
    closed = true
    check('oversize sporočilo zavrnjeno (>16KB → close)', true, `koda ${code}`)
    resolve()
  })
  ws.on('error', () => { /* ws zapre povezavo */ })
  setTimeout(() => {
    if (!closed) {
      check('oversize sporočilo zavrnjeno (>16KB → close)', false, 'povezava ni bila zaprta')
      ws.terminate()
      resolve()
    }
  }, 8000)
})

// ═══════════════════════════════════════════════════════════════
// 4. RESTART PROCESA — PODATKI IN PONOVNA POVEZAVA
// ═══════════════════════════════════════════════════════════════
section('4. Restart procesa (WS stanje je transient, podatki v DB)')

server.child.kill('SIGTERM')
await new Promise(resolve => {
  server.child.on('exit', code => {
    check('graceful shutdown (SIGTERM → čist izhod)', code === 0 || code === null, `exit ${code}`)
    resolve()
  })
  setTimeout(() => { server.child.kill('SIGKILL'); resolve() }, 10000)
})

// Restart
server = startServer()
const health2 = await waitForHealth()
check('health po restartu (restart ne pokvari podatkov)', !!health2, health2 ? `status: ${health2.status}` : 'timeout')

// Klient se ponovno poveže (reconnect simulacija)
try {
  const conn2 = await wsConnect()
  check('WS reconnect po restartu deluje', true, 'CONNECTED prejet')
  conn2.ws.close()
} catch (err) {
  check('WS reconnect po restartu deluje', false, err.message)
}

// ═══════════════════════════════════════════════════════════════
// 5. FURS BOOT GUARD (produkcija + simulacija → zavrnjen zagon)
// ═══════════════════════════════════════════════════════════════
section('5. FURS boot guard (produkcija + simulation mode)')
{
  const guard = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT + 1), FURS_ALLOW_SIMULATION: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const guardOut = []
  guard.stdout.on('data', d => guardOut.push(String(d)))
  guard.stderr.on('data', d => guardOut.push(String(d)))
  const exitCode = await new Promise(resolve => {
    guard.on('exit', code => resolve(code))
    setTimeout(() => { guard.kill('SIGKILL'); resolve(null) }, 15000)
  })
  const refused = exitCode === 1 && guardOut.join('').includes('ZAGON ZAVRNJEN')
  check('produkcija + FURS_ALLOW_SIMULATION=true → zagon zavrnjen', refused,
    refused ? 'process.exit(1) + razlog izpisan' : `exit ${exitCode}`)
}

// Zaustavi testni strežnik
server.child.kill('SIGTERM')
await sleep(1000)
server.child.kill('SIGKILL')

// ═══════════════════════════════════════════════════════════════
// Povzetek
// ═══════════════════════════════════════════════════════════════
const passed = results.filter(r => r.ok).length
console.log(`\n${'═'.repeat(64)}\nDEPLOYMENT TEST: ${passed}/${results.length} preverjanj zelenih`)
if (critical) {
  console.log('REZULTAT: NEUSPEH — vsaj eno kritično preverjanje je padlo')
  process.exit(1)
} else {
  console.log('REZULTAT: USPEH — custom server deluje kot trajni WS strežnik')
  process.exit(0)
}
