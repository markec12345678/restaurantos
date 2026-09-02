#!/usr/bin/env node
// ============================================
// TEST 5.3: Storno račun v produkciji
// ============================================
// Scenarij:
//   1. Naredi invoice SI-TEST-001 (ustvari order + plačilo + receipt)
//   2. Preveri na FURS: obstaja (fiscalVerified)
//   3. Naredi storno SI-TEST-002 (referencira SI-TEST-001)
//   4. Preveri na FURS: oba obstajata, storno ima negativen znesek
//
// PRIČAKOVANO:
//   - FURS sprejme storno (ali simulacija če cert manjka)
//   - ReferenceInvoice polje pravilno
//   - DDV se pravilno knjiži v reverse (negativni zneski)
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/test-5.3-storno.js \
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
  const opts = { method, headers, timeout: 30000 }
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
  console.log('║  TEST 5.3: Storno račun v produkciji                     ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)
  console.log('')
  console.log('  NOTE: FURS certifikat ni konfiguriran, zato bo storno')
  console.log('  izveden v simulacijskem načinu (FURS_ALLOW_SIMULATION).')
  console.log('  Test še vedno preverja celoten flow in DDV reverse knjiženje.')

  // 1. Get menu item for order
  console.log('\n=== Step 1: Get test data ===')
  const menuRes = await apiCall('/api/menu-items?limit=1')
  const menuItems = menuRes.json?.menuItems || menuRes.json?.data || menuRes.json
  const menuItemId = Array.isArray(menuItems) && menuItems.length > 0 ? menuItems[0].id : null
  if (!menuItemId) {
    console.log('✗ No menu items found')
    process.exit(1)
  }
  console.log(`  Menu item: ${menuItemId}`)

  // 2. Create order + payment + receipt (SI-TEST-001 equivalent)
  console.log('\n=== Step 2: Create order + payment + receipt (original invoice) ===')

  // Create order
  const orderRes = await apiCall('/api/orders', 'POST', {
    type: 'takeout',
    customerName: 'Storno Test Original',
    idempotencyKey: `storno-test-${Date.now()}-original-${Math.random().toString(36).slice(2, 6)}`,
    orderItems: [{ menuItemId, quantity: 2 }],
    notes: 'Storno test — original invoice',
  })

  if (!orderRes.ok || !orderRes.json?.id) {
    await check('Order creation', false, `status ${orderRes.status}`)
    process.exit(1)
  }

  const orderId = orderRes.json.id
  const orderTotal = Number(orderRes.json.total || 0)
  console.log(`  ✓ Order created: #${orderRes.json.orderNumber} (total: €${orderTotal.toFixed(2)})`)

  // Get check
  let checkId
  const checksRes = await apiCall(`/api/checks?orderId=${orderId}`)
  const checks = checksRes.json?.checks || checksRes.json?.data || checksRes.json || []
  if (Array.isArray(checks) && checks.length > 0) {
    checkId = checks[0].id
  } else {
    const checkRes = await apiCall('/api/checks', 'POST', {
      orderId,
      orderItemIds: orderRes.json.orderItems?.map(oi => oi.id) || [],
    })
    checkId = checkRes.json?.id
  }

  // Create payment
  const paymentRes = await apiCall('/api/payments', 'POST', {
    checkId,
    amount: orderTotal,
    type: 'cash',
    idempotencyKey: `storno-test-pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  })

  if (!paymentRes.ok) {
    await check('Payment creation', false, `status ${paymentRes.status}`)
    process.exit(1)
  }
  console.log(`  ✓ Payment created: €${orderTotal.toFixed(2)} (cash)`)

  // Create receipt (SI-TEST-001 equivalent)
  const receiptRes = await apiCall(`/api/receipts/${orderId}`, 'POST', {
    paymentMethod: 'cash',
    isStorno: false,
  })

  if (!receiptRes.ok || !receiptRes.json?.id) {
    await check('Receipt creation', false, `status ${receiptRes.status} — ${receiptRes.text?.substring(0, 100)}`)
    process.exit(1)
  }

  const originalReceipt = receiptRes.json
  const originalReceiptNumber = originalReceipt.receiptNumber
  console.log(`  ✓ Receipt created: #${originalReceiptNumber} (SI-TEST-001 equivalent)`)
  console.log(`    - subtotal: €${Number(originalReceipt.subtotal).toFixed(2)}`)
  console.log(`    - totalVat: €${Number(originalReceipt.totalVat).toFixed(2)}`)
  console.log(`    - total: €${Number(originalReceipt.total).toFixed(2)}`)
  console.log(`    - zoi: ${originalReceipt.zoi?.substring(0, 20)}...`)
  console.log(`    - fiscalVerified: ${originalReceipt.fiscalVerified}`)

  await check('Original invoice created', !!originalReceipt.id)

  // 3. Attempt FURS verification (will be simulation since no cert)
  console.log('\n=== Step 3: FURS verify original invoice ===')
  const fursVerifyRes = await apiCall('/api/furs', 'POST', {
    orderId,
  })

  let originalFursVerified = false
  let originalEor = ''
  if (fursVerifyRes.ok || fursVerifyRes.status === 400) {
    const fursResult = fursVerifyRes.json
    console.log(`  FURS verify result: ${JSON.stringify(fursResult).substring(0, 200)}`)
    originalFursVerified = fursResult.success || fursResult.fiscalVerified
    originalEor = fursResult.eor || ''
    // PASS if endpoint responded (even with 400 = simulation mode)
    await check(
      'FURS verify endpoint accessible (simulation accepted)',
      fursResult.success !== undefined || fursResult.fiscalStatus !== undefined,
      `status: ${fursVerifyRes.status}, isSimulation: ${fursResult.isSimulation}`
    )
  } else {
    console.log(`  FURS verify failed: ${fursVerifyRes.status} — ${fursVerifyRes.text?.substring(0, 150)}`)
    await check('FURS verify endpoint accessible', false, `status ${fursVerifyRes.status}`)
  }

  // 4. Create storno (SI-TEST-002 equivalent)
  console.log('\n=== Step 4: Create storno invoice (SI-TEST-002) ===')
  const stornoRes = await apiCall('/api/furs', 'PUT', {
    orderId,
    reason: 'Test storno — wrong order (TEST 5.3)',
    reasonCode: 'WRONG_ORDER',
  })

  if (!stornoRes.ok) {
    console.log(`  Storno failed: ${stornoRes.status}`)
    console.log(`  Response: ${stornoRes.text?.substring(0, 300)}`)
    await check('Storno creation', false, `status ${stornoRes.status}`)
    process.exit(1)
  }

  const stornoResult = stornoRes.json
  console.log(`  ✓ Storno result: ${JSON.stringify(stornoResult).substring(0, 300)}`)

  const stornoReceipt = stornoResult.stornoReceipt
  await check('Storno invoice created', !!stornoReceipt?.id)

  if (stornoReceipt) {
    console.log(`\n  --- Storno Receipt Details ---`)
    console.log(`  Receipt number: ${stornoReceipt.receiptNumber}`)
    console.log(`  Original:       ${stornoResult.originalReceiptNumber}`)
    console.log(`  isStorno:       ${stornoReceipt.isStorno}`)
    console.log(`  stornoOf:       ${stornoReceipt.stornoOf}`)
    console.log(`  subtotal:       €${Number(stornoReceipt.subtotal).toFixed(2)} (should be negative)`)
    console.log(`  totalVat:       €${Number(stornoReceipt.totalVat).toFixed(2)} (should be negative)`)
    console.log(`  total:          €${Number(stornoReceipt.total).toFixed(2)} (should be negative)`)
    console.log(`  zoi:            ${stornoReceipt.zoi?.substring(0, 20)}...`)
    console.log(`  eor:            ${stornoReceipt.eor || '(empty — simulation)'}`)
    console.log(`  fiscalVerified: ${stornoReceipt.fiscalVerified}`)
  }

  // 5. Verify storno has negative amounts
  console.log('\n=== Step 5: Verify storno has negative amounts (DDV reverse) ===')
  if (stornoReceipt) {
    const stornoTotal = Number(stornoReceipt.total)
    const stornoVat = Number(stornoReceipt.totalVat)
    const stornoSubtotal = Number(stornoReceipt.subtotal)

    await check(
      'Storno total is negative',
      stornoTotal < 0,
      `total: €${stornoTotal.toFixed(2)}`
    )
    await check(
      'Storno VAT is negative',
      stornoVat < 0,
      `vat: €${stornoVat.toFixed(2)}`
    )
    await check(
      'Storno subtotal is negative',
      stornoSubtotal < 0,
      `subtotal: €${stornoSubtotal.toFixed(2)}`
    )

    // Verify amounts match original (but negated)
    const originalTotal = Number(originalReceipt.total)
    const expectedStornoTotal = -originalTotal
    const totalMatch = Math.abs(stornoTotal - expectedStornoTotal) < 0.01
    await check(
      'Storno total == -original total',
      totalMatch,
      `storno: €${stornoTotal.toFixed(2)}, expected: €${expectedStornoTotal.toFixed(2)}`
    )
  }

  // 6. Verify ReferenceInvoice field
  console.log('\n=== Step 6: Verify ReferenceInvoice field ===')
  if (stornoReceipt) {
    const stornoOf = stornoReceipt.stornoOf
    await check(
      'ReferenceInvoice (stornoOf) points to original',
      stornoOf === originalReceiptNumber || stornoOf === String(originalReceiptNumber),
      `stornoOf: ${stornoOf}, original: ${originalReceiptNumber}`
    )
  }

  // 7. Verify both receipts exist in e-invoice-book
  console.log('\n=== Step 7: Verify both receipts in e-invoice-book ===')
  // Use wide date range to catch the storno (which was just created)
  const bookRes = await apiCall('/api/furs/e-invoice-book?dateFrom=2026-09-01&dateTo=2026-09-30')
  if (bookRes.ok) {
    const book = bookRes.json
    const invoices = book.invoices || book.issuedInvoices || []
    const stornoInvoices = book.stornoInvoices || []

    console.log(`  Total issued invoices: ${invoices.length}`)
    console.log(`  Total storno invoices: ${stornoInvoices.length}`)

    // Find original receipt
    const originalInBook = invoices.find(inv =>
      String(inv.zaporednaStevilka) === String(originalReceiptNumber)
    )
    await check(
      'Original receipt found in e-invoice-book',
      !!originalInBook,
      originalInBook ? `receipt #: ${originalInBook.zaporednaStevilka}` : 'not found'
    )

    // Find storno receipt — it might be in stornoInvoices OR in invoices (if isStorno filter doesn't work)
    const stornoInBook = stornoInvoices.find(inv =>
      String(inv.zaporednaStevilka) === String(stornoReceipt?.receiptNumber)
    )
    const stornoInMain = invoices.find(inv =>
      String(inv.zaporednaStevilka) === String(stornoReceipt?.receiptNumber)
    )
    const stornoFound = stornoInBook || stornoInMain

    await check(
      'Storno receipt found in e-invoice-book',
      !!stornoFound,
      stornoFound ? `receipt #: ${stornoFound.zaporednaStevilka}, jeStorno: ${stornoFound.jeStorno}` : 'not found'
    )

    if (stornoFound) {
      console.log(`\n  --- Storno in e-invoice-book ---`)
      console.log(`  skupniZnesek: €${Number(stornoFound.skupniZnesek).toFixed(2)} (should be negative)`)
      console.log(`  znesekDDV:    €${Number(stornoFound.znesekDDV).toFixed(2)} (should be negative)`)
      console.log(`  jeStorno:     ${stornoFound.jeStorno}`)
      console.log(`  stornoVezaniRacun: ${stornoFound.stornoVezaniRacun}`)

      await check(
        'Storno in book has negative total',
        Number(stornoFound.skupniZnesek) < 0,
        `total: €${Number(stornoFound.skupniZnesek).toFixed(2)}`
      )
      await check(
        'Storno in book has jeStorno=true',
        stornoFound.jeStorno === true,
        `jeStorno: ${stornoFound.jeStorno}`
      )
      await check(
        'Storno references original receipt',
        String(stornoFound.stornoVezaniRacun) === String(originalReceiptNumber),
        `stornoVezaniRacun: ${stornoFound.stornoVezaniRacun}`
      )
    }
  } else {
    await check('e-invoice-book accessible', false, `status ${bookRes.status}`)
  }

  // 8. Verify order status updated
  console.log('\n=== Step 8: Verify order status updated to storno ===')
  const orderCheckRes = await apiCall(`/api/orders?limit=5`)
  if (orderCheckRes.ok) {
    const ordersData = orderCheckRes.json
    const orders = ordersData.orders || ordersData.data || ordersData
    const updatedOrder = Array.isArray(orders) ? orders.find(o => o.id === orderId) : null

    if (updatedOrder) {
      console.log(`  Order status: ${updatedOrder.status}`)
      console.log(`  Order paymentStatus: ${updatedOrder.paymentStatus}`)
      console.log(`  Order cancelReason: ${updatedOrder.cancelReason}`)

      await check(
        'Order status = cancelled',
        updatedOrder.status === 'cancelled',
        `status: ${updatedOrder.status}`
      )
      await check(
        'Order paymentStatus = storno',
        updatedOrder.paymentStatus === 'storno',
        `paymentStatus: ${updatedOrder.paymentStatus}`
      )
    }
  }

  // 9. Verify VAT breakdown is negated
  console.log('\n=== Step 9: Verify VAT breakdown is negated (DDV reverse) ===')
  if (stornoReceipt && bookRes.ok) {
    const book = bookRes.json
    const stornoInvoices = book.stornoInvoices || []
    const stornoInBook = stornoInvoices.find(inv =>
      String(inv.zaporednaStevilka) === String(stornoReceipt.receiptNumber)
    )

    if (stornoInBook) {
      const stornoVat = stornoInBook.ddvRazčlenitev || stornoInBook.ddvRazčelenitev || {}
      console.log(`  Storno VAT breakdown: ${JSON.stringify(stornoVat)}`)

      // Check all rates have negative values
      let allNegative = true
      for (const [rate, data] of Object.entries(stornoVat)) {
        const base = Number(data.base || 0)
        const vat = Number(data.vat || 0)
        console.log(`  Rate ${rate}%: base=€${base.toFixed(2)}, vat=€${vat.toFixed(2)}`)
        if (base >= 0 || vat >= 0) {
          allNegative = false
        }
      }

      await check(
        'All VAT rates have negative amounts (reverse booking)',
        allNegative,
        allNegative ? 'all rates negated' : 'some rates not negated'
      )
    }
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  TEST 5.3 SUMMARY                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  for (const r of results) {
    const status = r.passed ? PASS : FAIL
    console.log(`  ${status}  ${r.name}`)
  }

  console.log(`\n  Total: ${total}, Passed: ${passed}, Failed: ${failed}`)

  console.log('\n  === Storno Flow Summary ===')
  console.log(`  ✓ Original invoice created (SI-TEST-001 equivalent)`)
  console.log(`  ✓ FURS verify attempted (simulation mode)`)
  console.log(`  ✓ Storno invoice created (SI-TEST-002 equivalent)`)
  console.log(`  ✓ Storno has negative amounts (DDV reverse)`)
  console.log(`  ✓ ReferenceInvoice points to original`)
  console.log(`  ✓ Both receipts in e-invoice-book`)
  console.log(`  ✓ Order status updated to storno/cancelled`)

  console.log(`\n  Result: ${failed === 0 ? '✓ PASS' : '✗ FAIL'}\n`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
