#!/usr/bin/env node
// ============================================
// TEST 6.1: Offline Order Burst — 100 naročil
// ============================================
// Simulira scenarij:
//   1. 100 naročil ustvarjenih "offline" (v pomnilniku)
//   2. Vsako ima unique idempotencyKey (cart-session + timestamp)
//   3. "Sync" — pošlje vsa 100 naročila naenkrat (concurrent)
//   4. Preveri:
//      - Pravilno število naročil (100, ne več, ne manj)
//      - Ni duplikatov (idempotencyKey unikatni)
//      - Ni izgube podatkov (vsa naročila so v bazi)
//      - Pravilni statusi (pending → fired → completed)
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/test-6.1-offline-burst.js \
//     --base-url=https://...vercel.app \
//     --token=<TOKEN> \
//     --count=20  (zmanjšano zaradi rate limit; default 20)
// ============================================

const args = process.argv.slice(2)
const getArg = (name) => {
  const found = args.find(a => a.startsWith(`--${name}=`))
  return found ? found.split('=')[1] : null
}

const BASE_URL = getArg('base-url') || 'http://localhost:3000'
const TOKEN = getArg('token')
const NUM_ORDERS = parseInt(getArg('count') || '20', 10)
const CONCURRENCY = parseInt(getArg('concurrency') || '5', 10)

if (!TOKEN) {
  console.error('❌ --token=... je obvezen parameter')
  process.exit(1)
}

const PASS = '\x1b[32m✓ PASS\x1b[0m'
const FAIL = '\x1b[31m✗ FAIL\x1b[0m'
const WARN = '\x1b[33m⚠ WARN\x1b[0m'

const results = []

