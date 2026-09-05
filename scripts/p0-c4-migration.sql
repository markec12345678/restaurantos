-- ============================================
-- P0-C4 Phase 5 — MIGRATION SQL
-- ============================================
-- NOT NULL + FK constraints za 24 TENANT_REQUIRED modele.
--
-- PRED POGOJI:
--   1. Zaženi scripts/p0-c4-backfill.mjs --apply (zapolni NULL vrednosti)
--   2. Zaženi scripts/p0-c4-backfill.mjs (dry-run verify — 0 remaining NULL)
--   3. Šele potem zaženi to migration SQL
--
-- ROLLBACK:
--   ALTER TABLE "Model" ALTER COLUMN "locationId" DROP NOT NULL;
--   ALTER TABLE "Model" DROP CONSTRAINT "Model_locationId_fkey";
-- ============================================

-- ─── Strategy 1: Order-relation modeli ─────────────────────
-- Ti modeli imajo orderId/checkId relacijo — backfill iz Order.locationId

-- Receipt (orderId → Order.locationId)
ALTER TABLE "Receipt" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_locationId_fkey";
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- JournalEntry (lahko iz Order, lahko manual)
ALTER TABLE "JournalEntry" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_locationId_fkey";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- JournalLine (denormalizirano iz JournalEntry)
ALTER TABLE "JournalLine" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "JournalLine" DROP CONSTRAINT IF EXISTS "JournalLine_locationId_fkey";
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Strategy 2: First-active-location modeli ──────────────
-- Ti modeli so backfill-ani na prvo aktivno lokacijo

-- Menu
ALTER TABLE "Menu" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Menu" DROP CONSTRAINT IF EXISTS "Menu_locationId_fkey";
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Table
ALTER TABLE "Table" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Table" DROP CONSTRAINT IF EXISTS "Table_locationId_fkey";
ALTER TABLE "Table" ADD CONSTRAINT "Table_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shift
ALTER TABLE "Shift" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_locationId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TimeEntry
ALTER TABLE "TimeEntry" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "TimeEntry" DROP CONSTRAINT IF EXISTS "TimeEntry_locationId_fkey";
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CashRegisterShift
ALTER TABLE "CashRegisterShift" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "CashRegisterShift" DROP CONSTRAINT IF EXISTS "CashRegisterShift_locationId_fkey";
ALTER TABLE "CashRegisterShift" ADD CONSTRAINT "CashRegisterShift_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- InventoryItem
ALTER TABLE "InventoryItem" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_locationId_fkey";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DeliveryZone
ALTER TABLE "DeliveryZone" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "DeliveryZone" DROP CONSTRAINT IF EXISTS "DeliveryZone_locationId_fkey";
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OpeningHours
ALTER TABLE "OpeningHours" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "OpeningHours" DROP CONSTRAINT IF EXISTS "OpeningHours_locationId_fkey";
ALTER TABLE "OpeningHours" ADD CONSTRAINT "OpeningHours_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HaccpEntry
ALTER TABLE "HaccpEntry" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "HaccpEntry" DROP CONSTRAINT IF EXISTS "HaccpEntry_locationId_fkey";
ALTER TABLE "HaccpEntry" ADD CONSTRAINT "HaccpEntry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StaffShift
ALTER TABLE "StaffShift" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "StaffShift" DROP CONSTRAINT IF EXISTS "StaffShift_locationId_fkey";
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reservation
ALTER TABLE "Reservation" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_locationId_fkey";
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PurchaseOrder
ALTER TABLE "PurchaseOrder" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_locationId_fkey";
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GuestFeedback
ALTER TABLE "GuestFeedback" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "GuestFeedback" DROP CONSTRAINT IF EXISTS "GuestFeedback_locationId_fkey";
ALTER TABLE "GuestFeedback" ADD CONSTRAINT "GuestFeedback_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ZReport
ALTER TABLE "ZReport" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "ZReport" DROP CONSTRAINT IF EXISTS "ZReport_locationId_fkey";
ALTER TABLE "ZReport" ADD CONSTRAINT "ZReport_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- TipPool
ALTER TABLE "TipPool" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "TipPool" DROP CONSTRAINT IF EXISTS "TipPool_locationId_fkey";
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DeliveryTracking
ALTER TABLE "DeliveryTracking" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "DeliveryTracking" DROP CONSTRAINT IF EXISTS "DeliveryTracking_locationId_fkey";
ALTER TABLE "DeliveryTracking" ADD CONSTRAINT "DeliveryTracking_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AccountsPayable
ALTER TABLE "AccountsPayable" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "AccountsPayable" DROP CONSTRAINT IF EXISTS "AccountsPayable_locationId_fkey";
ALTER TABLE "AccountsPayable" ADD CONSTRAINT "AccountsPayable_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AccountsReceivable
ALTER TABLE "AccountsReceivable" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "AccountsReceivable" DROP CONSTRAINT IF EXISTS "AccountsReceivable_locationId_fkey";
ALTER TABLE "AccountsReceivable" ADD CONSTRAINT "AccountsReceivable_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SustainabilityReport
ALTER TABLE "SustainabilityReport" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "SustainabilityReport" DROP CONSTRAINT IF EXISTS "SustainabilityReport_locationId_fkey";
ALTER TABLE "SustainabilityReport" ADD CONSTRAINT "SustainabilityReport_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DeviceRegistry
ALTER TABLE "DeviceRegistry" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "DeviceRegistry" DROP CONSTRAINT IF EXISTS "DeviceRegistry_locationId_fkey";
ALTER TABLE "DeviceRegistry" ADD CONSTRAINT "DeviceRegistry_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- VideoAnalyticsSession
ALTER TABLE "VideoAnalyticsSession" ALTER COLUMN "locationId" SET NOT NULL;
ALTER TABLE "VideoAnalyticsSession" DROP CONSTRAINT IF EXISTS "VideoAnalyticsSession_locationId_fkey";
ALTER TABLE "VideoAnalyticsSession" ADD CONSTRAINT "VideoAnalyticsSession_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Verification ──────────────────────────────────────────
-- Po migration preveri da ni NULL:
-- SELECT COUNT(*) FROM "Receipt" WHERE "locationId" IS NULL; -- mora biti 0
-- SELECT COUNT(*) FROM "Menu" WHERE "locationId" IS NULL; -- mora biti 0
-- ... (za vseh 24 modelov)

-- ─── Rollback script (če gre kaj narobe) ───────────────────
-- Kopiraj naslednje v rollback.sql in zaženi če migration pade:
--
-- ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_locationId_fkey";
-- ALTER TABLE "Receipt" ALTER COLUMN "locationId" DROP NOT NULL;
-- (ponovi za vse 24 modele)
