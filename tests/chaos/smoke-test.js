// Quick smoke load test — 30s, 20 req/s
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const PIN = __ENV.PIN || '1234'
const dbErrors = new Counter('db_errors')

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.50'],     // dovolimo do 50% (live test)
    http_req_duration: ['p(95)<10000'], // P95 < 10s
  },
}

const errorPatterns = ['ECONNREFUSED','ETIMEDOUT','connection refused','database','prisma','P1001','P1002','P1017','Napaka pri']

export function setup() {
  // Avtenticiraj se v setup-u (1x)
  const res = http.post(
    `${BASE_URL}/api/auth`,
    JSON.stringify({ pin: PIN }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  const ok = check(res, { 'auth 200': r => r.status === 200 })
  if (!ok) {
    console.error('Setup auth failed')
    return { token: null }
  }
  let token = null
  try { token = JSON.parse(res.body).token } catch {}
  console.log(`Setup got token: ${token ? 'OK' : 'MISSING'}`)
  return { token }
}

export default function (data) {
  const token = data.token
  if (!token) {
    sleep(0.1)
    return
  }

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: '10s',
  }

  const op = Math.random()
  let res
  if (op < 0.5) {
    res = http.get(`${BASE_URL}/api/orders?status=in-progress,ready`, params)
  } else if (op < 0.8) {
    res = http.get(`${BASE_URL}/api/menu-items`, params)
  } else {
    res = http.get(`${BASE_URL}/api/inventory?limit=20`, params)
  }

  const ok = check(res, {
    'not 500': r => r.status !== 500,
    'not 502': r => r.status !== 502,
    'not 401': r => r.status !== 401,  // token should work
  })

  if (!ok) {
    try {
      const body = res.body?.toString() || ''
      if (errorPatterns.some(p => body.toLowerCase().includes(p.toLowerCase()))) {
        dbErrors.add(1)
      }
    } catch {}
  }

  sleep(0.05 + Math.random() * 0.05)
}
