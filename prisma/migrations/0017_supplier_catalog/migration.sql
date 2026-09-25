-- 0017_supplier_catalog — R131 (epic #115 P1-13): supplier katalog + pack-size konverzije
--
-- Kanon P1-13: "Katalog → PO v paketih → GRN (prevzem) → zaloga v osnovnih
-- enotah → Price History na osnovno enoto → Recipe Cost / Reorder konsistentni."
-- Dobavitelj prodaja v PAKETIH (vrečka 25 kg, sod 50 L, karton 12 kos), zaloga
-- se vodi v OSNOVNIH enotah (kg, L, kos). SupplierItem je vezni člen.
--
-- packQty = koliko OSNOVNIH enot je 1 paket (Decimal(12,3) — pariteta zaloge);
-- pricePerPack = QUOTED cena iz cenika na PAKET (Decimal(12,4) — pariteta
-- price history P1-08). PurchaseOrderItem dobi NULL-able packQty/packUnit
-- SNAPSHOT ob kreaciji (NULL = legacy semantika — vrstica je v osnovnih
-- enotah; prevzem konvertira po snapshotu, ne po trenutnem katalogu).
--
-- Aditivna migracija (pariteta 0016): CREATE TABLE + indeksi + FK-ji + 2
-- stolpca na PurchaseOrderItem. BREZ data loss, brez ALTER obstoječih
-- stolpcev, brez backfill (katalog se gradi od zdaj naprej).

CREATE TABLE "SupplierItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "supplierSku" TEXT NOT NULL DEFAULT '',
    "packQty" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "packUnit" TEXT NOT NULL DEFAULT 'paket',
    "pricePerPack" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2),
    "minOrderPacks" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierItem_pkey" PRIMARY KEY ("id")
);

-- Ena katalog vrstica per (dobavitelj, artikel) — upsert po paru
CREATE UNIQUE INDEX "SupplierItem_supplierId_inventoryItemId_key" ON "SupplierItem"("supplierId", "inventoryItemId");

-- Aktivni katalog dobavitelja (draft-po batch load: isActive=true)
CREATE INDEX "SupplierItem_supplierId_isActive_idx" ON "SupplierItem"("supplierId", "isActive");

-- FK lookup — katalog vrstice per artikel (reorder enrichment)
CREATE INDEX "SupplierItem_inventoryItemId_idx" ON "SupplierItem"("inventoryItemId");

-- Dobavitelj: Cascade — katalog sledi dobavitelju (cenik brez dobavitelja je brez vrednosti)
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Artikel: Cascade — katalog sledi artiklu (prisma canonical onDelete: Cascade)
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PurchaseOrderItem += pack snapshot (NULL = legacy semantika, brez data loss)
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "packQty" DECIMAL(12,3);
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "packUnit" TEXT;
