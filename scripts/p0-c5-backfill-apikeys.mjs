// ============================================
// P0-C5 — API KEY BACKFILL
// ============================================
// Migrira API ključe iz RestaurantSettings.apiKeys (JSON) v novo ApiKey tabelo.
//
// STRATEGIJA:
//   1. Preberi RestaurantSettings.apiKeys JSON
//   2. Za vsak key v JSON-u:
//      - Pridobi ali kreiraj Subscription (prva Subscription ali default)
//      - Kreiraj ApiKey row z subscriptionId
//   3. ne briše RestaurantSettings.apiKeys (grace period 30 dni)
//
// UPORABA:
//   node scripts/p0-c5-backfill-apikeys.mjs              # dry-run
//   node scripts/p0-c5-backfill-apikeys.mjs --apply      # dejansko zapiše
// ============================================

import { PGlite } from '@electric-sql/pglite'
import crypto from 'crypto'

const dataDir = process.env.PGLITE_DATA_DIR || '/tmp/pglite-data'
const APPLY = process.argv.includes('--apply')

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  P0-C5 — API Key Backfill (RestaurantSettings → ApiKey) ║')
console.log(`║  Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}                                      ║`)
console.log('╚═══════════════════════════════════════════════════════════╝')

const pg = new PGlite(dataDir)

// --- 1. Pridobi ali kreiraj default Subscription ---
async function getOrCreateDefaultSubscription() {
  // Preveri ali obstaja kakšna Subscription
  const existing = await pg.query(`SELECT id FROM "Subscription" LIMIT 1`)
  if (existing.rows.length > 0) {
    return existing.rows[0].id
  }

  // Kreiraj default Subscription (single-tenant compat)
  const subId = crypto.randomUUID()
  await pg.query(`
    INSERT INTO "Subscription" (id, "companyName", email, phone, "taxId", "businessId", plan, status, "monthlyPrice", "locationCount", currency, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 1, 'EUR', NOW(), NOW())
  `, [subId, 'Default Company', 'admin@default.test', '', '', '', 'professional', 'active'])
  console.log(`  ✓ Created default Subscription: ${subId}`)
  return subId
}

// --- 2. Preberi RestaurantSettings.apiKeys JSON ---
async function getSettingsApiKeys() {
  const res = await pg.query(`SELECT id, "apiKeys" FROM "RestaurantSettings" LIMIT 1`)
  if (res.rows.length === 0) {
    return { settingsId: null, keys: [] }
  }
  const settingsId = res.rows[0].id
  const apiKeysJson = res.rows[0].apiKeys || '[]'
  let keys = []
  try {
    keys = JSON.parse(apiKeysJson)
  } catch {
    keys = []
  }
  return { settingsId, keys }
}

// --- 3. Preveri ali ApiKey že obstaja (idempotent) ---
async function apiKeyExists(keyHash) {
  const res = await pg.query(`SELECT id FROM "ApiKey" WHERE "keyHash" = $1`, [keyHash])
  return res.rows.length > 0
}

// --- Main ---
async function main() {
  const { settingsId, keys } = await getSettingsApiKeys()

  console.log(`\n  RestaurantSettings ID: ${settingsId || '(none)'}`)
  console.log(`  API keys in JSON: ${keys.length}`)

  if (keys.length === 0) {
    console.log('\n✅ No API keys to backfill — RestaurantSettings.apiKeys is empty')
    await pg.close()
    return
  }

  // Pridobi ali kreiraj Subscription
  const subscriptionId = await getOrCreateDefaultSubscription()
  console.log(`  Subscription ID: ${subscriptionId}`)

  console.log('\n━━━ Backfilling API keys ━━━')
  let backfilled = 0
  let skipped = 0

  for (const key of keys) {
    if (await apiKeyExists(key.keyHash)) {
      console.log(`  ⊘ ${key.name} (${key.keyPrefix}...) — already exists in ApiKey table — skip`)
      skipped++
      continue
    }

    console.log(`  → ${key.name} (${key.keyPrefix}...) — ${APPLY ? 'backfilling' : 'would backfill'}`)

    if (APPLY) {
      const apiKeyId = key.id || crypto.randomUUID()
      await pg.query(`
        INSERT INTO "ApiKey" (id, "subscriptionId", name, "keyPrefix", "keyHash", scopes, "rateLimit", "isActive", "createdAt", "lastUsedAt", "expiresAt", "createdBy")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        apiKeyId,
        subscriptionId,
        key.name,
        key.keyPrefix,
        key.keyHash,
        JSON.stringify(key.scopes || []),
        key.rateLimit || 60,
        key.isActive !== false,
        key.createdAt || new Date(),
        key.lastUsedAt || null,
        key.expiresAt || null,
        key.createdBy || null,
      ])
      backfilled++
    } else {
      backfilled++
    }
  }

  console.log(`\n━━━ Summary ━━━`)
  console.log(`  Total keys in JSON:     ${keys.length}`)
  console.log(`  Backfilled to ApiKey:   ${APPLY ? backfilled : '(dry-run)'} `)
  console.log(`  Already existed:        ${skipped}`)

  if (APPLY && backfilled > 0) {
    console.log('\n✅ Backfill complete — ApiKey table now contains all keys')
    console.log('  Next: update verifyApiKey() to read from ApiKey table')
    console.log('  RestaurantSettings.apiKeys NOT deleted (grace period 30 days)')
  } else if (!APPLY) {
    console.log('\n  Run with --apply to perform backfill')
  }

  await pg.close()
}

main().catch(err => {
  console.error('❌ Backfill failed:', err)
  process.exit(1)
})
