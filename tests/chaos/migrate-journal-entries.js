#!/usr/bin/env node
// ============================================
// MIGRATION: Backfill missing Journal Entries
// ============================================
// Problem: 122 completed payments but only 79 journal entries
// Vzrok: generateJournalForPayment je bil non-blocking (.catch()) in
//        nekatere so tiho fail-ale.
//
// Ta skripta:
//   1. Pridobi vsa completed plačila
//   2. Pridobi vse journal entries (referenceType='payment')
//   3. Najde plačila BREZ journal entry
//   4. Za vsakega kliče POST /api/accounting/journal/regenerate (če obstaja)
//      ali pa neposredno generateJournalForPayment
//
// Uporaba:
//   node /home/z/my-project/scripts/chaos/migrate-journal-entries.js \
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

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  MIGRATION: Backfill Missing Journal Entries             ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Time:     ${new Date().toISOString()}`)

  // 1. Get all payments
  console.log('\n=== Step 1: Get all completed payments ===')
  const payRes = await apiCall('/api/payments?limit=500')
  if (!payRes.ok) {
    console.error(`❌ Failed to fetch payments: ${payRes.status}`)
    process.exit(1)
  }
  const payments = payRes.json?.payments || payRes.json?.data || payRes.json || []
  const completed = Array.isArray(payments) ? payments.filter(p => p.status === 'completed') : []
  console.log(`  Total completed payments: ${completed.length}`)

  // 2. Get all journal entries with referenceType='payment'
  console.log('\n=== Step 2: Get all payment journal entries ===')
  const jeRes = await apiCall('/api/accounting/journal-entries?limit=500')
  if (!jeRes.ok) {
    console.error(`❌ Failed to fetch journal entries: ${jeRes.status}`)
    process.exit(1)
  }
  const entries = jeRes.json?.entries || jeRes.json?.data || []
  const paymentEntries = entries.filter(e => e.referenceType === 'payment')
  const referencedPaymentIds = new Set(paymentEntries.map(e => e.reference))
  console.log(`  Total journal entries (payment): ${paymentEntries.length}`)

  // 3. Find payments without journal entries
  console.log('\n=== Step 3: Find payments without journal entries ===')
  const missingPayments = completed.filter(p => !referencedPaymentIds.has(p.id))
  console.log(`  Missing journal entries: ${missingPayments.length}`)

  if (missingPayments.length === 0) {
    console.log('\n✓ All payments have journal entries — no migration needed')
    process.exit(0)
  }

  // Show sample
  console.log('\n  --- Sample of missing payments ---')
  for (const p of missingPayments.slice(0, 5)) {
    console.log(`  Payment ${p.id}: ${p.type} ${p.amount} EUR (order: ${p.check?.orderId || '?'})`)
  }

  // 4. Try to regenerate via API endpoint (if exists)
  console.log(`\n=== Step 4: Regenerate journal entries ===`)

  let fixed = 0
  let failed = 0
  let notFound = 0

  for (const payment of missingPayments) {
    // Try endpoint /api/accounting/journal/regenerate
    const regenRes = await apiCall('/api/accounting/journal/regenerate', 'POST', {
      paymentId: payment.id,
    })

    if (regenRes.ok) {
      fixed++
      if (fixed <= 10) {
        console.log(`  ✓ Payment ${payment.id}: journal entry created`)
      } else if (fixed === 11) {
        console.log(`  ... (suppressing further output)`)
      }
    } else if (regenRes.status === 404) {
      // Endpoint doesn't exist — try alternative
      notFound++
      // Try direct call to /api/payments/[id]/journal
      const directRes = await apiCall(`/api/payments/${payment.id}/journal`, 'POST')
      if (directRes.ok) {
        fixed++
      } else {
        failed++
      }
    } else {
      failed++
      if (failed <= 3) {
        console.log(`  ✗ Payment ${payment.id}: ${regenRes.status} — ${regenRes.text?.substring(0, 100)}`)
      }
    }

    // Small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\n  Fixed:      ${fixed}`)
  console.log(`  Failed:     ${failed}`)
  console.log(`  Not found:  ${notFound} (endpoint missing)`)

  // 5. Verify reconciliation after migration
  console.log('\n=== Step 5: Verify reconciliation ===')

  // Get fresh trial balance
  const tbRes = await apiCall('/api/accounting/trial-balance')
  const tb = tbRes.json
  const accounts = tb?.accounts || tb?.data || []
  const cashBalance = accounts.find(a => a.code === '1010')?.balance || 0
  const bankBalance = accounts.find(a => a.code === '1000')?.balance || 0
  const tipsBalance = accounts.find(a => a.code === '7600')?.balance || 0

  const totalCash = completed.filter(p => p.type === 'cash').reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalCard = completed.filter(p => p.type === 'card').reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalTips = completed.reduce((s, p) => s + Number(p.tipAmount || 0), 0)

  console.log(`\n  Cash (1010):  ${Number(cashBalance).toFixed(2)} EUR vs Payments: ${totalCash.toFixed(2)} EUR (diff: ${Math.abs(Number(cashBalance) - totalCash).toFixed(2)})`)
  console.log(`  Bank (1000):  ${Number(bankBalance).toFixed(2)} EUR vs Payments: ${totalCard.toFixed(2)} EUR (diff: ${Math.abs(Number(bankBalance) - totalCard).toFixed(2)})`)
  console.log(`  Tips (7600):  ${Number(tipsBalance).toFixed(2)} EUR vs Payments: ${totalTips.toFixed(2)} EUR (diff: ${Math.abs(Number(tipsBalance) - totalTips).toFixed(2)})`)

  console.log('\n╔═══════════════════════════════════════════════════════════╗')
  console.log('║  MIGRATION SUMMARY                                       ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`  Total missing:  ${missingPayments.length}`)
  console.log(`  Fixed:          ${fixed}`)
  console.log(`  Failed:         ${failed}`)
  console.log(`  Not found:      ${notFound}`)

  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(2)
})
