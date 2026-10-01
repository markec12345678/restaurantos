-- ============================================
-- R195 — NEON locationId DRIFT-MOST: TRAJNA REŠITEV (MIGRATION SQL)
-- ============================================
-- PROBLEM (glej src/lib/prisma-column-fallback.ts): Neon produkcija ima na 11
-- konfiguracijskih tabelah ŠE danes NI stolpca `locationId` (db push/migrate ni
-- bil pognan ob MODEL A multi-location spremembi), Prisma schema pa ga zahteva
-- (String NOT NULL). Vsak create / update / findFirst z locationId vrne P2022 —
-- most (withLocationColumnFallback) operacijo ponovi BREZ lokacijskega filtra
-- (vrstica postane "globalna"). Varno za trenutno single-tenant realnost, NE za
-- pravi multi-tenant.
--
-- TA PAKET = trajna rešitev na DB nivoju. Po aplikaciji P2022 ne nastopi več →
-- most samodejno izgubi vlogo (run(true) vedno uspe).
--
-- POGOJI ZA APLIKACIJO (fail-closed, uveljavlja tudi apply skripta):
--   1. TOČNO ENA vrstica v tabeli "Location" (single-tenant produkcija).
--      Več lokacij → ročna preslikava per tabelo (skripta abortira).
--   2. Zaženi: node scripts/r195-apply-locationid-migration.mjs
--      (preveri drift stanje → aplikira → post-verificira)
--
-- IDEMPOTENČNOST: vsak stavek je varno ponovljiv (IF NOT EXISTS / IF EXISTS /
-- pogojni UPDATE). Ponovni zagon ne poškoduje stanja.
--
-- FORMAT: TOČNO EN stavek na vrstico (brez ';' znotraj stavka, komentarji samo
-- na lastnih vrsticah) — tako IT test (tests/integration/r195-...) in apply
-- skripta ločujeta stavke po vrsticah iz ENEGA vira resnice (te datoteke).
--
-- ROLLBACK (per tabela, ne priporočeno — vrne drift):
--   ALTER TABLE "X" DROP CONSTRAINT IF EXISTS "X_locationId_fkey";
--   ALTER TABLE "X" ALTER COLUMN "locationId" DROP NOT NULL;
--   ALTER TABLE "X" DROP COLUMN IF EXISTS "locationId";
-- ============================================

-- ─── DiningOption ───
ALTER TABLE "DiningOption" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "DiningOption" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "DiningOption" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "DiningOption" DROP CONSTRAINT IF EXISTS "DiningOption_locationId_fkey";
ALTER TABLE "DiningOption" ADD CONSTRAINT "DiningOption_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "DiningOption_locationId_idx" ON "DiningOption"("locationId");
-- ─── RevenueCenter ───
ALTER TABLE "RevenueCenter" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "RevenueCenter" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "RevenueCenter" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "RevenueCenter" DROP CONSTRAINT IF EXISTS "RevenueCenter_locationId_fkey";
ALTER TABLE "RevenueCenter" ADD CONSTRAINT "RevenueCenter_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "RevenueCenter_locationId_idx" ON "RevenueCenter"("locationId");
-- ─── SalesCategory ───
ALTER TABLE "SalesCategory" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "SalesCategory" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "SalesCategory" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "SalesCategory" DROP CONSTRAINT IF EXISTS "SalesCategory_locationId_fkey";
ALTER TABLE "SalesCategory" ADD CONSTRAINT "SalesCategory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "SalesCategory_locationId_idx" ON "SalesCategory"("locationId");
-- ─── PriceGroup ───
ALTER TABLE "PriceGroup" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "PriceGroup" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "PriceGroup" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "PriceGroup" DROP CONSTRAINT IF EXISTS "PriceGroup_locationId_fkey";
ALTER TABLE "PriceGroup" ADD CONSTRAINT "PriceGroup_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "PriceGroup_locationId_idx" ON "PriceGroup"("locationId");
-- ─── ServiceCharge ───
ALTER TABLE "ServiceCharge" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "ServiceCharge" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "ServiceCharge" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "ServiceCharge" DROP CONSTRAINT IF EXISTS "ServiceCharge_locationId_fkey";
ALTER TABLE "ServiceCharge" ADD CONSTRAINT "ServiceCharge_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ServiceCharge_locationId_idx" ON "ServiceCharge"("locationId");
-- ─── PrepStation ───
ALTER TABLE "PrepStation" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "PrepStation" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "PrepStation" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "PrepStation" DROP CONSTRAINT IF EXISTS "PrepStation_locationId_fkey";
ALTER TABLE "PrepStation" ADD CONSTRAINT "PrepStation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "PrepStation_locationId_idx" ON "PrepStation"("locationId");
-- ─── VoidReason ───
ALTER TABLE "VoidReason" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "VoidReason" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "VoidReason" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "VoidReason" DROP CONSTRAINT IF EXISTS "VoidReason_locationId_fkey";
ALTER TABLE "VoidReason" ADD CONSTRAINT "VoidReason_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "VoidReason_locationId_idx" ON "VoidReason"("locationId");
-- ─── NoSaleReason ───
ALTER TABLE "NoSaleReason" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "NoSaleReason" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "NoSaleReason" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "NoSaleReason" DROP CONSTRAINT IF EXISTS "NoSaleReason_locationId_fkey";
ALTER TABLE "NoSaleReason" ADD CONSTRAINT "NoSaleReason_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "NoSaleReason_locationId_idx" ON "NoSaleReason"("locationId");
-- ─── AlternatePaymentType ───
ALTER TABLE "AlternatePaymentType" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "AlternatePaymentType" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "AlternatePaymentType" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "AlternatePaymentType" DROP CONSTRAINT IF EXISTS "AlternatePaymentType_locationId_fkey";
ALTER TABLE "AlternatePaymentType" ADD CONSTRAINT "AlternatePaymentType_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "AlternatePaymentType_locationId_idx" ON "AlternatePaymentType"("locationId");
-- ─── Printer ───
ALTER TABLE "Printer" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "Printer" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "Printer" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Printer" DROP CONSTRAINT IF EXISTS "Printer_locationId_fkey";
ALTER TABLE "Printer" ADD CONSTRAINT "Printer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Printer_locationId_idx" ON "Printer"("locationId");
-- ─── Discount ───
ALTER TABLE "Discount" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
UPDATE "Discount" SET "locationId" = (SELECT "id" FROM "Location" ORDER BY "createdAt" ASC LIMIT 1) WHERE "locationId" IS NULL;
ALTER TABLE "Discount" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Discount" DROP CONSTRAINT IF EXISTS "Discount_locationId_fkey";
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Discount_locationId_idx" ON "Discount"("locationId");
