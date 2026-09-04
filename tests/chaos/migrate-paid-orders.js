// ============================================
// MIGRATION: Fix existing paid orders to 'completed' status
// ============================================
// Bug: check-status.ts je preverjal samo order.status === 'ready' || 'in-progress'
// Posledica: 12 paid orderjev je ostalo v 'pending' ali drugih statusih.
//
// Ta skripta popravi obstoječe orderje:
// 1. Poišče vse orderje kjer paymentStatus='paid' in status!='completed' in status!='cancelled'
// 2. Posodobi status na 'completed'
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/migrate-paid-orders.js \
//     --base-url=https://restaurantos-afk01stdg-robertpezdirc12-designs-projects.vercel.app \
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

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  MIGRATION: Fix paid orders → completed                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)
  console.log('')

  // 1. Pridobi vse orderje (limit 500)
  console.log('=== 1. Fetching orders ===')
  const res = await fetch(`${BASE_URL}/api/orders?limit=500`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })

  if (!res.ok) {
    console.error(`❌ Failed to fetch orders: HTTP ${res.status}`)
    process.exit(1)
  }

  const data = await res.json()
  const orders = data.orders || data.data || (Array.isArray(data) ? data : [])

  console.log(`  Total orders fetched: ${orders.length}`)

  // 2. Poišči problematične orderje
  const problematic = orders.filter(o =>
    o.paymentStatus === 'paid' &&
    o.status !== 'completed' &&
    o.status !== 'cancelled'
  )

  console.log(`  Paid but not completed: ${problematic.length}`)
  console.log('')

  if (problematic.length === 0) {
    console.log('✓ No orders need migration. All paid orders are already completed.')
    process.exit(0)
  }

  // 3. Prikaži problematične orderje
  console.log('=== 2. Orders to fix ===')
  for (const o of problematic.slice(0, 20)) {
    console.log(`  ${o.orderNumber || o.id}: status='${o.status}', paymentStatus='${o.paymentStatus}'`)
  }
  if (problematic.length > 20) {
    console.log(`  ... and ${problematic.length - 20} more`)
  }
  console.log('')

  // 4. Posodobi vsak order
  console.log('=== 3. Fixing orders ===')
  let fixed = 0
  let failed = 0

  for (const o of problematic) {
    try {
      const updateRes = await fetch(`${BASE_URL}/api/orders/${o.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      })

      if (updateRes.ok) {
        fixed++
        console.log(`  ✓ Order ${o.orderNumber || o.id}: ${o.status} → completed`)
      } else {
        failed++
        const errBody = await updateRes.text().catch(() => '')
        console.log(`  ✗ Order ${o.orderNumber || o.id}: HTTP ${updateRes.status} — ${errBody.substring(0, 100)}`)
      }
    } catch (err) {
      failed++
      console.log(`  ✗ Order ${o.orderNumber || o.id}: ${err.message}`)
    }

    // Rate limit: 50ms delay between requests
    await new Promise(r => setTimeout(r, 50))
  }

  // 5. Summary
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  MIGRATION SUMMARY                                       ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Total problematic: ${problematic.length}`)
  console.log(`  ✓ Fixed:           ${fixed}`)
  console.log(`  ✗ Failed:          ${failed}`)
  console.log(`  Result: ${failed === 0 ? '✓ SUCCESS' : '⚠ PARTIAL'}`)
  console.log('')

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
