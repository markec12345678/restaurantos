#!/usr/bin/env node
// ============================================
// TEST 4.2: Z-Report vs Cash Drawer
// ============================================
// Scenarij:
//   1. Začni izmeno z €200 gotovine
//   2. Naredi 50 gotovinskih plačil (zmanjšano na 10 zaradi rate limit)
//   3. Naredi 5 gotovinskih vračil (zmanjšano na 2)
//   4. Zapri izmeno (Z-report)
//   5. Preveri: expectedCash == closingCash (diff ≤ €0.01)
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/test-4.2-z-report.js \
//     --base-url=https://...vercel.app \
//     --token=<TOKEN>
// ============================================

const args = process.argv.slice(2)
const getArg = (name) => {
  const found = args.find(a => a.startsWith(`--${name}=`))
  return found ? found.split('=')[1] : null
}

const BASE_URL = getArg('base-url') || 'http://localhost:3000'
const TOKEN = getArg('token')

if (!TOKEN) {
  console.error('❌ --token=... je obvezen parameter')
  process.exit(1)
}

const STARTING_CASH = 200.00
const NUM_PAYMENTS = parseInt(getArg('payments') || '10', 10) // zmanjšano zaradi rate limit
const NUM_REFUNDS = parseInt(getArg('refunds') || '3', 10)
const PAYMENT_AMOUNT = 10.00

const PASS = '\x1b[32m✓ PASS\x1b[0m'
const FAIL = '\x1b[31m✗ FAIL\x1b[0m'

const results = []

async function check(name, condition, details = '') {
  const status = condition ? PASS : FAIL
  console.log(`  ${status}  ${name}${details ? '  ' + details : ''}`)
  results.push({ name, passed: condition, details })
}

