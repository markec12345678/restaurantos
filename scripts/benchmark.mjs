#!/usr/bin/env node
// ============================================
// PERFORMANCE BENCHMARK — RestaurantOS API
// ============================================
// Meri odzivne čase ključnih API endpointov.
//
// Uporaba:
//   node scripts/benchmark.mjs                              # localhost:3000
//   BASE_URL=https://restaurantos-theta.vercel.app node scripts/benchmark.mjs
// ============================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const PIN = '1234'
const ROUNDS = 5 // Število meritev na endpoint

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

async function measure(label, fn) {
  const times = []
  for (let i = 0; i < ROUNDS; i++) {
    const start = performance.now()
    try {
      await fn()
      const elapsed = performance.now() - start
      times.push(elapsed)
    } catch {
      times.push(-1)
    }
  }
  const valid = times.filter(t => t > 0)
  if (valid.length === 0) {
    console.log(`${COLORS.red}❌ ${label.padEnd(35)} FAILED${COLORS.reset}`)
    return { label, avg: -1, min: -1, max: -1, p95: -1 }
  }
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const sorted = [...valid].sort((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || max

  const color = avg < 200 ? COLORS.green : avg < 500 ? COLORS.yellow : COLORS.red
  console.log(`${color}✅ ${label.padEnd(35)} avg: ${avg.toFixed(0)}ms  min: ${min.toFixed(0)}ms  max: ${max.toFixed(0)}ms  p95: ${p95.toFixed(0)}ms${COLORS.reset}`)
  return { label, avg, min, max, p95 }
}

async function main() {
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  RestaurantOS Performance Benchmark${COLORS.reset}`)
  console.log(`${COLORS.cyan}  Target: ${BASE_URL}${COLORS.reset}`)
  console.log(`${COLORS.cyan}  Rounds: ${ROUNDS} per endpoint${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════\n${COLORS.reset}`)

  // ─── Login ──────────────────────────────────
  let token = ''
  await measure('POST /api/auth (login)', async () => {
    const resp = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: PIN }),
    })
    const data = await resp.json()
    if (data.token) token = data.token
  })

  if (!token) {
    console.log(`\n${COLORS.red}❌ Login failed — cannot continue${COLORS.reset}`)
    process.exit(1)
  }

  const authHeader = { Authorization: `Bearer ${token}` }

  // ─── GET endpoints ──────────────────────────
  const results = []

  results.push(await measure('GET /api/health', async () => {
    await fetch(`${BASE_URL}/api/health`)
  }))

  results.push(await measure('GET /api/health?detailed=true', async () => {
    await fetch(`${BASE_URL}/api/health?detailed=true`)
  }))

  results.push(await measure('GET /api/tables', async () => {
    await fetch(`${BASE_URL}/api/tables`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/menu-items?simple=true', async () => {
    await fetch(`${BASE_URL}/api/menu-items?simple=true&limit=50`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/menu-items (full include)', async () => {
    await fetch(`${BASE_URL}/api/menu-items?limit=50`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/orders?limit=20', async () => {
    await fetch(`${BASE_URL}/api/orders?limit=20`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/configuration', async () => {
    await fetch(`${BASE_URL}/api/configuration`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/settings', async () => {
    await fetch(`${BASE_URL}/api/settings`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/employees', async () => {
    await fetch(`${BASE_URL}/api/employees`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/dashboard', async () => {
    await fetch(`${BASE_URL}/api/dashboard`, { headers: authHeader })
  }))

  results.push(await measure('GET /api/public/menu', async () => {
    await fetch(`${BASE_URL}/api/public/menu`)
  }))

  results.push(await measure('GET /api/furs', async () => {
    await fetch(`${BASE_URL}/api/furs`, { headers: authHeader })
  }))

  // ─── Summary ────────────────────────────────
  console.log(`\n${COLORS.cyan}═══════════════════════════════════════════════${COLORS.reset}`)
  console.log(`${COLORS.cyan}  SUMMARY${COLORS.reset}`)
  console.log(`${COLORS.cyan}═══════════════════════════════════════════════${COLORS.reset}`)

  const validResults = results.filter(r => r.avg > 0)
  const overallAvg = validResults.reduce((s, r) => s + r.avg, 0) / validResults.length
  const fastest = validResults.reduce((a, b) => a.avg < b.avg ? a : b)
  const slowest = validResults.reduce((a, b) => a.avg > b.avg ? a : b)

  console.log(`  Endpoints tested: ${validResults.length}`)
  console.log(`  Overall average:  ${overallAvg.toFixed(0)}ms`)
  console.log(`  Fastest:          ${fastest.label} (${fastest.avg.toFixed(0)}ms)`)
  console.log(`  Slowest:          ${slowest.label} (${slowest.avg.toFixed(0)}ms)`)

  const targetMet = overallAvg < 300
  console.log(`\n  Target: <300ms average`)
  console.log(`  ${targetMet ? COLORS.green + '✅ PASSED' : COLORS.yellow + '⚠️ ABOVE TARGET'}${COLORS.reset}`)

  // ─── Performance targets ────────────────────
  console.log(`\n${COLORS.gray}  Performance targets:${COLORS.reset}`)
  console.log(`  ${COLORS.gray}P50 < 200ms:  ${validResults.filter(r => r.avg < 200).length}/${validResults.length} endpoints${COLORS.reset}`)
  console.log(`  ${COLORS.gray}P95 < 500ms:  ${validResults.filter(r => r.p95 < 500).length}/${validResults.length} endpoints${COLORS.reset}`)
  console.log(`  ${COLORS.gray}All < 1000ms: ${validResults.filter(r => r.max < 1000).length}/${validResults.length} endpoints${COLORS.reset}`)
  console.log('')
}

main().catch((err) => {
  console.error(`${COLORS.red}Benchmark failed:${COLORS.reset}`, err.message)
  process.exit(1)
})
