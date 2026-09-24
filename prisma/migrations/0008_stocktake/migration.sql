-- 0008_stocktake — fizična inventura + reconciliation (epic #115 P0-01, runda 121)
--
-- Kanon P0-01: theoretical stock → physical count → variance → approval →
-- adjustment → new baseline. Stocktake (header: DRAFT → IN_REVIEW →
-- APPROVED | CANCELLED, recount zaščita, actor snapshot-i, idempotencyKey)
-- + StocktakeItem (per-vrstični snapshot expected/cost + fizično štetje +
-- snapshot razlike). Potrditev aplicira korekcije SKOZI R106 zalogovni
-- kanon: vsaka neničelna razlika pusti StockTransaction
-- ('adjustment'/'write-off', previousQty → newQty) — InventoryItem.quantity
-- se NIKOLI ne spremeni mimo sledljivega ledger dogodka.
--
-- Migracija je čisto ADDITIVNA (2 tabeli + indeksi; vse povezave
-- Restrict/SetNull/Cascade) — non-breaking, brez backfilla. Zahteva
-- prisma generate.

-- ── 1. Stocktake (glava inventure) ──
CREATE TABLE "Stocktake" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT NOT NULL DEFAULT '',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "approvedByName" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "recountCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stocktake_pkey" PRIMARY KEY ("id")
);

-- ── 2. StocktakeItem (vrstica inventure) ──
CREATE TABLE "StocktakeItem" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "expectedQuantity" DECIMAL(12,3) NOT NULL,
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "countedQuantity" DECIMAL(12,3),
    "varianceQuantity" DECIMAL(12,3),
    "varianceValue" DECIMAL(12,2),
    "lineNote" TEXT NOT NULL DEFAULT '',
    "countedAt" TIMESTAMP(3),
    "countedByName" TEXT NOT NULL DEFAULT '',
    "stockTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StocktakeItem_pkey" PRIMARY KEY ("id")
);

-- ── 3. Unique + FK omejitve ──
CREATE UNIQUE INDEX "Stocktake_locationId_idempotencyKey_key" ON "Stocktake"("locationId", "idempotencyKey");
CREATE UNIQUE INDEX "StocktakeItem_stocktakeId_inventoryItemId_key" ON "StocktakeItem"("stocktakeId", "inventoryItemId");
CREATE UNIQUE INDEX "StocktakeItem_stockTransactionId_key" ON "StocktakeItem"("stockTransactionId");

CREATE INDEX "Stocktake_locationId_createdAt_idx" ON "Stocktake"("locationId", "createdAt");
CREATE INDEX "Stocktake_status_idx" ON "Stocktake"("status");
CREATE INDEX "Stocktake_idempotencyKey_idx" ON "Stocktake"("idempotencyKey");
CREATE INDEX "StocktakeItem_stocktakeId_idx" ON "StocktakeItem"("stocktakeId");
CREATE INDEX "StocktakeItem_inventoryItemId_idx" ON "StocktakeItem"("inventoryItemId");

ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StocktakeItem" ADD CONSTRAINT "StocktakeItem_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StocktakeItem" ADD CONSTRAINT "StocktakeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "StocktakeItem" ADD CONSTRAINT "StocktakeItem_stockTransactionId_fkey" FOREIGN KEY ("stockTransactionId") REFERENCES "StockTransaction"("id") ON DELETE SET NULL ON UPDATE SET NULL;