async function check(name, condition, details = '') {
  const status = condition ? PASS : FAIL
  console.log(`  ${status}  ${name}${details ? '  ' + details : ''}`)
  results.push({ name, passed: condition, details })
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 6.1: Offline Order Burst                           ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)
  console.log(`  Orders:   ${NUM_ORDERS}`)
  console.log(`  Concurrency: ${CONCURRENCY}`)
  console.log('')
  console.log('  NOTE: Ta test simulira offline burst z idempotency keys.')
  console.log('  Pravi IndexedDB offline queue še ni implementiran —')
  console.log('  test preverja server-side idempotency in batch processing.')

  // 1. Get menu items
  console.log('\n=== Step 1: Get test data ===')
  const menuRes = await fetch(`${BASE_URL}/api/menu-items?limit=2`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const menuData = await menuRes.json()
  const menuItems = menuData.menuItems || menuData.data || menuData
  const menuItem1 = Array.isArray(menuItems) && menuItems.length > 0 ? menuItems[0].id : null
  const menuItem2 = Array.isArray(menuItems) && menuItems.length > 1 ? menuItems[1].id : menuItem1

  if (!menuItem1) {
    console.log('✗ No menu items found')
    process.exit(1)
  }
  console.log(`  Menu item 1: ${menuItem1}`)
  console.log(`  Menu item 2: ${menuItem2}`)

  // 2. Generate 100 offline orders (in memory)
  console.log(`\n=== Step 2: Generate ${NUM_ORDERS} offline orders (in memory) ===`)
  const offlineOrders = []
  const sessionTimestamp = Date.now()

  for (let i = 0; i < NUM_ORDERS; i++) {
    offlineOrders.push({
      // Unique idempotencyKey — simulates cart-session + timestamp
      idempotencyKey: `offline-burst-${sessionTimestamp}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: i % 3 === 0 ? 'dine-in' : i % 3 === 1 ? 'takeout' : 'delivery',
      customerName: `Offline Customer ${i + 1}`,
      customerPhone: '',
      notes: `Offline burst test order ${i + 1}`,
      orderItems: [
        { menuItemId: menuItem1, quantity: 1 },
        ...(menuItem2 ? [{ menuItemId: menuItem2, quantity: 1 }] : []),
      ],
    })
  }
  console.log(`  ✓ Generated ${offlineOrders.length} offline orders`)
  console.log(`  ✓ Each has unique idempotencyKey`)

  // Verify all idempotencyKeys are unique
  const keys = offlineOrders.map(o => o.idempotencyKey)
  const uniqueKeys = new Set(keys)
  await check(
    'All idempotencyKeys are unique',
    keys.length === uniqueKeys.size,
    `${keys.length} keys, ${uniqueKeys.size} unique`
  )

  // 3. Sync — send all orders concurrently
  console.log(`\n=== Step 3: Sync — send ${NUM_ORDERS} orders (concurrency: ${CONCURRENCY}) ===`)

  const syncStartTime = Date.now()
  const results_array = []
  let successCount = 0
  let failCount = 0
  let duplicateCount = 0

  // Process in batches of CONCURRENCY
  for (let i = 0; i < offlineOrders.length; i += CONCURRENCY) {
    const batch = offlineOrders.slice(i, i + CONCURRENCY)
    const batchPromises = batch.map(async (order, idx) => {
      try {
        const res = await fetch(`${BASE_URL}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TOKEN}`,
          },
          body: JSON.stringify(order),
          signal: AbortSignal.timeout(15000),
        })

        let json = null
        try { json = await res.json() } catch {}

        return {
          index: i + idx,
          status: res.status,
          orderId: json?.id,
          orderNumber: json?.orderNumber,
          idempotencyKey: order.idempotencyKey,
          success: res.status === 201 || res.status === 200,
          isDuplicate: res.status === 200, // 200 = existing returned (dedup)
          error: json?.error,
        }
      } catch (err) {
        return {
          index: i + idx,
          status: 0,
          orderId: null,
          idempotencyKey: order.idempotencyKey,
          success: false,
          isDuplicate: false,
          error: err.message,
        }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results_array.push(...batchResults)

    for (const r of batchResults) {
      if (r.success) {
        successCount++
        if (r.isDuplicate) duplicateCount++
      } else {
        failCount++
      }
    }

    // Progress
    if ((i + CONCURRENCY) % (CONCURRENCY * 2) === 0 || i + CONCURRENCY >= offlineOrders.length) {
      console.log(`  Progress: ${Math.min(i + CONCURRENCY, offlineOrders.length)}/${offlineOrders.length} sent, ${successCount} success, ${failCount} failed`)
    }

    // Small delay between batches to avoid rate limit
    await new Promise(r => setTimeout(r, 100))
  }

  const syncDuration = Date.now() - syncStartTime
  console.log(`\n  Sync completed in ${syncDuration}ms`)
  console.log(`  Success: ${successCount}/${NUM_ORDERS}`)
  console.log(`  Failed:  ${failCount}/${NUM_ORDERS}`)
  console.log(`  Duplicates (200): ${duplicateCount}`)

  await check(
    `All ${NUM_ORDERS} orders synced successfully`,
    successCount === NUM_ORDERS,
    `success: ${successCount}, failed: ${failCount}`
  )

  // 4. Verify no duplicates — count unique order IDs
  console.log('\n=== Step 4: Verify no duplicates ===')
  const orderIds = results_array.filter(r => r.orderId).map(r => r.orderId)
  const uniqueOrderIds = new Set(orderIds)

  console.log(`  Total order IDs returned: ${orderIds.length}`)
  console.log(`  Unique order IDs: ${uniqueOrderIds.size}`)

  await check(
    'No duplicate order IDs (all unique)',
    orderIds.length === uniqueOrderIds.size,
    `${orderIds.length} IDs, ${uniqueOrderIds.size} unique`
  )

  // 5. Verify no data loss — count orders created
  console.log('\n=== Step 5: Verify no data loss ===')
  await check(
    `Exactly ${NUM_ORDERS} orders created (no data loss)`,
    uniqueOrderIds.size === NUM_ORDERS,
    `created: ${uniqueOrderIds.size}/${NUM_ORDERS}`
  )

  // 6. Verify idempotency — send same orders again
  console.log('\n=== Step 6: Verify idempotency (re-send same orders) ===')
  const resendBatch = offlineOrders.slice(0, Math.min(5, offlineOrders.length))
  let resendDuplicates = 0

  for (const order of resendBatch) {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 200) {
      resendDuplicates++
      const json = await res.json()
      // Verify same order ID returned
      const original = results_array.find(r => r.idempotencyKey === order.idempotencyKey)
      if (original && json.id === original.orderId) {
        console.log(`  ✓ Re-send returned same order ID: ${json.id}`)
      }
    } else if (res.status === 201) {
      console.log(`  ⚠ Re-send created NEW order (idempotency failed for ${order.idempotencyKey})`)
    }
  }

  await check(
    'Re-send returns 200 (idempotent dedup)',
    resendDuplicates === resendBatch.length,
    `${resendDuplicates}/${resendBatch.length} returned 200`
  )

  // 7. Verify orders in database
  console.log('\n=== Step 7: Verify orders in database ===')
  const ordersRes = await fetch(`${BASE_URL}/api/orders?limit=500`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const ordersData = await ordersRes.json()
  const allOrders = ordersData.orders || ordersData.data || ordersData
  const totalOrdersInDb = ordersData.total || (Array.isArray(allOrders) ? allOrders.length : 0)

  console.log(`  Total orders in database: ${totalOrdersInDb}`)

  // Find our test orders by customerName pattern
  const testOrders = Array.isArray(allOrders)
    ? allOrders.filter(o => o.customerName?.startsWith('Offline Customer'))
    : []
  console.log(`  Test orders found in DB: ${testOrders.length}`)

  await check(
    'Test orders found in database',
    testOrders.length >= NUM_ORDERS * 0.95, // Allow 5% variance for rate limits
    `found: ${testOrders.length}/${NUM_ORDERS}`
  )

  // 8. Verify order statuses
  console.log('\n=== Step 8: Verify order statuses ===')
  const statusCounts = {}
  for (const o of testOrders) {
    const status = o.status || 'unknown'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  }
  console.log('  Status distribution:')
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    ${status}: ${count}`)
  }

  await check(
    'All test orders have valid status',
    Object.keys(statusCounts).every(s => ['pending', 'in-progress', 'ready', 'completed', 'cancelled'].includes(s)),
    `statuses: ${Object.keys(statusCounts).join(', ')}`
  )

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 6.1 SUMMARY                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  for (const r of results) {
    const status = r.passed ? PASS : FAIL
    console.log(`  ${status}  ${r.name}`)
  }

  console.log(`\n  Total: ${total}, Passed: ${passed}, Failed: ${failed}`)

  console.log('\n  === Offline Burst Summary ===')
  console.log(`  Orders generated:  ${NUM_ORDERS}`)
  console.log(`  Orders synced:     ${successCount}`)
  console.log(`  Orders failed:     ${failCount}`)
  console.log(`  Unique order IDs:  ${uniqueOrderIds.size}`)
  console.log(`  Sync duration:     ${syncDuration}ms`)
  console.log(`  Avg per order:     ${Math.round(syncDuration / NUM_ORDERS)}ms`)
  console.log(`  Throughput:        ${Math.round(NUM_ORDERS / (syncDuration / 1000))} orders/s`)

  console.log('\n  === Pričakovano vedenje ===')
  console.log(`  ✓ Vsa naročila ustvarjena brez izgube`)
  console.log(`  ✓ Ni duplikatov (idempotencyKey deluje)`)
  console.log(`  ✓ Re-send vrne isti order ID (idempotent)`)
  console.log(`  ✓ Vsa naročila v bazi s pravilnim statusom`)

  console.log(`\n  Result: ${failed === 0 ? '✓ PASS' : '✗ FAIL'}\n`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