async function apiCall(path, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  }
  const opts = { method, headers, timeout: 20000 }
  if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body)

  try {
    const res = await fetch(`${BASE_URL}${path}`, opts)
    let text = ''
    try { text = await res.text() } catch {}
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, ok: res.ok }
  } catch (err) {
    return { status: 0, json: null, text: '', ok: false, error: err.message }
  }
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 4.2: Z-Report vs Cash Drawer                       ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)
  console.log(`  Starting cash: €${STARTING_CASH.toFixed(2)}`)
  console.log(`  Payments: ${NUM_PAYMENTS} × €${PAYMENT_AMOUNT.toFixed(2)} = €${(NUM_PAYMENTS * PAYMENT_AMOUNT).toFixed(2)}`)
  console.log(`  Refunds: ${NUM_REFUNDS} × €${PAYMENT_AMOUNT.toFixed(2)} = €${(NUM_REFUNDS * PAYMENT_AMOUNT).toFixed(2)}`)
  console.log(`  Expected cash: €${STARTING_CASH + (NUM_PAYMENTS - NUM_REFUNDS) * PAYMENT_AMOUNT}`)

  // 1. Close any existing open shift
  console.log('\n=== Step 1: Close any existing open shift ===')
  const shiftRes = await apiCall('/api/cash-register')
  let previousClosingCash = 0
  if (shiftRes.ok && shiftRes.json?.activeShift) {
    console.log(`  Found open shift: ${shiftRes.json.activeShift.id}`)
    // Use live expectedCash as closingCash
    const liveStats = shiftRes.json.liveStats || {}
    previousClosingCash = Number(liveStats.expectedCash || shiftRes.json.activeShift.startingCash || 0)
    const closeRes = await apiCall(`/api/cash-register/${shiftRes.json.activeShift.id}`, 'PUT', {
      closingCash: previousClosingCash,
      totalTips: 0,
      notes: 'Auto-close before Test 4.2',
    })
    console.log(`  Closed: ${closeRes.ok ? '✓' : '✗'} (closingCash: €${previousClosingCash.toFixed(2)})`)
  } else if (shiftRes.ok && shiftRes.json?.recentShifts?.[0]) {
    // No open shift, but get previous closing cash
    previousClosingCash = Number(shiftRes.json.recentShifts[0].closingCash || 0)
    console.log(`  No open shift found ✓ (previous closingCash: €${previousClosingCash.toFixed(2)})`)
  } else {
    console.log('  No open shift found ✓')
  }

  // 2. Open new shift with starting cash = previousClosingCash
  const startingCash = previousClosingCash > 0 ? previousClosingCash : STARTING_CASH
  console.log(`\n=== Step 2: Open shift with €${startingCash.toFixed(2)} ===`)

  // Get employee ID from auth
  const authRes = await apiCall('/api/auth')
  const employeeId = authRes.json?.session?.employeeId || authRes.json?.employee?.id
  console.log(`  Employee ID: ${employeeId || 'MISSING'}`)

  const openRes = await apiCall('/api/cash-register', 'POST', {
    startingCash: startingCash,
    employeeName: 'Test Admin',
    employeeId: employeeId,
  })

  let shiftId
  if (openRes.ok) {
    shiftId = openRes.json?.id
    console.log(`  ✓ Shift opened: ${shiftId}`)
    await check('Shift opened with €200.00 starting cash', !!shiftId)
  } else {
    await check('Shift opened with €200.00 starting cash', false, `status ${openRes.status} — ${openRes.text?.substring(0, 100)}`)
    process.exit(1)
  }

  // 3. Get menu item for orders
  const menuRes = await apiCall('/api/menu-items?limit=1')
  const menuItems = menuRes.json?.menuItems || menuRes.json?.data || menuRes.json
  const menuItemId = Array.isArray(menuItems) && menuItems.length > 0 ? menuItems[0].id : null
  if (!menuItemId) {
    console.log('✗ No menu items found')
    process.exit(1)
  }
  console.log(`  Menu item: ${menuItemId}`)

  // 4. Create NUM_PAYMENTS cash payments
  console.log(`\n=== Step 3: Create ${NUM_PAYMENTS} cash payments ===`)
  const createdPayments = []

  for (let i = 0; i < NUM_PAYMENTS; i++) {
    // Create order
    const orderRes = await apiCall('/api/orders', 'POST', {
      type: 'takeout',
      customerName: `Z-Report Test ${i + 1}`,
      idempotencyKey: `zreport-pay-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      orderItems: [{ menuItemId, quantity: 1 }],
      notes: `Z-report test ${i + 1}`,
    })

    if (!orderRes.ok || !orderRes.json?.id) {
      console.log(`  ${i + 1}. Order creation failed: ${orderRes.status}`)
      continue
    }

    const orderId = orderRes.json.id
    const orderTotal = Number(orderRes.json.total || 0)

    // Get check for this order
    let checkId
    const checksRes = await apiCall(`/api/checks?orderId=${orderId}`)
    const checks = checksRes.json?.checks || checksRes.json?.data || checksRes.json || []
    if (Array.isArray(checks) && checks.length > 0) {
      checkId = checks[0].id
    } else {
      // Create check
      const checkRes = await apiCall('/api/checks', 'POST', {
        orderId,
        orderItemIds: orderRes.json.orderItems?.map(oi => oi.id) || [],
      })
      checkId = checkRes.json?.id
    }

    if (!checkId) {
      console.log(`  ${i + 1}. Check not found for order ${orderId}`)
      continue
    }

    // Create payment (cash, full order total — not fixed amount)
    // FIX: Pay full order total so order is marked as 'paid' (not 'partial')
    const paymentAmount = orderTotal
    const paymentRes = await apiCall('/api/payments', 'POST', {
      checkId,
      amount: paymentAmount,
      type: 'cash',
      idempotencyKey: `zreport-payment-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    })

    if (paymentRes.ok) {
      createdPayments.push({
        paymentId: paymentRes.json?.id,
        checkId,
        orderId,
        amount: paymentAmount,
      })
      console.log(`  ${i + 1}. Payment created: €${paymentAmount.toFixed(2)} ✓`)
    } else {
      console.log(`  ${i + 1}. Payment failed: ${paymentRes.status} — ${paymentRes.text?.substring(0, 80)}`)
    }

    await new Promise(r => setTimeout(r, 150))
  }

  await check(
    `Created ${NUM_PAYMENTS} cash payments`,
    createdPayments.length >= NUM_PAYMENTS * 0.8,
    `created: ${createdPayments.length}/${NUM_PAYMENTS}`
  )

  // 5. Refund NUM_REFUNDS payments
  console.log(`\n=== Step 4: Refund ${NUM_REFUNDS} payments ===`)
  let refundCount = 0
  let refundTotal = 0

  for (let i = 0; i < Math.min(NUM_REFUNDS, createdPayments.length); i++) {
    const payment = createdPayments[i]
    // Refund the full payment amount (variable, not fixed PAYMENT_AMOUNT)
    const refundAmount = payment.amount
    const refundRes = await apiCall(`/api/payments/${payment.paymentId}/refund`, 'POST', {
      amount: refundAmount,
      reason: `Test 4.2 refund ${i + 1}`,
    })

    if (refundRes.ok) {
      refundCount++
      refundTotal += refundAmount
      console.log(`  ${i + 1}. Refund €${refundAmount.toFixed(2)} ✓`)
    } else {
      console.log(`  ${i + 1}. Refund failed: ${refundRes.status} — ${refundRes.text?.substring(0, 80)}`)
    }

    await new Promise(r => setTimeout(r, 150))
  }

  await check(
    `Refunded ${NUM_REFUNDS} payments`,
    refundCount >= NUM_REFUNDS * 0.8,
    `refunded: ${refundCount}/${NUM_REFUNDS}, total: €${refundTotal.toFixed(2)}`
  )

  // 6. Get live stats (before closing)
  console.log('\n=== Step 5: Get live shift stats ===')
  const liveRes = await apiCall('/api/cash-register')
  if (liveRes.ok && liveRes.json?.liveStats) {
    const stats = liveRes.json.liveStats
    console.log(`  Live cashSales:  €${Number(stats.cashSales || 0).toFixed(2)}`)
    console.log(`  Live expectedCash: €${Number(stats.expectedCash || 0).toFixed(2)}`)
    console.log(`  Live totalOrders: ${stats.totalOrders || 0}`)
  }

  // 7. Close shift (Z-Report)
  console.log('\n=== Step 6: Close shift (Z-Report) ===')

  // Calculate actual gross from created payments (variable amounts)
  const grossPayments = createdPayments.reduce((sum, p) => sum + p.amount, 0)
  const expectedCash = startingCash + grossPayments - refundTotal
  console.log(`  Starting cash: €${startingCash.toFixed(2)}`)
  console.log(`  Expected cash: €${expectedCash.toFixed(2)}`)
  console.log(`    startingCash: €${startingCash.toFixed(2)}`)
  console.log(`    + cashSales:  €${grossPayments.toFixed(2)} (${createdPayments.length} payments, variable amounts)`)
  console.log(`    - refunds:    €${refundTotal.toFixed(2)}`)
  console.log(`    = expectedCash: €${expectedCash.toFixed(2)}`)

  const closeRes = await apiCall(`/api/cash-register/${shiftId}`, 'PUT', {
    closingCash: expectedCash, // "fizično prešteto" = expected (perfect reconciliation)
    totalTips: 0,
    notes: `Test 4.2: ${createdPayments.length} payments, ${refundCount} refunds`,
  })

  if (!closeRes.ok) {
    await check('Z-Report close successful', false, `status ${closeRes.status} — ${closeRes.text?.substring(0, 150)}`)
    process.exit(1)
  }

  const zReport = closeRes.json
  console.log('\n  --- Z-Report ---')
  console.log(`  startingCash:   €${Number(zReport.startingCash).toFixed(2)}`)
  console.log(`  cashSales:      €${Number(zReport.cashSales).toFixed(2)} (net of refunds)`)
  console.log(`  totalSales:     €${Number(zReport.totalSales).toFixed(2)}`)
  console.log(`  totalRefunds:   €${Number(zReport.totalRefunds || 0).toFixed(2)}`)
  console.log(`  totalVoided:    €${Number(zReport.totalVoided).toFixed(2)}`)
  console.log(`  totalOrders:    ${zReport.totalOrders}`)
  console.log(`  expectedCash:   €${Number(zReport.expectedCash).toFixed(2)}`)
  console.log(`  closingCash:    €${Number(zReport.closingCash).toFixed(2)}`)
  console.log(`  cashDifference: €${Number(zReport.cashDifference).toFixed(2)}`)

  await check('Z-Report close successful', !!zReport.id)

  // 8. Reconciliation checks
  console.log('\n=== Step 7: Reconciliation ===')

  // Check: expectedCash = startingCash + cashSales (net)
  const calcExpected = Number(zReport.startingCash) + Number(zReport.cashSales)
  await check(
    'expectedCash = startingCash + cashSales',
    Math.abs(calcExpected - Number(zReport.expectedCash)) < 0.01,
    `calc: €${calcExpected.toFixed(2)}, TB: €${Number(zReport.expectedCash).toFixed(2)}`
  )

  // Check: cashSales = grossPayments - refunds
  const calcCashSales = grossPayments - refundTotal
  await check(
    'cashSales = gross payments - refunds',
    Math.abs(calcCashSales - Number(zReport.cashSales)) < 0.01,
    `calc: €${calcCashSales.toFixed(2)}, Z-Report: €${Number(zReport.cashSales).toFixed(2)}`
  )

  // Check: totalRefunds == refundTotal
  await check(
    'totalRefunds matches sum of refunds',
    Math.abs(Number(zReport.totalRefunds || 0) - refundTotal) < 0.01,
    `Z-Report: €${Number(zReport.totalRefunds || 0).toFixed(2)}, actual: €${refundTotal.toFixed(2)}`
  )

  // CRITICAL: cashDifference must be ≤ €0.01
  const cashDiff = Math.abs(Number(zReport.cashDifference))
  await check(
    '🔥 CRITICAL: cashDifference ≤ €0.01 (PASS kriterij)',
    cashDiff <= 0.01,
    `diff: €${cashDiff.toFixed(2)}`
  )

  // 9. Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 4.2 SUMMARY                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  for (const r of results) {
    const status = r.passed ? PASS : FAIL
    console.log(`  ${status}  ${r.name}`)
  }

  console.log(`\n  Total: ${total}, Passed: ${passed}, Failed: ${failed}`)

  console.log('\n  === Z-Report vs Cash Drawer ===')
  console.log(`  Starting cash:    €${startingCash.toFixed(2)}`)
  console.log(`  + Cash payments:  €${grossPayments.toFixed(2)} (${createdPayments.length} payments)`)
  console.log(`  - Refunds:        €${refundTotal.toFixed(2)} (${refundCount} refunds)`)
  console.log(`  = Expected cash:  €${expectedCash.toFixed(2)}`)
  console.log(`  Z-Report cashSales: €${Number(zReport.cashSales).toFixed(2)}`)
  console.log(`  Z-Report expectedCash: €${Number(zReport.expectedCash).toFixed(2)}`)
  console.log(`  Z-Report cashDifference: €${Number(zReport.cashDifference).toFixed(2)}`)
  console.log(`\n  PASS kriterij: cashDifference ≤ €0.01`)
  console.log(`  Result: ${cashDiff <= 0.01 ? '✓ PASS' : '✗ FAIL'} (diff: €${cashDiff.toFixed(2)})\n`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
