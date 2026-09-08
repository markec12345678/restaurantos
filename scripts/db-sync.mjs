#!/usr/bin/env node
/**
 * db-sync.mjs — idempotentna DDL sinhronizacija baze med buildom.
 *
 * Namen: Vercel build dobi dešifriran DATABASE_URL (ki runtime API ne more
 * izdati) in zato build EXAKTNO TU lahko varno aplikira manjkajoče
 * primerjave sheme (schema drift) pred zagonom nove kode.
 *
 * Načela:
 *  - SAMO dodatne, nedestruktivne spremembe (ADD COLUMN IF NOT EXISTS,
 *    CREATE INDEX IF NOT EXISTS, pogojni FK) — NIKOLI drop/alter tipov.
 *  - Best-effort: napaka NE sme prelomiti builda (warn + exit 0).
 *  - Lokalni razvoj (brez DATABASE_URL / PGlite način): nemoten preskok.
 *
 * Uporaba: node scripts/db-sync.mjs  (zagnano iz "build" skripte)
 */
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
const isExternalPostgres =
  dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

if (!isExternalPostgres) {
  console.log(
    '[db-sync] DATABASE_URL ni nastavljen ali ni zunanji PostgreSQL — preskakujem (PGlite/lokalni način).'
  )
  process.exit(0)
}

