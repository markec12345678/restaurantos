-- 0006_waste_ledger — namenski waste ledger (epic #115 §3, runda 119)
--
-- Prodajna poraba (StockTransaction 'sale') ≠ odpad (WasteRecord + 'write-off')
-- ≠ popravek zaloge ('adjustment'). Vsak WasteRecord je ledger dogodek, ki
-- atomarno povzroči zaščiten odpis zaloge (R106 kanon) in pusti sled:
-- razlog, vrednost, uporabnik, lokacija, povezana StockTransaction.
--
-- Migracija je čisto ADDITIVNA (1 tabela + indeksi, vse povezave Restrict/
-- SetNull) — non-breaking, brez backfilla. Zahteva prisma generate.

-- ── 1. Tabela ──
CREATE TABLE "WasteRecord" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "stockTransactionId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalStockTransactionId" TEXT,
    "idempotencyKey" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteRecord_pkey" PRIMARY KEY ("id")
);

-- ── 2. Indeksi (poročila po lokaciji/času, artiklu, razlogu + idempotency) ──
CREATE INDEX "WasteRecord_locationId_createdAt_idx" ON "WasteRecord"("locationId", "createdAt");
CREATE INDEX "WasteRecord_inventoryItemId_idx" ON "WasteRecord"("inventoryItemId");
CREATE INDEX "WasteRecord_reason_idx" ON "WasteRecord"("reason");
CREATE INDEX "WasteRecord_idempotencyKey_idx" ON "WasteRecord"("idempotencyKey");
CREATE UNIQUE INDEX "WasteRecord_locationId_idempotencyKey_key" ON "WasteRecord"("locationId", "idempotencyKey");
CREATE UNIQUE INDEX "WasteRecord_stockTransactionId_key" ON "WasteRecord"("stockTransactionId");
CREATE UNIQUE INDEX "WasteRecord_reversalStockTransactionId_key" ON "WasteRecord"("reversalStockTransactionId");

-- ── 3. FK povezave (Restrict: zgodovina odpada ne sme obstati brez
--     lokacije/artikla; SetNull: ledger vrstica preživi čiščenje tx zgodovine) ──
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_stockTransactionId_fkey" FOREIGN KEY ("stockTransactionId") REFERENCES "StockTransaction"("id") ON DELETE SET NULL ON UPDATE SET NULL;
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_reversalStockTransactionId_fkey" FOREIGN KEY ("reversalStockTransactionId") REFERENCES "StockTransaction"("id") ON DELETE SET NULL ON UPDATE SET NULL;
