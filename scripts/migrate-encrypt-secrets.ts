// ============================================
// MIGRATION: Encrypt existing plaintext secrets in database
//
// Run: bun run scripts/migrate-encrypt-secrets.ts
//
// Prizadete tabele:
// 1. Location.fursCertPassword
// 2. RestaurantSettings.fursCertPassword
// 3. RestaurantSettings.emailSmtpPassword
// 4. Webhook.secret
// 5. Integration.apiKey
// 6. Integration.apiSecret
//
// Zahteva: ENCRYPTION_KEY environment variable mora biti nastavljen.
// ============================================

import { PrismaClient } from '@prisma/client'
import { ensureEncrypted, isEncrypted } from '../src/lib/crypto/secrets'

const db = new PrismaClient()

async function migrateTable(
  tableName: string,
  idField: string,
  secretField: string,
  model: any
): Promise<{ total: number; migrated: number; skipped: number }> {
  const records = await model.findMany({
    where: { [secretField]: { not: '' } },
    select: { [idField]: true, [secretField]: true } as any,
  })

  let migrated = 0
  let skipped = 0

  for (const record of records) {
    const currentValue = record[secretField] as string

    // Skip if already encrypted
    if (isEncrypted(currentValue)) {
      skipped++
      continue
    }

    // Encrypt and update
    const encrypted = ensureEncrypted(currentValue)
    await model.update({
      where: { [idField]: record[idField] },
      data: { [secretField]: encrypted },
    })
    migrated++
    console.log(`  [${tableName}] ${record[idField]}: encrypted`)
  }

  return { total: records.length, migrated, skipped }
}

async function main() {
  console.log('=== SECRETS ENCRYPTION MIGRATION ===\n')

  // Check ENCRYPTION_KEY
  if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV !== 'development') {
    console.error('❌ ENCRYPTION_KEY not set. Set it in environment before running migration.')
    process.exit(1)
  }

  // 1. Location.fursCertPassword
  console.log('1. Location.fursCertPassword...')
  const loc = await migrateTable('Location', 'id', 'fursCertPassword', db.location)
  console.log(`   Total: ${loc.total}, Migrated: ${loc.migrated}, Already encrypted: ${loc.skipped}\n`)

  // 2. RestaurantSettings.fursCertPassword
  console.log('2. RestaurantSettings.fursCertPassword...')
  const rsFurs = await migrateTable('RestaurantSettings', 'id', 'fursCertPassword', db.restaurantSettings)
  console.log(`   Total: ${rsFurs.total}, Migrated: ${rsFurs.migrated}, Already encrypted: ${rsFurs.skipped}\n`)

  // 3. RestaurantSettings.emailSmtpPassword
  console.log('3. RestaurantSettings.emailSmtpPassword...')
  const rsSmtp = await migrateTable('RestaurantSettings', 'id', 'emailSmtpPassword', db.restaurantSettings)
  console.log(`   Total: ${rsSmtp.total}, Migrated: ${rsSmtp.migrated}, Already encrypted: ${rsSmtp.skipped}\n`)

  // 4. Webhook.secret
  console.log('4. Webhook.secret...')
  const wh = await migrateTable('Webhook', 'id', 'secret', db.webhook)
  console.log(`   Total: ${wh.total}, Migrated: ${wh.migrated}, Already encrypted: ${wh.skipped}\n`)

  // 5. Integration.apiKey
  console.log('5. Integration.apiKey...')
  const intKey = await migrateTable('Integration', 'id', 'apiKey', db.integration)
  console.log(`   Total: ${intKey.total}, Migrated: ${intKey.migrated}, Already encrypted: ${intKey.skipped}\n`)

  // 6. Integration.apiSecret
  console.log('6. Integration.apiSecret...')
  const intSecret = await migrateTable('Integration', 'id', 'apiSecret', db.integration)
  console.log(`   Total: ${intSecret.total}, Migrated: ${intSecret.migrated}, Already encrypted: ${intSecret.skipped}\n`)

  const totalMigrated = loc.migrated + rsFurs.migrated + rsSmtp.migrated + wh.migrated + intKey.migrated + intSecret.migrated
  const totalSkipped = loc.skipped + rsFurs.skipped + rsSmtp.skipped + wh.skipped + intKey.skipped + intSecret.skipped

  console.log('=== MIGRATION COMPLETE ===')
  console.log(`Total encrypted: ${totalMigrated}`)
  console.log(`Already encrypted (skipped): ${totalSkipped}`)
  console.log(`Total processed: ${totalMigrated + totalSkipped}`)
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
