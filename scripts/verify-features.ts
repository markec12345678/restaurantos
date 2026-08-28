// ============================================
// VERIFICATION SCRIPT — Dejansko preverjanje vseh funkcij
//
// Zaženi z: npx tsx scripts/verify-features.ts
//
// Ta skripta NE zaupa besedam v dokumentaciji —
// import-a dejansko kodo in preverja obnašanje.
// ============================================

import { generateCspNonce, formatNonceForCsp, cspHasUnsafeInline } from '@/lib/middleware/csp-nonce'
import { isHapticSupported, haptic } from '@/lib/haptic'
import { isWebAuthnEnable, getWebAuthnConfig } from '@/lib/webauthn'
import {
  parseOrderItemModifiers,
  parsePermissions,
  parseAllergens,
  isPermission as isPermissionJson,
} from '@/lib/json-fields'
import { ORDER_STATUS, isOrderStatus } from '@/lib/enums'
import { isSupportedLocale } from '@/lib/i18n/i18n-consolidation'
import { validateDatabaseConfig } from '@/lib/db-config-validator'
import { INDEXEDDB_STORES, INDEXEDDB_STORE_COUNT } from '@/lib/offline-furs'

// Setup test environment
process.env.WEBAUTHN_ENABLED = 'true'
process.env.NODE_ENV = 'development'

interface TestResult {
  test: string
  passed: boolean
  evidence?: string
}

const results: TestResult[] = []

// ════════════════════════════════════════════
// 1. CSP NONCE
// ════════════════════════════════════════════
const n1 = generateCspNonce()
const n2 = generateCspNonce()
results.push({
  test: 'CSP nonce je 24 znakov base64 (18 bajtov / 144-bit)',
  passed: n1.length === 24,
  evidence: `nonce="${n1}"`,
})
results.push({
  test: 'CSP nonce je unikaten per-request',
  passed: n1 !== n2,
  evidence: `${n1} !== ${n2}`,
})
results.push({
  test: 'formatNonceForCsp vrne pravilen format',
  passed: formatNonceForCsp('abc') === "'nonce-abc'",
})
results.push({
  test: "cspHasUnsafeInline zazna 'unsafe-inline' v script-src",
  passed: cspHasUnsafeInline("script-src 'unsafe-inline'") === true,
})
results.push({
  test: "cspHasUnsafeInline ne zazna 'unsafe-inline' v style-src",
  passed: cspHasUnsafeInline("style-src 'unsafe-inline'") === false,
})

// ════════════════════════════════════════════
// 2. HAPTIC FEEDBACK
// ════════════════════════════════════════════
try {
  haptic('light'); haptic('medium'); haptic('heavy')
  results.push({ test: 'haptic() ne vrže napake', passed: true })
} catch {
  results.push({ test: 'haptic() ne vrže napake', passed: false })
}
results.push({
  test: 'isHapticSupported() vrne boolean',
  passed: typeof isHapticSupported() === 'boolean',
})

// ════════════════════════════════════════════
// 3. WEBAUTHN / FIDO2
// ════════════════════════════════════════════
results.push({
  test: 'WebAuthn je omogočen ko je WEBAUTHN_ENABLED=true',
  passed: isWebAuthnEnable() === true,
})
const wc = getWebAuthnConfig()
results.push({
  test: 'WebAuthn rpID = localhost (dev)',
  passed: wc.rpID === 'localhost',
  evidence: `rpID="${wc.rpID}"`,
})
results.push({
  test: 'WebAuthn origin = http://localhost:3000',
  passed: wc.origin === 'http://localhost:3000',
})
results.push({
  test: 'WebAuthn rpName = RestaurantOS',
  passed: wc.rpName === 'RestaurantOS',
})

// ════════════════════════════════════════════
// 4. JSON TYPED PARSERS (Issue #33)
// ════════════════════════════════════════════
const mods = parseOrderItemModifiers('[{"name":"Sir","price":1.5}]')
results.push({
  test: 'parseOrderItemModifiers — veljaven JSON',
  passed: mods.length === 1 && mods[0].name === 'Sir',
})
results.push({
  test: 'parseOrderItemModifiers — neveljaven JSON → []',
  passed: parseOrderItemModifiers('not-json').length === 0,
})
const perms = parsePermissions('["admin","invalid","take_orders"]')
results.push({
  test: 'parsePermissions — filtra invalid (admin + take_orders, ne invalid)',
  passed: perms.length === 2 && perms[0] === 'admin',
})
const allergens = parseAllergens('["1","3","15","abc"]')
results.push({
  test: 'parseAllergens — filtra invalid (>14 in non-string)',
  passed: allergens.length === 2,
})

