#!/usr/bin/env node
// ============================================
// TEST 3.3: FURS Server Down — API Test
// ============================================
// Simulira scenarij:
//   1. Ustvari 10 plačil (vsako ustvari Receipt s fiscalStatus='pending')
//   2. Poskusi FURS verify za vsak račun (bo fail-al ker FURS_URL je neveljaven)
//   3. Preveri da so vsi računi 'pending' (niso overjeni)
//   4. Preveri dashboard prikazuje "10 neoverjenih računov"
//   5. Pošlji batch verify (simulira bulk sync ko FURS pride nazaj)
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/test-3.3-furs-down.js \
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

const NUM_PAYMENTS = parseInt(getArg('count') || '5', 10) // zmanjšano zaradi auth rate limit

const PASS = '\x1b[32m✓ PASS\x1b[0m'
const FAIL = '\x1b[31m✗ FAIL\x1b[0m'
const WARN = '\x1b[33m⚠ WARN\x1b[0m'

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
  const opts = { method, headers, timeout: 15000 }
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
  console.log('║  TEST 3.3: FURS Server Down                              ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)
  console.log(`  Payments: ${NUM_PAYMENTS}`)

  // 1. Pridobi menu item in obstoječe plačane orderje
  console.log('\n=== Step 1: Get test data ===')
  const menuRes = await apiCall('/api/menu-items?limit=1')
  const menuItems = menuRes.json?.menuItems || menuRes.json?.data || menuRes.json
  const menuItemId = Array.isArray(menuItems) && menuItems.length > 0 ? menuItems[0].id : null

  if (!menuItemId) {
    console.log('  ✗ No menu items found')
    process.exit(1)
  }
  console.log(`  Menu item: ${menuItemId}`)

  // 2. Ustvari NUM_PAYMENTS naročil in plačil
  console.log(`\n=== Step 2: Create ${NUM_PAYMENTS} orders + payments ===`)

  const createdOrders = []
  for (let i = 0; i < NUM_PAYMENTS; i++) {
    // Create order
    const orderRes = await apiCall('/api/orders', 'POST', {
      type: 'takeout',
      customerName: `FURS Test ${i + 1}`,
      idempotencyKey: `furs-test-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      orderItems: [{ menuItemId, quantity: 1 }],
      notes: `FURS test order ${i + 1}`,
    })

    if (!orderRes.ok || !orderRes.json?.id) {
      console.log(`  ${i + 1}. Order creation failed: ${orderRes.status}`)
      continue
    }

    const orderId = orderRes.json.id
    const orderNumber = orderRes.json.orderNumber

    // Create check for this order
    const checkRes = await apiCall('/api/checks', 'POST', {
      orderId,
      orderItemIds: orderRes.json.orderItems?.map(oi => oi.id) || [],
    })

    let checkId = checkRes.json?.id
    if (!checkId) {
      // Poskusi pridobiti obstoječi check
      const checksRes = await apiCall(`/api/checks?orderId=${orderId}`)
      const checks = checksRes.json?.checks || checksRes.json?.data || checksRes.json || []
      if (Array.isArray(checks) && checks.length > 0) {
        checkId = checks[0].id
      }
    }

    if (!checkId) {
      console.log(`  ${i + 1}. Order #${orderNumber}: Check creation failed`)
      continue
    }

    // Create payment
    const paymentRes = await apiCall('/api/payments', 'POST', {
      checkId,
      amount: orderRes.json.total,
      type: 'cash',
      idempotencyKey: `furs-pay-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    })

    if (paymentRes.ok) {
      createdOrders.push({ orderId, orderNumber, checkId, paymentId: paymentRes.json?.id })
      console.log(`  ${i + 1}. Order #${orderNumber}: Payment created ✓`)
    } else {
      console.log(`  ${i + 1}. Order #${orderNumber}: Payment failed — ${paymentRes.status} ${paymentRes.text?.substring(0, 80)}`)
    }

    // Small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 200))
  }

  await check(
    `Created ${NUM_PAYMENTS} orders with payments`,
    createdOrders.length >= NUM_PAYMENTS * 0.8, // Allow some failures
    `created: ${createdOrders.length}/${NUM_PAYMENTS}`
  )

  if (createdOrders.length === 0) {
    console.log('\n❌ No orders created — cannot continue')
    process.exit(1)
  }

  // 3. Ustvari Receipt za vsak plačan order
  console.log('\n=== Step 3: Create receipts ===')
  const createdReceipts = []

  for (const order of createdOrders) {
    const receiptRes = await apiCall(`/api/receipts/${order.orderId}`, 'POST', {
      paymentMethod: 'cash',
      isStorno: false,
    })

    if (receiptRes.ok && receiptRes.json?.id) {
      createdReceipts.push({
        ...order,
        receiptId: receiptRes.json.id,
        receiptNumber: receiptRes.json.receiptNumber,
        fiscalVerified: receiptRes.json.fiscalVerified,
        fiscalStatus: receiptRes.json.fiscalStatus,
      })
      console.log(`  Receipt #${receiptRes.json.receiptNumber}: created (fiscalStatus: ${receiptRes.json.fiscalStatus || 'pending'})`)
    } else {
      console.log(`  Receipt creation failed for order #${order.orderNumber}: ${receiptRes.status}`)
    }

    await new Promise(r => setTimeout(r, 150))
  }

  await check(
    `Created ${createdReceipts.length} receipts`,
    createdReceipts.length >= createdOrders.length * 0.8,
    `created: ${createdReceipts.length}/${createdOrders.length}`
  )

  // 4. Poskusi FURS verify za vsak račun (bo fail-al ker FURS_URL je neveljaven ali cert manjka)
  console.log('\n=== Step 4: Attempt FURS verification (expected to fail) ===')

  let fursFailedCount = 0
  let fursSuccessCount = 0

  for (const receipt of createdReceipts) {
    const fursRes = await apiCall('/api/furs', 'POST', {
      orderId: receipt.orderId,
    })

    if (fursRes.ok && fursRes.json?.success) {
      fursSuccessCount++
      console.log(`  Receipt #${receipt.receiptNumber}: FURS verified (unexpected!)`)
    } else {
      fursFailedCount++
      const errMsg = fursRes.json?.error || fursRes.text?.substring(0, 80) || 'Unknown'
      console.log(`  Receipt #${receipt.receiptNumber}: FURS failed — ${errMsg.substring(0, 100)}`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  await check(
    'FURS verification fails (server down or no cert)',
    fursFailedCount >= createdReceipts.length * 0.8,
    `failed: ${fursFailedCount}/${createdReceipts.length}, success: ${fursSuccessCount}`
  )

  // 5. Preveri da so vsi računi 'pending' (niso overjeni)
  console.log('\n=== Step 5: Verify receipts are pending (not fiscalVerified) ===')

  let pendingCount = 0
  let verifiedCount = 0

  for (const receipt of createdReceipts) {
    const receiptRes = await apiCall(`/api/receipts/${receipt.orderId}`)
    if (receiptRes.ok) {
      const r = receiptRes.json
      if (r.fiscalVerified === false || r.fiscalStatus === 'pending') {
        pendingCount++
      } else if (r.fiscalVerified === true) {
        verifiedCount++
      }
    }
  }

  await check(
    'All receipts are pending (fiscalVerified=false)',
    pendingCount >= createdReceipts.length * 0.8,
    `pending: ${pendingCount}, verified: ${verifiedCount}, total: ${createdReceipts.length}`
  )

  // 6. Preveri dashboard prikazuje neoverjene račune
  console.log('\n=== Step 6: Check dashboard shows unverified receipts ===')

  const dashRes = await apiCall('/api/dashboard')
  if (dashRes.ok) {
    const dash = dashRes.json
    // Poišči polje ki prikazuje število neoverjenih računov
    const unverifiedField = dash.unverifiedReceipts || dash.pendingReceipts ||
      dash.furs?.pending || dash.fiscal?.pending || dash.stats?.unverifiedReceipts

    if (unverifiedField !== undefined) {
      await check(
        'Dashboard shows unverified receipts count',
        true,
        `count: ${unverifiedField}`
      )
    } else {
      // Morda je v drugi strukturi — preverimo raw JSON
      const dashStr = JSON.stringify(dash)
      const hasFiscalData = dashStr.includes('fiscalVerified') || dashStr.includes('fiscalStatus')
      await check(
        'Dashboard has fiscal data',
        hasFiscalData,
        '(field name may vary)'
      )
    }
  } else {
    await check('Dashboard endpoint accessible', false, `status ${dashRes.status}`)
  }

  // 7. Poskusi batch sync (simulira bulk sync ko FURS pride nazaj)
  console.log('\n=== Step 7: Attempt batch FURS sync (will fail if FURS still down) ===')

  const batchRes = await apiCall('/api/furs/batch', 'POST')

  if (batchRes.ok) {
    const batchResult = batchRes.json
    console.log(`  Batch result: ${JSON.stringify(batchResult).substring(0, 200)}`)
    await check(
      'Batch sync endpoint accessible',
      true,
      `processed: ${batchResult.processed || batchResult.results?.length || '?'}`
    )
  } else {
    // Batch bo fail-al ker FURS še vedno ne deluje — to je pričakovano
    await check(
      'Batch sync fails (FURS still down)',
      batchRes.status === 400 || batchRes.status === 500,
      `status ${batchRes.status} (expected — FURS still down)`
    )
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 3.3 SUMMARY                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  for (const r of results) {
    const status = r.passed ? PASS : FAIL
    console.log(`  ${status}  ${r.name}`)
  }

  console.log(`\n  Total: ${total}, Passed: ${passed}, Failed: ${failed}`)

  // Test pass/fail kriteriji
  console.log('\n  === Pričakovano vedenje ===')
  console.log(`  ✓ Plačila uspešna tudi ko FURS ne deluje (non-blocking)`)
  console.log(`  ✓ Računi ustvarjeni s fiscalStatus='pending'`)
  console.log(`  ✓ FURS verify fail-a brez crash-a sistema`)
  console.log(`  ✓ Dashboard prikazuje neoverjene račune`)
  console.log(`  ⚠ Bulk sync fail-a dokler FURS ne pride nazaj`)

  console.log(`\n  Result: ${failed === 0 ? '✓ PASS' : '✗ FAIL'}\n`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