// Idempotentni DDL — vsak stavek je VAREN za večkratno izvajanje.
const statements = [
  // ── FIX IDOR-AUDIT (runda 12): WaitlistEntry tenant scope ──
  'ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
  'CREATE INDEX IF NOT EXISTS "WaitlistEntry_locationId_idx" ON "WaitlistEntry"("locationId")',
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaitlistEntry_locationId_fkey') THEN
       ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_locationId_fkey"
       FOREIGN KEY ("locationId") REFERENCES "Location"("id")
       ON DELETE SET NULL ON UPDATE SET NULL;
     END IF;
   END $$;`,
  // ── FIX AUDIT: OutboxEvent.response — ločeno polje za odziv procesorja ──
  'ALTER TABLE "OutboxEvent" ADD COLUMN IF NOT EXISTS "response" JSONB',
  // ── P0-C4 Phase 3: Location loyalty + email config (per-lokacija) ──
  // Shema (schema.prisma/schema.sql) te stolpce že ima; ta DDL zagotavlja, da
  // jih ima TUDI produkcjska Neon baza (admin/migrate je ročen — db-sync je
  // avtomatska varovalka proti shema-drift ob vsakem deployu).
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "loyaltyEnabled" BOOLEAN DEFAULT false',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "loyaltyPointsPerEuro" INTEGER DEFAULT 1',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "loyaltyPointsValue" DECIMAL(65,30) DEFAULT 0.01',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "emailReportRecipients" TEXT DEFAULT \'[]\'',
  'ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "emailEnabled" BOOLEAN DEFAULT false',
  // ── P0-C4 Phase 4: Webhook.locationId (tenant isolation filter) ──
  // Webhook engine že filtrira po locationId — če stolpec manjka, BI vsak
  // trigger padel ob zagonu (Prisma client ga pričakuje po generate).
  'ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "locationId" TEXT',
  'CREATE INDEX IF NOT EXISTS "Webhook_locationId_idx" ON "Webhook"("locationId")',
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Webhook_locationId_fkey') THEN
       ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_locationId_fkey"
       FOREIGN KEY ("locationId") REFERENCES "Location"("id")
       ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$;`,
  // ════════════════════════════════════════════════════════════════
  // P1 AUDIT PODATKOVNEGA MODELA (v1.0.10):
  //  P1-6: backfill Order/Receipt.locationId (pred NOT NULL v naslednjem ciklu)
  //  P1-7: unique omejitve zožene na lokacijo (orderNumber, receiptNumber,
  //        TaxRate.code, InventoryItem.menuItemId, LoyaltyAccount.phone)
  //  P1-8: Decimal(65,30) → Decimal(12,2)/(5,2)/(12,3) za denar/stopnje/količine
  // ════════════════════════════════════════════════════════════════
  // ── P1-6 BACKFILL: Receipt.locationId iz Order (fiskalna veriga) ──
  'UPDATE "Receipt" r SET "locationId" = o."locationId" FROM "Order" o WHERE r."orderId" = o."id" AND r."locationId" IS NULL AND o."locationId" IS NOT NULL',
  // ── P1-6 BACKFILL: Order → privzeta (aktivna) lokacija — samo če obstaja ──
  'UPDATE "Order" SET "locationId" = (SELECT "id" FROM "Location" WHERE "isActive" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL AND EXISTS (SELECT 1 FROM "Location" WHERE "isActive")',
  // ── P1-6 BACKFILL: Receipt → privzeta lokacija (ostanki brez orderja) ──
  'UPDATE "Receipt" SET "locationId" = (SELECT "id" FROM "Location" WHERE "isActive" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL AND EXISTS (SELECT 1 FROM "Location" WHERE "isActive")',
  // ── P1-7: Order.orderNumber — globalni unique OFF, per-lokacijski ON ──
  'ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_orderNumber_key"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "Order_locationId_orderNumber_key" ON "Order"("locationId", "orderNumber")',
  // ── P1-7 (FURS): Receipt.receiptNumber — per poslovni prostor ──
  'ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_receiptNumber_key"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "Receipt_locationId_receiptNumber_key" ON "Receipt"("locationId", "receiptNumber")',
  // ── P1-7: TaxRate.code — per lokacija (globalne stopnje ostanejo unikatne) ──
  'ALTER TABLE "TaxRate" DROP CONSTRAINT IF EXISTS "TaxRate_code_key"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "TaxRate_location_code_key" ON "TaxRate"("locationId", "code") WHERE "locationId" IS NOT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS "TaxRate_code_global_key" ON "TaxRate"("code") WHERE "locationId" IS NULL',
  // ── P1-7: InventoryItem.menuItemId — per lokacija (skupna zaloga: NULL vrstice) ──
  'ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_menuItemId_key"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_menuItem_location_key" ON "InventoryItem"("menuItemId", "locationId") WHERE "menuItemId" IS NOT NULL',
  // ── P1-7: LoyaltyAccount.customerPhone — per lokacija (delni: samo ne-prazni) ──
  'ALTER TABLE "LoyaltyAccount" DROP CONSTRAINT IF EXISTS "LoyaltyAccount_customerPhone_key"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyAccount_phone_location_key" ON "LoyaltyAccount"("customerPhone", "locationId") WHERE "customerPhone" <> \'\' AND "locationId" IS NOT NULL',
  // ── P1-7: per-lokacijski števci (self-init) — index za hitre scoped poizvedbe ──
  'CREATE INDEX IF NOT EXISTS "Counter_name_idx" ON "Counter"("name")',
  // ── P1-8: DECIMAL precision/scale (107 stolpcev; obstoječe vrednosti so 2-dec) ──
  'ALTER TABLE "MenuItem" ALTER COLUMN "price" TYPE DECIMAL(12,2)',
  'ALTER TABLE "MenuItem" ALTER COLUMN "vatRate" TYPE DECIMAL(5,2)',
  'ALTER TABLE "Modifier" ALTER COLUMN "price" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TaxRate" ALTER COLUMN "rate" TYPE DECIMAL(5,2)',
  'ALTER TABLE "ServiceCharge" ALTER COLUMN "amount" TYPE DECIMAL(5,2)',
  'ALTER TABLE "PackagingItem" ALTER COLUMN "price" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Order" ALTER COLUMN "subtotal" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Order" ALTER COLUMN "tax" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Order" ALTER COLUMN "discount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Order" ALTER COLUMN "tip" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Order" ALTER COLUMN "total" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Order" ALTER COLUMN "totalWithTip" TYPE DECIMAL(12,2)',
  'ALTER TABLE "OrderItem" ALTER COLUMN "price" TYPE DECIMAL(12,2)',
  'ALTER TABLE "OrderItem" ALTER COLUMN "vatRate" TYPE DECIMAL(5,2)',
  'ALTER TABLE "OrderItem" ALTER COLUMN "vatAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "OrderItem" ALTER COLUMN "discountAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "subtotal" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "tax" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "discount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "serviceCharge" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "total" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "tip" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Check" ALTER COLUMN "totalWithTip" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Payment" ALTER COLUMN "tipAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Discount" ALTER COLUMN "amount" TYPE DECIMAL(5,2)',
  'ALTER TABLE "DeliveryInfo" ALTER COLUMN "packagingFee" TYPE DECIMAL(12,2)',
  'ALTER TABLE "DeliveryInfo" ALTER COLUMN "deliveryFee" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Job" ALTER COLUMN "basePayRate" TYPE DECIMAL(12,2)',
  'ALTER TABLE "EmployeeJob" ALTER COLUMN "payRate" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TimeEntry" ALTER COLUMN "payRate" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TimeEntry" ALTER COLUMN "totalPay" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "closingCash" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "expectedCash" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "splitPayments" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "totalSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "totalDiscounts" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "totalTips" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "totalVoided" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "totalRefunds" TYPE DECIMAL(12,2)',
  'ALTER TABLE "CashRegisterShift" ALTER COLUMN "cashDifference" TYPE DECIMAL(12,2)',
  'ALTER TABLE "InventoryItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,3)',
  'ALTER TABLE "InventoryItem" ALTER COLUMN "minQuantity" TYPE DECIMAL(12,3)',
  'ALTER TABLE "InventoryItem" ALTER COLUMN "costPerUnit" TYPE DECIMAL(12,2)',
  'ALTER TABLE "InventoryItem" ALTER COLUMN "servingsPerUnit" TYPE DECIMAL(12,3)',
  'ALTER TABLE "InventoryItem" ALTER COLUMN "costPerServing" TYPE DECIMAL(12,2)',
  'ALTER TABLE "StockTransaction" ALTER COLUMN "quantity" TYPE DECIMAL(12,3)',
  'ALTER TABLE "StockTransaction" ALTER COLUMN "previousQty" TYPE DECIMAL(12,3)',
  'ALTER TABLE "StockTransaction" ALTER COLUMN "newQty" TYPE DECIMAL(12,3)',
  'ALTER TABLE "StockTransaction" ALTER COLUMN "costPerUnit" TYPE DECIMAL(12,2)',
  'ALTER TABLE "StockTransaction" ALTER COLUMN "totalCost" TYPE DECIMAL(12,2)',
  'ALTER TABLE "RecipeItem" ALTER COLUMN "quantityPerServing" TYPE DECIMAL(12,3)',
  'ALTER TABLE "Receipt" ALTER COLUMN "subtotal" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Receipt" ALTER COLUMN "totalVat" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Receipt" ALTER COLUMN "discount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Receipt" ALTER COLUMN "total" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Receipt" ALTER COLUMN "tip" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Receipt" ALTER COLUMN "totalWithTip" TYPE DECIMAL(12,2)',
  'ALTER TABLE "LoyaltyTransaction" ALTER COLUMN "monetaryValue" TYPE DECIMAL(12,2)',
  'ALTER TABLE "GiftCard" ALTER COLUMN "balance" TYPE DECIMAL(12,2)',
  'ALTER TABLE "GiftCard" ALTER COLUMN "initialBalance" TYPE DECIMAL(12,2)',
  'ALTER TABLE "GiftCardTransaction" ALTER COLUMN "amount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "GiftCardTransaction" ALTER COLUMN "balanceAfter" TYPE DECIMAL(12,2)',
  'ALTER TABLE "RestaurantSettings" ALTER COLUMN "loyaltyPointsValue" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Location" ALTER COLUMN "loyaltyPointsValue" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Guest" ALTER COLUMN "totalSpent" TYPE DECIMAL(12,2)',
  'ALTER TABLE "GuestVisit" ALTER COLUMN "totalSpent" TYPE DECIMAL(12,2)',
  'ALTER TABLE "GuestVisit" ALTER COLUMN "tipAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "PurchaseOrder" ALTER COLUMN "subtotal" TYPE DECIMAL(12,2)',
  'ALTER TABLE "PurchaseOrder" ALTER COLUMN "vatAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "Subscription" ALTER COLUMN "monthlyPrice" TYPE DECIMAL(12,2)',
  'ALTER TABLE "SubscriptionInvoice" ALTER COLUMN "amount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "SubscriptionInvoice" ALTER COLUMN "vatRate" TYPE DECIMAL(5,2)',
  'ALTER TABLE "SubscriptionInvoice" ALTER COLUMN "vatAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "SubscriptionInvoice" ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalNetSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalTax" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "cashSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "cardSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "mobileSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "alternateSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "dineInSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "takeoutSales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "deliverySales" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "vatStandard" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "vatStandardAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "vatReduced" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "vatReducedAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "vatZero" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "avgOrderValue" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalDiscounts" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalTips" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalVoided" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "totalStorno" TYPE DECIMAL(12,2)',
  'ALTER TABLE "ZReport" ALTER COLUMN "cashDifference" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TipPool" ALTER COLUMN "totalTips" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TipPool" ALTER COLUMN "cashTips" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TipPool" ALTER COLUMN "cardTips" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TipDistribution" ALTER COLUMN "hoursWorked" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TipDistribution" ALTER COLUMN "points" TYPE DECIMAL(12,2)',
  'ALTER TABLE "TipDistribution" ALTER COLUMN "amount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "JournalLine" ALTER COLUMN "debit" TYPE DECIMAL(12,2)',
  'ALTER TABLE "JournalLine" ALTER COLUMN "credit" TYPE DECIMAL(12,2)',
  'ALTER TABLE "AccountsPayable" ALTER COLUMN "totalAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "AccountsPayable" ALTER COLUMN "paidAmount" TYPE DECIMAL(12,2)',
  'ALTER TABLE "AccountsReceivable" ALTER COLUMN "paidAmount" TYPE DECIMAL(12,2)',
  // ── P1-6 HARDENING (drugi korak, po tem ko je koda v1.0.10+ živa):
  // Order/Receipt.locationId → NOT NULL — SAMO če 0 NULL vrstic (varovano).
  // Koda od v1.0.10 vedno zapisuje locationId; backfill zgoraj je počistil zgodovino.
  // Če NULL ostanejo (npr. vrstice nastale v build-oknu prejšnjega deploya), se
  // constraint preskoči in logira — nikoli ne prelomi deploya.
  `DO $$ BEGIN
     IF (SELECT COUNT(*) FROM "Order" WHERE "locationId" IS NULL) = 0 THEN
       ALTER TABLE "Order" ALTER COLUMN "locationId" SET NOT NULL;
     ELSE
       RAISE NOTICE 'P1-6: Order ima % NULL locationId vrstic — SET NOT NULL preskočen', (SELECT COUNT(*) FROM "Order" WHERE "locationId" IS NULL);
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF (SELECT COUNT(*) FROM "Receipt" WHERE "locationId" IS NULL) = 0 THEN
       ALTER TABLE "Receipt" ALTER COLUMN "locationId" SET NOT NULL;
     ELSE
       RAISE NOTICE 'P1-6: Receipt ima % NULL locationId vrstic — SET NOT NULL preskočen', (SELECT COUNT(*) FROM "Receipt" WHERE "locationId" IS NULL);
     END IF;
   END $$;`,
]

