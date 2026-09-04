// ============================================
// CHAOS ENGINEERING — k6 Load Test
// ============================================
// TEST 3.1: Database failure med peak hour
//
// Uporaba:
//   k6 run --env BASE_URL=https://restaurantos-7pqmhtubw-robertpezdirc12-designs-projects.vercel.app \
//          --env PIN=1234 \
//          tests/chaos/load-test.js
//
// Po 30 sekundah ročno suspendiraj Neon DB (Neon dashboard → Suspend).
// k6 še vedno pošilja requeste — opazuj kako sistem odgovarja.
// Po 60 sekundah resume Neon DB in pusti k6 da konča.
// ============================================

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const PIN = __ENV.PIN || '1234'

// Custom metrike
const dbErrors = new Counter('db_errors')
const orderLatency = new Trend('order_latency', true)
const paymentLatency = new Trend('payment_latency', true)
const authLatency = new Trend('auth_latency', true)

// ─── Test konfiguracija ─────────────────────────────────────────
export const options = {
  scenarios: {
    peak_hour: {
      executor: 'ramping-arrival-rate',
      startRate: 10,           // začni z 10 req/s
      timeUnit: '1s',
      preAllocatedVUs: 200,    // pred alokacija VUjev
      maxVUs: 500,             // max virtual users
      stages: [
        { duration: '10s', target: 30 },   // ramp-up: 30 req/s v 10s
        { duration: '20s', target: 50 },   // peak: 50 req/s v 20s (tu suspendiraj DB!)
        { duration: '60s', target: 50 },   // hold peak (DB resume tu)
        { duration: '30s', target: 20 },   // ramp-down
        { duration: '20s', target: 0 },    // zaključi
      ],
      tags: { scenario: 'peak_hour' },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],              // < 5% neuspelih requestov
    http_req_duration: ['p(95)<5000'],           // P95 < 5s (Hobby plan = počasen)
    db_errors: ['count<100'],                    // < 100 DB napak (po resume)
  },
  // Sejemski output za lažjo analizo
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
}

// ─── Pomožne funkcije ───────────────────────────────────────────

let sessionCookie = null
let cachedEmployeeId = null

function authenticate() {
  const res = http.post(
    `${BASE_URL}/api/auth`,
    JSON.stringify({ pin: PIN }),
    {
      headers: { 'Content-Type': 'application/json' },
      redirects: 0,
    }
  )

  authLatency.add(res.timings.duration)

  const ok = check(res, {
    'auth status 200': (r) => r.status === 200,
    'auth has token': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.token || body.employeeId || body.id
      } catch { return false }
    },
  })

  if (ok && res.cookies.token && res.cookies.token[0]) {
    sessionCookie = res.cookies.token[0].value
  }

  // Poskusi tudi preko Authorization headerja (če API uporablja token)
  if (ok) {
    try {
      const body = JSON.parse(res.body)
      if (body.token) sessionCookie = body.token
      if (body.employeeId) cachedEmployeeId = body.employeeId
      else if (body.id) cachedEmployeeId = body.id
    } catch {}
  }

  return ok
}

function makeRequest(method, path, body = null, extraHeaders = {}) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    timeout: '10s',     // Vercel Hobby = 10s timeout
    redirects: 0,
  }

  if (sessionCookie) {
    params.headers['Authorization'] = `Bearer ${sessionCookie}`
    params.headers['Cookie'] = `token=${sessionCookie}`
  }

  const url = `${BASE_URL}${path}`
  const payload = body ? JSON.stringify(body) : null

  return method === 'GET'
    ? http.get(url, params)
    : http.request(method, url, payload, params)
}

function isDbError(response) {
  if (!response) return false
  // Tipični DB error patterns
  const errorPatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'connection refused',
    'connection terminated',
    'database',
    'prisma',
    'P1001', // Prisma: Can't reach database server
    'P1002', // Prisma: Timed out
    'P1008', // Prisma: Operations timed out
    'P1017', // Prisma: Server closed the connection
    'Napaka pri',
  ]
  try {
    const body = response.body?.toString() || ''
    return errorPatterns.some(p => body.toLowerCase().includes(p.toLowerCase()))
  } catch { return false }
}

// ─── Test sekcije ───────────────────────────────────────────────

export function setup() {
  // Avtenticiraj se enkrat na začetku
  const authed = authenticate()
  if (!authed) {
    console.error('AUTH FAILED — preveri PIN in BASE_URL')
  }
  return { authed, startTime: Date.now() }
}

