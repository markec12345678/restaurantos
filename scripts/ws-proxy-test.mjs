#!/usr/bin/env node
/**
 * ws-proxy-test.mjs — §5.1b iz docs/STAGING_DEPLOYMENT.md: WebSocket SKOZI
 * reverse proxy (preverja Upgrade/Connection glave — najpogostejša napaka
 * pri WS deploymentu!).
 *
 * Namestniški scenarij (vodnik §5.1b): KDS push mora delovati PREK proxy-ja
 * (Caddy/nginx), ne samo direktno. Ta skripta:
 *
 *   1. zažene MINI reverse proxy (http + 'upgrade' dogodek) na --via naslovu
 *      in posreduje vse zahteve na --target (DEMO lokalnega Caddyja);
 *   2. GET /api/health SKOZI proxy → mora vrniti 200;
 *   3. WS povezava ws://--via/ws → handshake mora USPETI (upgrade glave!);
 *   4. neavtenticirano sporočilo → strežnik odgovori AUTH_REQUIRED;
 *   5. token v URL-ju (?token=…) → handshake ZAVRNJEN (401).
 *
 * Na PRAVEM staging strežniku lahko skripto poganjaš BREZ lastnega proxy-ja:
 *   node scripts/ws-proxy-test.mjs --target https://staging.domena.si --external
 * (takrat se uporabi JAVNI vstop skozi že nameščen Caddy/nginx — TLS + WS
 * upgrade prekTESTIRAN v produkcijski konfiguraciji.)
 *
 * Izhod: 0 = vsi preskusi zeleni, 1 = vsaj en rdeč ( FAIL-CLOSED).
 */
import http from 'node:http'
import { WebSocket } from 'ws'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const TARGET = flag('target') || 'http://127.0.0.1:3000'
const EXTERNAL = args.includes('--external')
const VIA_PORT = parseInt(flag('via') || '3998', 10)
const VIA = `http://127.0.0.1:${VIA_PORT}`

const results = []
let failed = false
function check(name, ok, detail = '') {
  results.push({ name, ok })
  if (!ok) failed = true
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const targetUrl = new URL(TARGET)
const targetHost = targetUrl.hostname
const targetPort = parseInt(targetUrl.port || (targetUrl.protocol === 'https:' ? '443' : '80'), 10)

function wsUrl(via, withToken = false) {
  const u = new URL(via)
  const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
  const tokenQ = withToken ? '?token=forged-token-123' : ''
  return `${proto}//${u.host}/ws${tokenQ}`
}

function connectWs(url, { expectOpen, timeoutMs = 8000 } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { handshakeTimeout: timeoutMs })
    let opened = false
    const done = (result) => {
      // ne odstrani listenerjev (error bi ostal brez handlerja → crash);
      // pusti no-op handler in zapri
      ws.on('error', () => {})
      try { ws.close() } catch {}
      try { ws.terminate() } catch {}
      resolve(result)
    }
    ws.on('open', () => { opened = true })
    ws.on('unexpected-response', (_req, res) => done({ opened: false, status: res.statusCode }))
    ws.on('error', (err) => {
      done({ opened: opened, error: String(err.message || err) })
    })
    ws.on('message', (data) => {
      done({ opened: true, message: String(data) })
    })
    setTimeout(() => done({ opened: opened, timeout: true }), timeoutMs)
  })
}

async function waitFor(fn, timeoutMs = 15000, intervalMs = 300) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

async function main() {
  console.log(`[ws-proxy-test] Cilj: ${TARGET}${EXTERNAL ? ' (zunanji proxy — že nameščen)' : ` (prek lastnega proxy-ja :${VIA_PORT})`}`)

  let proxy
  if (!EXTERNAL) {
    // ── Mini reverse proxy (http + upgrade) — lokalni dvojnik Caddyja ──
    proxy = http.createServer((req, res) => {
      const p = http.request(
        { host: targetHost, port: targetPort, path: req.url, method: req.method, headers: req.headers },
        (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res) },
      )
      p.on('error', () => { res.writeHead(502); res.end('proxy error') })
      req.pipe(p)
    })
    // KLJUČNO: posredovanje WS upgrade dogodkov (Connection: Upgrade)
    proxy.on('upgrade', (req, socket, head) => {
      const p = http.request({
        host: targetHost, port: targetPort, path: req.url, method: req.method,
        headers: { ...req.headers, host: `${targetHost}:${targetPort}` },
      })
      p.on('upgrade', (up, upSocket, upHead) => {
        socket.write(
          `HTTP/1.1 ${up.statusCode} ${up.statusMessage}\r\n` +
          Object.entries(up.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n',
        )
        upSocket.pipe(socket).pipe(upSocket)
        if (upHead && upHead.length) socket.write(upHead)
      })
      p.on('error', () => socket.destroy())
      p.end()
    })
    await new Promise((r) => proxy.listen(VIA_PORT, '127.0.0.1', r))
    console.log(`[ws-proxy-test] Mini proxy posluša na ${VIA} → ${TARGET}`)
  }

  const via = EXTERNAL ? TARGET : VIA

  // 1. HTTP health skozi proxy
  {
    let ok = false
    const healthy = await waitFor(async () => {
      try {
        const res = await fetch(`${via}/api/health`)
        ok = res.ok
        return ok
      } catch { return false }
    })
    check('HTTP GET /api/health SKOZI proxy → 200', healthy && ok)
  }

  // 2. WS handshake skozi proxy (upgrade glave!)
  {
    const r = await connectWs(wsUrl(via))
    check('WS handshake skozi proxy (Upgrade/Connection glave)', r.opened === true,
      r.status ? `status ${r.status}` : (r.error || ''))
  }

  // 3. Neavtenticirano sporočilo → AUTH_REQUIRED
  // (strežnik najprej pošlje CONNECTED, po sporočilu brez tokena AUTH_REQUIRED)
  {
    const r = await connectWs(wsUrl(via))
    if (r.opened) {
      const reply = await new Promise((resolve) => {
        const ws = new WebSocket(wsUrl(via), { handshakeTimeout: 8000 })
        ws.on('error', () => {})
        ws.on('message', (d) => {
          const s = String(d)
          if (/AUTH_REQUIRED/i.test(s)) {
            try { ws.close() } catch {}
            resolve(s)
          }
        })
        ws.on('open', () => ws.send(JSON.stringify({ type: 'ping' })))
        setTimeout(() => resolve('TIMEOUT — AUTH_REQUIRED ni prejet'), 8000)
      })
      check('Neavtenticirano sporočilo → AUTH_REQUIRED', /AUTH_REQUIRED/i.test(reply), String(reply).slice(0, 80))
    } else {
      check('Neavtenticirano sporočilo → AUTH_REQUIRED', false, 'WS povezava se ni odprla')
    }
  }

  // 4. Token v URL → handshake zavrnjen (401)
  {
    const r = await connectWs(wsUrl(via, true))
    check('Token v URL (?token=…) → handshake ZAVRNJEN (401)', r.opened === false,
      r.status ? `status ${r.status}` : '')
  }

  if (proxy) proxy.close()
  console.log(`\n[ws-proxy-test] Rezultat: ${results.filter((r) => r.ok).length}/${results.length}`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error('[ws-proxy-test] Napaka:', e && e.message ? e.message : e)
  process.exit(1)
})