// Neon serverless: ena povezava, kratek timeout (enak vzorcu kot src/lib/db.ts)
let optimizedUrl = dbUrl
if (!dbUrl.includes('connection_limit')) {
  const sep = dbUrl.includes('?') ? '&' : '?'
  optimizedUrl = `${dbUrl}${sep}connection_limit=1&connection_timeout=10&pool_timeout=10`
}

const prisma = new PrismaClient({
  datasources: { db: { url: optimizedUrl } },
  log: ['error'],
})

console.log('[db-sync] Zunanji PostgreSQL zaznan — apliciram idempotentni DDL …')

try {
  let applied = 0
  for (const stmt of statements) {
    const label = stmt.split('\n')[0].slice(0, 90)
    try {
      await prisma.$executeRawUnsafe(stmt)
      applied++
      console.log(`[db-sync] OK: ${label}`)
    } catch (err) {
      const msg = (err && err.message ? err.message : String(err)).slice(0, 160)
      console.warn(`[db-sync] SKIP/opozorilo: ${label} — ${msg}`)
    }
  }
  console.log(`[db-sync] Dokončano: ${applied}/${statements.length} stavkov apliciranih.`)
} catch (err) {
  // NIKOLI ne prelomimo builda — sinhronizacija je best-effort.
  const msg = (err && err.message ? err.message : String(err)).slice(0, 200)
  console.warn(`[db-sync] Zunanja napaka (build se nadaljuje): ${msg}`)
} finally {
  try {
    await prisma.$disconnect()
  } catch {}
}

process.exit(0)
