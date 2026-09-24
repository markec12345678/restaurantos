-- 0009_batch_preparation — sub-recepture / priprava vmesnih produktov
-- (epic #115 P0-04, runda 122)
--
-- Kanon P0-04: sestavine (input InventoryItem) → proizveden vmesni produkt
-- (output InventoryItem) v eni seriji priprave. BatchPreparation (glava:
-- DRAFT → COMPLETED | CANCELLED, idempotencyKey, actor snapshot-i,
-- cost basis snapshot) + BatchPreparationLine (per-vrstični input +
-- snapshot količine/cene + povezana porabna transakcija).
--
-- Zaključek (complete) poteka SKOZI R106 zalogovni kanon: input decrement
-- + StockTransaction 'batch-consumption' + FEFO razknjižba (R120), output
-- increment + StockTransaction 'batch-production' z izračunanim cost basis
-- = Σ(input totalCost) / outputQuantity. Nova kanonična tipa ledgerja:
-- 'batch-consumption' in 'batch-production' (aditivno).
--
-- Migracija je čisto ADDITIVNA (2 tabeli + indeksi; povezave
-- Restrict/SetNull/Cascade) — non-breaking, brez backfilla. Zahteva
-- prisma generate.

-- ── 1. BatchPreparation (glava priprave) ──
CREATE TABLE "BatchPreparation" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "outputItemId" TEXT NOT NULL,
    "outputQuantity" DECIMAL(12,3) NOT NULL,
    "outputUnit" TEXT NOT NULL DEFAULT '',
    "outputCostPerUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalInputCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "completedByName" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "outputStockTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchPreparation_pkey" PRIMARY KEY ("id")
);

-- ── 2. BatchPreparationLine (vrstica: input sestavina) ──
CREATE TABLE "BatchPreparationLine" (
    "id" TEXT NOT NULL,
    "preparationId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(12,3) NOT NULL,
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "inputStockTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchPreparationLine_pkey" PRIMARY KEY ("id")
);

-- ── 3. Unique + FK omejitve ──
CREATE UNIQUE INDEX "BatchPreparation_locationId_idempotencyKey_key" ON "BatchPreparation"("locationId", "idempotencyKey");
CREATE UNIQUE INDEX "BatchPreparation_outputStockTransactionId_key" ON "BatchPreparation"("outputStockTransactionId");
CREATE UNIQUE INDEX "BatchPreparationLine_preparationId_inventoryItemId_key" ON "BatchPreparationLine"("preparationId", "inventoryItemId");
CREATE UNIQUE INDEX "BatchPreparationLine_inputStockTransactionId_key" ON "BatchPreparationLine"("inputStockTransactionId");

CREATE INDEX "BatchPreparation_locationId_createdAt_idx" ON "BatchPreparation"("locationId", "createdAt");
CREATE INDEX "BatchPreparation_status_idx" ON "BatchPreparation"("status");
CREATE INDEX "BatchPreparation_outputItemId_idx" ON "BatchPreparation"("outputItemId");
CREATE INDEX "BatchPreparation_idempotencyKey_idx" ON "BatchPreparation"("idempotencyKey");
CREATE INDEX "BatchPreparationLine_inventoryItemId_idx" ON "BatchPreparationLine"("inventoryItemId");

ALTER TABLE "BatchPreparation" ADD CONSTRAINT "BatchPreparation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BatchPreparation" ADD CONSTRAINT "BatchPreparation_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BatchPreparation" ADD CONSTRAINT "BatchPreparation_outputStockTransactionId_fkey" FOREIGN KEY ("outputStockTransactionId") REFERENCES "StockTransaction"("id") ON DELETE SET NULL ON UPDATE SET NULL;
ALTER TABLE "BatchPreparationLine" ADD CONSTRAINT "BatchPreparationLine_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "BatchPreparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchPreparationLine" ADD CONSTRAINT "BatchPreparationLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "BatchPreparationLine" ADD CONSTRAINT "BatchPreparationLine_inputStockTransactionId_fkey" FOREIGN KEY ("inputStockTransactionId") REFERENCES "StockTransaction"("id") ON DELETE SET NULL ON UPDATE SET NULL;
