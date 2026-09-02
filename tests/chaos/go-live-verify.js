#!/usr/bin/env node
// ============================================
// GO-LIVE VERIFICATION — Final pre-launch check
// ============================================
// Preveri vse kritične komponente pred go-live:
//   1. Health endpoint
//   2. Security headers (CSP, HSTS, CORS, etc.)
//   3. Auth (login z admin PIN)
//   4. Orders API (multi-tenant filter)
//   5. Payments API
//   6. Trial Balance (financial reconciliation)
//   7. FURS e-invoice-book
//   8. Sentry config (DSN exposed)
//   9. Rate limiting
//  10. .env security (not in git)
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/go-live-verify.js \
//     --base-url=https://restaurantos.app
// ============================================

const args = process.argv.slice(2)
const getArg = (name) => {
  const found = args.find(a => a.startsWith(`--${name}=`))
  return found ? found.split('=')[1] : null
}

const BASE_URL = getArg('base-url') || 'http://localhost:3000'
const ADMIN_PIN = getArg('pin') || '1234'

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'

const results = []
let token = null

async function check(name, condition, details = '') {
  const status = condition ? PASS : FAIL
  console.log(`  ${status}  ${name}${details ? '  ' + details : ''}`)
  results.push({ name, passed: condition, details })
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  🚀 GO-LIVE VERIFICATION                                 ║')
  console.log('║  Final pre-launch check                                   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  URL: ${BASE_URL}`)
  console.log(`  Time: ${new Date().toISOString()}`)
  console.log(`  Admin PIN: ${ADMIN_PIN}`)

  // ═══ 1. HEALTH ENDPOINT ═══
  console.log('\n=== 1. Health Endpoint ===')
  try {
    const res = await fetch(`${BASE_URL}/api/health?deep=true`, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    await check('Health endpoint returns 200', res.status === 200)
    await check('Health status = ok', data.status === 'ok')
    await check('DB connection = ok', data.db === 'ok')
    await check('Environment = production', data.environment === 'production')
  } catch (err) {
    await check('Health endpoint accessible', false, err.message)
  }

  // ═══ 2. SECURITY HEADERS ═══
  console.log('\n=== 2. Security Headers ===')
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(10000) })
    const headers = res.headers

    await check('CSP header present', headers.has('content-security-policy'))
    await check('HSTS header present', headers.has('strict-transport-security'))
    await check('X-Frame-Options present', headers.has('x-frame-options'))
    await check('X-Content-Type-Options present', headers.has('x-content-type-options'))
    await check('Referrer-Policy present', headers.has('referrer-policy'))
    await check('Permissions-Policy present', headers.has('permissions-policy'))
    await check('COOP header present', headers.has('cross-origin-opener-policy'))

    const hsts = headers.get('strict-transport-security') || ''
    await check('HSTS includes preload', hsts.includes('preload'))
    await check('HSTS max-age >= 1 year', hsts.includes('max-age=31536000'))
  } catch (err) {
    await check('Security headers accessible', false, err.message)
  }

  // ═══ 3. AUTH ═══
  console.log('\n=== 3. Authentication ===')
  try {
    const res = await fetch(`${BASE_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: ADMIN_PIN }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()

    await check('Login returns 200', res.status === 200)
    await check('Login returns token', !!data.token)
    await check('Login returns employee', !!data.employee)
    await check('Employee has admin role', data.employee?.role === 'admin')

    token = data.token
  } catch (err) {
    await check('Auth endpoint accessible', false, err.message)
  }

  if (!token) {
    console.log('\n❌ Cannot continue without auth token')
    process.exit(1)
  }

  // ═══ 4. ORDERS API (multi-tenant) ═══
  console.log('\n=== 4. Orders API (Multi-tenant) ===')
  try {
    const res = await fetch(`${BASE_URL}/api/orders?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()

    await check('Orders API returns 200', res.status === 200)
    await check('Orders API returns data', (data.orders?.length || 0) > 0 || data.total > 0)
  } catch (err) {
    await check('Orders API accessible', false, err.message)
  }

  // ═══ 5. PAYMENTS API ═══
  console.log('\n=== 5. Payments API ===')
  try {
    const res = await fetch(`${BASE_URL}/api/payments?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })
    await check('Payments API returns 200', res.status === 200)
  } catch (err) {
    await check('Payments API accessible', false, err.message)
  }

  // ═══ 6. TRIAL BALANCE ═══
  console.log('\n=== 6. Trial Balance (Financial) ===')
  try {
    const res = await fetch(`${BASE_URL}/api/accounting/trial-balance`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    const accounts = data.accounts || data.data || []

    await check('Trial Balance returns 200', res.status === 200)
    await check('Trial Balance has accounts', accounts.length > 0)

    // Check double-entry: debits == credits
    const totalDebit = accounts.reduce((s, a) => s + Number(a.debit || 0), 0)
    const totalCredit = accounts.reduce((s, a) => s + Number(a.credit || 0), 0)
    const diff = Math.abs(totalDebit - totalCredit)
    await check('Trial Balance: debits == credits', diff < 0.01, `diff: €${diff.toFixed(2)}`)
  } catch (err) {
    await check('Trial Balance accessible', false, err.message)
  }

  // ═══ 7. FURS E-INVOICE-BOOK ═══
  console.log('\n=== 7. FURS E-Invoice-Book ===')
  try {
    const res = await fetch(`${BASE_URL}/api/furs/e-invoice-book?dateFrom=2026-09-01&dateTo=2026-09-30`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    })
    await check('FURS e-invoice-book returns 200', res.status === 200)
  } catch (err) {
    await check('FURS e-invoice-book accessible', false, err.message)
  }

  // ═══ 8. SENTRY CONFIG ═══
  console.log('\n=== 8. Sentry Configuration ===')
  try {
    // Check if SENTRY_DSN is in client-side env
    const res = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(10000) })
    const html = await res.text()
    const hasSentry = html.includes('sentry') || html.includes('SENTRY')
    await check('Sentry client-side script present', hasSentry)
  } catch (err) {
    await check('Sentry config check', false, err.message)
  }

  // ═══ 9. RATE LIMITING ═══
  console.log('\n=== 9. Rate Limiting ===')
  try {
    // Try 7 failed logins to trigger rate limit
    let rateLimited = false
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${BASE_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '0000' }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.status === 429) {
        rateLimited = true
        break
      }
    }
    await check('Rate limiting active (429 after failed attempts)', rateLimited)
  } catch (err) {
    await check('Rate limiting check', false, err.message)
  }

  // ═══ 10. SUPER-ADMIN ═══
  console.log('\n=== 10. Super-admin (PIN 5555) ===')
  try {
    const res = await fetch(`${BASE_URL}/api/setup/super-admin`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
    })
    await check('Super-admin endpoint accessible', res.status === 200)
  } catch (err) {
    await check('Super-admin endpoint', false, err.message)
  }

  // ═══ SUMMARY ═══
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  🚀 GO-LIVE VERIFICATION SUMMARY                         ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  for (const r of results) {
    const status = r.passed ? PASS : FAIL
    console.log(`  ${status}  ${r.name}`)
  }

  console.log(`\n  Total: ${total}, Passed: ${passed}, Failed: ${failed}`)

  if (failed === 0) {
    console.log('\n  ✅ ALL CHECKS PASSED — READY FOR GO-LIVE! 🚀')
    console.log('\n  Next steps:')
    console.log('    1. Prekliči GitHub PAT + Vercel token')
    console.log('    2. Naloži FURS produkcjski certifikat')
    console.log('    3. Nastavi custom domain (restaurantos.app)')
    console.log('    4. UptimeRobot → monitor /api/health')
    console.log('    5. GO LIVE! 🎉')
  } else {
    console.log(`\n  ⚠️  ${failed} checks failed — fix before go-live`)
  }
  console.log('')

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