export default function (data) {
  // Re-authenticate vsakih 100 iteracij (če je token expired)
  if (!sessionCookie || __ITER % 100 === 0) {
    authenticate()
  }

  // Mix operations (simulira realno promet)
  const op = Math.random()

  if (op < 0.4) {
    // 40% — GET /api/orders (pogosta operacija)
    group('GET /api/orders', () => {
      const res = makeRequest('GET', '/api/orders?status=in-progress,ready')
      orderLatency.add(res.timings.duration)

      const ok = check(res, {
        'orders 200': (r) => r.status === 200,
        'orders is array': (r) => {
          try {
            const body = JSON.parse(r.body)
            return Array.isArray(body) || Array.isArray(body.orders) || Array.isArray(body.data)
          } catch { return false }
        },
      })

      if (!ok && isDbError(res)) dbErrors.add(1)
    })
  } else if (op < 0.7) {
    // 30% — GET /api/menu-items (popular)
    group('GET /api/menu-items', () => {
      const res = makeRequest('GET', '/api/menu-items')
      const ok = check(res, {
        'menu-items 200': (r) => r.status === 200,
        'menu-items has items': (r) => r.body && r.body.length > 0,
      })
      if (!ok && isDbError(res)) dbErrors.add(1)
    })
  } else if (op < 0.85) {
    // 15% — POST /api/orders (create order — simulira promet)
    group('POST /api/orders', () => {
      const body = {
        type: 'dine-in',
        tableId: null, // takeaway
        items: [
          { menuItemId: 'test-item-1', quantity: 1 },
        ],
        idempotencyKey: `chaos-${Date.now()}-${__ITER}-${Math.random().toString(36).slice(2, 8)}`,
      }
      const res = makeRequest('POST', '/api/orders', body)
      orderLatency.add(res.timings.duration)

      const ok = check(res, {
        'order create not 500': (r) => r.status !== 500,
      })

      if (!ok && isDbError(res)) dbErrors.add(1)
    })
  } else {
    // 15% — GET /api/inventory
    group('GET /api/inventory', () => {
      const res = makeRequest('GET', '/api/inventory?limit=20')
      const ok = check(res, {
        'inventory not 500': (r) => r.status !== 500,
      })
      if (!ok && isDbError(res)) dbErrors.add(1)
    })
  }

  // Poglej X-Auth-Check header za debug
  if (__ITER % 50 === 0) {
    const res = makeRequest('GET', '/api/auth/me')
    const authCheck = res.headers['X-Auth-Check']
    if (authCheck) {
      console.log(`[iter ${__ITER}] X-Auth-Check: ${authCheck}`)
    }
  }

  sleep(0.05 + Math.random() * 0.1)  // 50-150ms delay
}

export function handleSummary(data) {
  return {
    'tests/chaos/load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

// Text summary helper
function textSummary(data, options = {}) {
  const indent = options.indent || ' '
  const lines = []

  lines.push('\n=== LOAD TEST SUMMARY ===\n')

  // HTTP metrike
  if (data.metrics.http_req_duration) {
    const d = data.metrics.http_req_duration.values
    lines.push(`HTTP Duration:`)
    lines.push(`  avg: ${(d.avg / 1000).toFixed(2)}s`)
    lines.push(`  p(95): ${(d['p(95)'] / 1000).toFixed(2)}s`)
    lines.push(`  p(99): ${(d['p(99)'] / 1000).toFixed(2)}s`)
    lines.push(`  max: ${(d.max / 1000).toFixed(2)}s`)
  }

  if (data.metrics.http_req_failed) {
    const f = data.metrics.http_req_failed.values
    lines.push(`\nFailed requests: ${(f.rate * 100).toFixed(2)}% (${f.passes} failed / ${f.passes + f.fails} total)`)
  }

  if (data.metrics.db_errors) {
    lines.push(`\nDB errors: ${data.metrics.db_errors.values.count}`)
  }

  // Thresholds
  if (data.thresholds) {
    lines.push(`\n=== THRESHOLDS ===`)
    for (const [name, t] of Object.entries(data.thresholds)) {
      const status = t.ok ? '✓ PASS' : '✗ FAIL'
      lines.push(`  ${status}  ${name}`)
    }
  }

  lines.push('\n========================\n')
  return lines.join('\n')
}
