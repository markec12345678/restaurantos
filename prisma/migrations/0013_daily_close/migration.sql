-- 0013_daily_close — R126 (epic #115 P0-02): Daily close / end-of-day reconciliation
--
-- Kanon: Z-poročilo obstaja (draft/finalized), poslovni proces dnevni zaključek
-- pa do sedaj ni obstajal: popis gotovine → variance → odobritev → zaključek
-- dneva → ponovno odpiranje (vse z audit sledjo).
--
-- - DailyClose: ENA vrstica na (locationId, businessDate); status workflow
--   PENDING_APPROVAL | CLOSED | REOPENED; snapshot agregatov Z-paritete.
-- - Location.dailyCloseVarianceThreshold: prag (EUR), nad katerim zaključek
--   dneva zahteva odobritev. Privzeto 5.00 EUR. Additivno, NOT NULL z default.

CREATE TABLE "DailyClose" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashVariance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "varianceThreshold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cardSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mobileSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "alternateSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalDiscounts" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTips" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalVoided" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRefunds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closedById" TEXT,
    "closedByName" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedByName" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT NOT NULL DEFAULT '',
    "rejectedNote" TEXT NOT NULL DEFAULT '',
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "reopenedById" TEXT,
    "reopenedByName" TEXT NOT NULL DEFAULT '',
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "zReportId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyClose_locationId_businessDate_key" ON "DailyClose"("locationId", "businessDate");
CREATE UNIQUE INDEX "DailyClose_locationId_idempotencyKey_key" ON "DailyClose"("locationId", "idempotencyKey");
CREATE INDEX "DailyClose_status_idx" ON "DailyClose"("status");
CREATE INDEX "DailyClose_businessDate_idx" ON "DailyClose"("businessDate");
CREATE INDEX "DailyClose_closedAt_idx" ON "DailyClose"("closedAt");

DO $$ BEGIN
  ALTER TABLE "DailyClose" ADD CONSTRAINT "DailyClose_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Prag variance za dnevni zaključek (additivno, privzeto 5.00 EUR)
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "dailyCloseVarianceThreshold" DECIMAL(12,2) NOT NULL DEFAULT 5.00;
