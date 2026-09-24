-- 0007_batch_lot_expiry — batch/lot/expiry + FEFO (epic #115 §4, runda 120)
--
-- Veriga sledljivosti: supplier → prevzem ('procurement') → InventoryBatch →
-- poraba/odpad (StockBatchAllocation). Batch NI neodvisen vir zaloge —
-- InventoryItem.quantity + StockTransaction ostata source-of-truth; batch je
-- sledljivostna projekcija prevzemov na ledger. FEFO poraba po expiryDate ASC
-- (NULL = brez roka, zadnji), nato receivedAt ASC.
--
-- Migracija je čisto ADDITIVNA (2 tabeli + indeksi, vse povezave Restrict/
-- SetNull/Cascade) — non-breaking, brez backfilla. Zahteva prisma generate.

-- ── 1. InventoryBatch ──
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "locationId" TEXT,
    "lotNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "quantityInitial" DECIMAL(12,3) NOT NULL,
    "quantityRemaining" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "unitCost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- ── 2. StockBatchAllocation (per-batch razknjižba) ──
CREATE TABLE "StockBatchAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "stockTransactionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- ── 3. Indeksi ──
-- FEFO bralna pot + status + lokacija + rok po vseh artiklih + lot lookup
CREATE INDEX "InventoryBatch_inventoryItemId_expiryDate_idx" ON "InventoryBatch"("inventoryItemId", "expiryDate");
CREATE INDEX "InventoryBatch_inventoryItemId_status_idx" ON "InventoryBatch"("inventoryItemId", "status");
CREATE INDEX "InventoryBatch_locationId_idx" ON "InventoryBatch"("locationId");
CREATE INDEX "InventoryBatch_expiryDate_idx" ON "InventoryBatch"("expiryDate");
CREATE INDEX "InventoryBatch_lotNumber_idx" ON "InventoryBatch"("lotNumber");

CREATE INDEX "StockBatchAllocation_batchId_idx" ON "StockBatchAllocation"("batchId");
CREATE INDEX "StockBatchAllocation_stockTransactionId_idx" ON "StockBatchAllocation"("stockTransactionId");
CREATE INDEX "StockBatchAllocation_inventoryItemId_idx" ON "StockBatchAllocation"("inventoryItemId");

-- ── 4. FK povezave (Restrict: batch/alokacija sta revizijska dokaza;
--     SetNull: dobavitelj preživi kot snapshot ime; Cascade: alokacija
--     sledi svoji StockTransaction vrstici) ──
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE SET NULL;

ALTER TABLE "StockBatchAllocation" ADD CONSTRAINT "StockBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "StockBatchAllocation" ADD CONSTRAINT "StockBatchAllocation_stockTransactionId_fkey" FOREIGN KEY ("stockTransactionId") REFERENCES "StockTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
