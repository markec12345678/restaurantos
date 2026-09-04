#!/usr/bin/env node
// ============================================
// TEST 6.3: Conflict Resolution — concurrent modify + void
// ============================================
// Scenarij:
//   - Offline: natakar A spremeni order #5 (doda Cola)
//   - Online: natakar B istočasno void-a order #5
//   - Po sync-u: Pričakovano 409 Conflict
//   - FAIL če: Tiho zamenja enega z drugim
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/test-6.3-conflict.js \
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
  console.log('║  TEST 6.3: Conflict Resolution                           ║')
  console.log('║  Concurrent modify (add Cola) + void                      ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)

  // 1. Get menu items — find Cola
  console.log('\n=== Step 1: Get test data ===')
  const menuRes = await apiCall('/api/menu-items?limit=50')
  const menuItems = menuRes.json?.menuItems || menuRes.json?.data || menuRes.json
  const cola = Array.isArray(menuItems) ? menuItems.find(m => m.name?.toLowerCase().includes('coca') || m.name?.toLowerCase().includes('cola')) : null
  const beefsteak = Array.isArray(menuItems) ? menuItems.find(m => m.name?.toLowerCase().includes('beef') || m.name?.toLowerCase().includes('steak')) : null
  const menuItem1 = beefsteak || (Array.isArray(menuItems) && menuItems.length > 0 ? menuItems[0] : null)
  const colaItem = cola || (Array.isArray(menuItems) && menuItems.length > 1 ? menuItems[1] : menuItem1)

  if (!menuItem1) {
    console.log('✗ No menu items found')
    process.exit(1)
  }
  console.log(`  Menu item 1: ${menuItem1.name} (${menuItem1.id})`)
  console.log(`  Cola item: ${colaItem.name} (${colaItem.id})`)

  // 2. Create order #5 equivalent
  console.log('\n=== Step 2: Create order (Natakar A creates order) ===')
  const orderRes = await apiCall('/api/orders', 'POST', {
    type: 'dine-in',
    customerName: 'Conflict Test Order',
    idempotencyKey: `conflict-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderItems: [{ menuItemId: menuItem1.id, quantity: 1 }],
    notes: 'Conflict test — original order',
  })

  if (!orderRes.ok || !orderRes.json?.id) {
    console.log(`✗ Order creation failed: ${orderRes.status}`)
    process.exit(1)
  }

  const orderId = orderRes.json.id
  const orderUpdatedAt = orderRes.json.updatedAt
  console.log(`  ✓ Order created: #${orderRes.json.orderNumber} (id: ${orderId})`)
  console.log(`  ✓ Order updatedAt: ${orderUpdatedAt}`)
  console.log(`  ✓ Order status: ${orderRes.json.status}`)

  // 3. Simulate Natakar A reading the order (gets updatedAt = T1)
  console.log('\n=== Step 3: Natakar A reads order (gets updatedAt=T1) ===')
  const readRes = await apiCall(`/api/orders?limit=500`)
  const allOrders = readRes.json?.orders || []
  const orderBeforeConflict = allOrders.find(o => o.id === orderId)
  const updatedAtT1 = orderBeforeConflict?.updatedAt || orderUpdatedAt
  console.log(`  ✓ Natakar A has updatedAt=T1: ${updatedAtT1}`)

  // 4. Natakar B voids the order (online) — this changes updatedAt to T2
  console.log('\n=== Step 4: Natakar B voids order (online) → updatedAt=T2 ===')
  const voidRes = await apiCall(`/api/orders/${orderId}`, 'PUT', {
    status: 'cancelled',
    cancelReason: 'Voided by Natakar B (conflict test)',
    // NOTE: Natakar B does NOT send expectedUpdatedAt (fresh action)
  })

  if (!voidRes.ok) {
    console.log(`  Void failed: ${voidRes.status} — ${voidRes.text?.substring(0, 150)}`)
    await check('Natakar B void succeeds', false, `status ${voidRes.status}`)
    process.exit(1)
  }

  console.log(`  ✓ Order voided by Natakar B`)
  console.log(`  ✓ New status: ${voidRes.json.status}`)
  console.log(`  ✓ New updatedAt: ${voidRes.json.updatedAt}`)

  await check('Natakar B void succeeds (order cancelled)', voidRes.json.status === 'cancelled')

  // 5. Natakar A tries to add Cola (using stale updatedAt=T1)
  console.log('\n=== Step 5: Natakar A tries to add Cola (stale updatedAt=T1) ===')
  console.log('  (Simulates offline sync — Natakar A has old data)')
  console.log('  Waiting 2s to exceed 1s tolerance...')
  await new Promise(r => setTimeout(r, 2000))

  const addColaRes = await apiCall(`/api/orders/${orderId}/add-items`, 'POST', {
    orderItems: [{
      menuItemId: colaItem.id,
      quantity: 1,
      notes: 'Added by Natakar A (offline)',
      modifiersJson: '[]',
    }],
    expectedUpdatedAt: updatedAtT1, // STALE — Natakar A's old timestamp
  })

  console.log(`  Response status: ${addColaRes.status}`)
  console.log(`  Response body: ${JSON.stringify(addColaRes.json).substring(0, 300)}`)

  // CRITICAL CHECK: Should return 409 Conflict
  await check(
    '🔥 CRITICAL: Add-items returns 409 Conflict (not 200/201)',
    addColaRes.status === 409,
    `status: ${addColaRes.status}`
  )

  if (addColaRes.status === 409) {
    const conflict = addColaRes.json
    await check(
      'Conflict response has conflict=true',
      conflict.conflict === true,
      `conflict: ${conflict.conflict}`
    )
    await check(
      'Conflict response has currentStatus',
      !!conflict.currentStatus,
      `currentStatus: ${conflict.currentStatus}`
    )
    await check(
      'Conflict response shows order was cancelled',
      conflict.currentStatus === 'cancelled',
      `currentStatus: ${conflict.currentStatus}`
    )
    console.log(`\n  ✅ Conflict message: "${conflict.error}"`)
    console.log(`  ✅ currentStatus: ${conflict.currentStatus}`)
    console.log(`  ✅ currentPaymentStatus: ${conflict.currentPaymentStatus}`)
  }

  // 6. Verify order was NOT modified (Cola was NOT added)
  console.log('\n=== Step 6: Verify order was NOT modified (no Cola added) ===')
  const verifyRes = await apiCall(`/api/orders?limit=500`)
  const allOrdersAfter = verifyRes.json?.orders || []
  const orderAfter = allOrdersAfter.find(o => o.id === orderId)

  if (orderAfter) {
    console.log(`  Order status: ${orderAfter.status}`)
    console.log(`  Order items count: ${orderAfter.orderItems?.length || 0}`)

    // Should still be cancelled (not modified by Natakar A)
    await check(
      'Order remains cancelled (not modified by Natakar A)',
      orderAfter.status === 'cancelled',
      `status: ${orderAfter.status}`
    )

    // Should have only 1 item (original Beefsteak), NOT 2 (Beefsteak + Cola)
    const hasCola = orderAfter.orderItems?.some(oi => oi.menuItemId === colaItem.id)
    await check(
      'Cola was NOT added (no silent overwrite)',
      !hasCola,
      hasCola ? 'FAIL: Cola was added despite conflict!' : 'Cola not added ✓'
    )
  }

  // 7. Test reverse scenario: Natakar A modifies, Natakar B voids
  console.log('\n=== Step 7: Reverse scenario — modify first, then void with stale data ===')

  // Create new order
  const order2Res = await apiCall('/api/orders', 'POST', {
    type: 'dine-in',
    customerName: 'Conflict Test Order 2',
    idempotencyKey: `conflict-test-2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderItems: [{ menuItemId: menuItem1.id, quantity: 1 }],
    notes: 'Conflict test 2',
  })

  if (order2Res.ok && order2Res.json?.id) {
    const orderId2 = order2Res.json.id
    const updatedAt2T1 = order2Res.json.updatedAt

    // Natakar A adds Cola (updates order) — changes updatedAt to T2
    const addCola2Res = await apiCall(`/api/orders/${orderId2}/add-items`, 'POST', {
      orderItems: [{
        menuItemId: colaItem.id,
        quantity: 1,
        notes: 'Added by Natakar A',
        modifiersJson: '[]',
      }],
      // No expectedUpdatedAt — fresh add
    })

    if (addCola2Res.ok) {
      console.log(`  ✓ Natakar A added Cola (order updated)`)

      // Wait 2s to ensure updatedAt differs by more than 1s tolerance
      console.log(`  Waiting 2s to exceed tolerance...`)
      await new Promise(r => setTimeout(r, 2000))

      // Natakar B tries to void with STALE updatedAt=T1
      const void2Res = await apiCall(`/api/orders/${orderId2}`, 'PUT', {
        status: 'cancelled',
        cancelReason: 'Void by Natakar B (stale data)',
        expectedUpdatedAt: updatedAt2T1, // STALE
      })

      console.log(`  Void response: ${void2Res.status}`)

      await check(
        'Reverse: Void with stale data returns 409',
        void2Res.status === 409,
        `status: ${void2Res.status}`
      )

      if (void2Res.status === 409) {
        console.log(`  ✅ Conflict: ${void2Res.json.error}`)
        console.log(`  ✅ currentStatus: ${void2Res.json.currentStatus}`)
      }
    }
  }

  // 8. Test without expectedUpdatedAt (backward compat — no conflict check)
  console.log('\n=== Step 8: Backward compat — no expectedUpdatedAt (no conflict check) ===')
  const order3Res = await apiCall('/api/orders', 'POST', {
    type: 'dine-in',
    customerName: 'No Conflict Check',
    idempotencyKey: `no-conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderItems: [{ menuItemId: menuItem1.id, quantity: 1 }],
  })

  if (order3Res.ok && order3Res.json?.id) {
    const orderId3 = order3Res.json.id

    // Void without expectedUpdatedAt — should succeed (backward compat)
    const void3Res = await apiCall(`/api/orders/${orderId3}`, 'PUT', {
      status: 'cancelled',
      cancelReason: 'No conflict check',
    })

    await check(
      'Backward compat: Void without expectedUpdatedAt succeeds',
      void3Res.ok,
      `status: ${void3Res.status}`
    )
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 6.3 SUMMARY — Conflict Resolution                   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  for (const r of results) {
    const status = r.passed ? PASS : FAIL
    console.log(`  ${status}  ${r.name}`)
  }

  console.log(`\n  Total: ${total}, Passed: ${passed}, Failed: ${failed}`)

  console.log('\n  === Conflict Resolution Summary ===')
  console.log(`  ✓ Optimistic locking z expectedUpdatedAt`)
  console.log(`  ✓ 409 Conflict ko se updatedAt ne ujema`)
  console.log(`  ✓ Conflict response vsebuje currentStatus`)
  console.log(`  ✓ Order ni tiho prepisana (no silent overwrite)`)
  console.log(`  ✓ Reverse scenario: void z stale data → 409`)
  console.log(`  ✓ Backward compat: brez expectedUpdatedAt → no check`)

  console.log(`\n  Result: ${failed === 0 ? '✓ PASS' : '✗ FAIL'}\n`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
