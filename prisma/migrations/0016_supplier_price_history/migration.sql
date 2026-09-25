-- 0016_supplier_price_history — R130 (epic #115 P1-08): supplier price intelligence
--
-- Kanon P1-08: "Goods Receipt → Supplier → Price History → Recipe Cost → Margin".
-- Vsak prevzem blaga (receivePurchaseOrderItems kanon) samodejno zajame nabavno
-- ceno postavke (source 'goods_receipt'); ročne korekcije prihajajo prek
-- POST /api/inventory/price-history (source 'manual'). Cene porabita recepture
-- (strošek linije) in reorder center (enota cena).
--
-- ZASEDNOST (kanon): prevzemi z unitPrice <= 0 (darila/vzorci) se NE zajamejo —
-- to je aplikacijska logika, ne omejitev baze. Decimal(12,4) je natančnejši od
-- InventoryItem.costPerUnit (12,2), ker je zgodovina/analitika.
--
-- Aditivna migracija: CREATE TABLE + indeksi + FK-ji. BREZ data loss,
-- brez ALTER obstoječih tabel, brez backfill (zgodovina se gradi od zdaj naprej).

CREATE TABLE "SupplierPriceHistory" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "vatRate" DECIMAL(5,2),
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "source" TEXT NOT NULL DEFAULT 'goods_receipt',
    "purchaseOrderId" TEXT,
    "locationId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SupplierPriceHistory_pkey" PRIMARY KEY ("id")
);

-- Zgodovina cen per artikel (časovnica) — GET ?inventoryItemId=
CREATE INDEX "SupplierPriceHistory_inventoryItemId_observedAt_idx" ON "SupplierPriceHistory"("inventoryItemId", "observedAt");

-- Zadnja cena per (dobavitelj, artikel) — reorder/recipes enrichment
CREATE INDEX "SupplierPriceHistory_supplierId_inventoryItemId_observedAt_idx" ON "SupplierPriceHistory"("supplierId", "inventoryItemId", "observedAt");

-- Filtriranje po izvoru ('goods_receipt' | 'manual')
CREATE INDEX "SupplierPriceHistory_source_idx" ON "SupplierPriceHistory"("source");

-- Tenant metadata (pariteta PurchaseOrder.locationId) za prihodnji filtering
CREATE INDEX "SupplierPriceHistory_locationId_idx" ON "SupplierPriceHistory"("locationId");

-- FK lookup — vrstice prevzema per naročilnica
CREATE INDEX "SupplierPriceHistory_purchaseOrderId_idx" ON "SupplierPriceHistory"("purchaseOrderId");

-- Dobavitelj: Restrict — brisanje dobavitelja s ceno ne sme počistiti forenziko
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Artikel: Cascade — zgodovina sledi artiklu
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Naročilnica: SetNull — izbris PO ne sme izgubiti cenovne vrstice (forenzika)
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lokacija: SetNull — tenant metadata (pariteta PurchaseOrder.locationId)
ALTER TABLE "SupplierPriceHistory" ADD CONSTRAINT "SupplierPriceHistory_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;
