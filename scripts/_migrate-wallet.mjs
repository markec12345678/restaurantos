// Migracija za WalletPayment tabelo
import { PGlite } from '@electric-sql/pglite'

const dataDir = process.env.PGLITE_DATA_DIR || '/home/z/my-project/pglite-test-data'
console.log(`[migrate-wallet] PGlite: ${dataDir}`)

const pg = new PGlite(dataDir)

const statements = [
  `CREATE TABLE IF NOT EXISTS "WalletPayment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "checkId" TEXT,
    "walletType" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL DEFAULT '',
    "merchantId" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentToken" TEXT NOT NULL DEFAULT '',
    "tokenType" TEXT NOT NULL DEFAULT '',
    "cardBrand" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "capturedAt" TIMESTAMP(3),
    "refundedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WalletPayment_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "WalletPayment_paymentId_idx" ON "WalletPayment"("paymentId")`,
  `CREATE INDEX IF NOT EXISTS "WalletPayment_checkId_idx" ON "WalletPayment"("checkId")`,
  `CREATE INDEX IF NOT EXISTS "WalletPayment_walletType_status_idx" ON "WalletPayment"("walletType", "status")`,
  `CREATE INDEX IF NOT EXISTS "WalletPayment_transactionId_idx" ON "WalletPayment"("transactionId")`,
  `CREATE INDEX IF NOT EXISTS "WalletPayment_createdAt_idx" ON "WalletPayment"("createdAt")`,
]

let applied = 0
let skipped = 0
for (const sql of statements) {
  try {
    await pg.exec(sql)
    applied++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      skipped++
    } else {
      console.error(`[migrate-wallet] Napaka: ${msg}`)
    }
  }
}

console.log(`[migrate-wallet] ✅ Applied: ${applied}, Skipped: ${skipped}`)

const tables = await pg.query(`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'WalletPayment'
`)
console.log(`[migrate-wallet] Tabele: ${tables.rows.map(r => r.tablename).join(', ')}`)

await pg.close()