// ════════════════════════════════════════════
// 5. TS ENUMS + TYPE GUARDS (Issue #41)
// ════════════════════════════════════════════
results.push({
  test: 'ORDER_STATUS.PENDING = "pending"',
  passed: ORDER_STATUS.PENDING === 'pending',
  evidence: `PENDING="${ORDER_STATUS.PENDING}"`,
})
results.push({
  test: 'isOrderStatus("pending") = true',
  passed: isOrderStatus('pending') === true,
})
results.push({
  test: 'isOrderStatus("pendig") = false (catch typo)',
  passed: isOrderStatus('pendig') === false,
})
results.push({
  test: 'isPermission("admin") = true',
  passed: isPermissionJson('admin') === true,
})
results.push({
  test: 'isPermission("superuser") = false',
  passed: isPermissionJson('superuser') === false,
})

// ════════════════════════════════════════════
// 6. I18N CONSOLIDATION (Issue #44)
// ════════════════════════════════════════════
results.push({
  test: 'isSupportedLocale("sl") = true',
  passed: isSupportedLocale('sl') === true,
})
results.push({
  test: 'isSupportedLocale("en") = true',
  passed: isSupportedLocale('en') === true,
})
results.push({
  test: 'isSupportedLocale("ar") = false',
  passed: isSupportedLocale('ar') === false,
})

// ════════════════════════════════════════════
// 7. DB CONFIG VALIDATOR (Issue #40)
// ════════════════════════════════════════════
delete process.env.DATABASE_URL
const dbEmpty = validateDatabaseConfig()
results.push({
  test: 'DB: prazen DATABASE_URL → usesPglite (dev mode)',
  passed: dbEmpty.usesPglite === true && dbEmpty.valid === true,
})

process.env.DATABASE_URL = 'file:./db/custom.db'
const dbSqlite = validateDatabaseConfig()
results.push({
  test: 'DB: SQLite path → INVALID (schema je postgresql)',
  passed: dbSqlite.valid === false,
  evidence: `error="${dbSqlite.error?.substring(0, 50)}..."`,
})

process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
const dbPg = validateDatabaseConfig()
results.push({
  test: 'DB: PostgreSQL → valid',
  passed: dbPg.valid === true && dbPg.usesExternalPostgres === true,
})
results.push({
  test: 'DB: geslo maskirano v URL (****)',
  passed: !dbPg.maskedDatabaseUrl.includes('pass'),
  evidence: `masked="${dbPg.maskedDatabaseUrl}"`,
})

// ════════════════════════════════════════════
// 8. INDEXEDDB STORES (Issue #42)
// ════════════════════════════════════════════
results.push({
  test: 'INDEXEDDB_STORE_COUNT = 2 (ne 22)',
  passed: INDEXEDDB_STORE_COUNT === 2,
  evidence: `count=${INDEXEDDB_STORE_COUNT}`,
})
results.push({
  test: 'INDEXEDDB_STORES = ["pendingOrders","pendingReceipts"]',
  passed: JSON.stringify([...INDEXEDDB_STORES]) === '["pendingOrders","pendingReceipts"]',
})

// ════════════════════════════════════════════
// IZPIS REZULTATOV
// ════════════════════════════════════════════
console.log()
console.log('══════════════════════════════════════════════════════════════════')
console.log('  RestaurantOS — DEJANSKO PREVERJANJE VSEH FUNKCIJ')
console.log('  (ta skripta import-a kodo in preverja — ne zaupa dokumentaciji)')
console.log('══════════════════════════════════════════════════════════════════')
console.log()

let passed = 0
let failed = 0

results.forEach((r, i) => {
  const icon = r.passed ? '✓' : '❌'
  console.log(`${icon} ${String(i + 1).padStart(2, '0')}. ${r.test}`)
  if (r.evidence) {
    console.log(`        dokaz: ${r.evidence}`)
  }
  if (r.passed) passed++; else failed++
})

console.log()
console.log('─'.repeat(72))
console.log(`  Rezultat: ${passed}/${results.length} preverjanj uspešnih`)
console.log('─'.repeat(72))
console.log()

if (failed === 0) {
  console.log('🎉 VSA PREVERJANJA USPEŠNA!')
  console.log()
  console.log('  Vse trditve v dokumentih so podprte z dejanskimi dokazi iz kode.')
  console.log('  Vsak lahko to preveri z: npx tsx scripts/verify-features.ts')
  process.exit(0)
} else {
  console.log(`❌ ${failed} preverjanj ni uspelo — potrebna pozornost`)
  process.exit(1)
}
