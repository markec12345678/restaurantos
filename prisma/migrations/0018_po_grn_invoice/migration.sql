-- 0018_po_grn_invoice — R132 (epic #115 P1-12): PO / GRN / supplier-invoice reconciliation
--
-- Kanon P1-12: "PO (naročeno) ↔ GRN (prejeto: sprejeto + zavrnjeno) ↔ Supplier
-- Invoice (zaračunano)" — three-way match. Vsak fizični prevzem = dokument
-- (GoodsReceipt + GoodsReceiptItem), vsak račun dobavitelja = prave linije na
-- AccountsPayable (AccountsPayableLine). Variance se PRIKAŽE, nabavna cena se
-- NE tiho prepše (price history se iz računa NIKOLI ne prepisuje — kanon #6).
--
-- Roll-up statusa (persistirana za list filtering):
--   PurchaseOrder.invoiceStatus  — none | partial | invoiced | variance
--   AccountsPayable.matchStatus  — unmatched | matched | variance
--   AccountsPayableLine.varianceStatus — match | variance_qty | variance_price |
--     variance_both | unreceived (per-line, živo poročilo računa GET ob branju)
--   PurchaseOrderItem.quantityRejected — kumulirana zavrnjena/odkvana količina
--     (NE vstopi v zalogo; cap-check kanon: accepted + rejected ≤ ordered)
--
-- Aditivna migracija (pariteta 0016/0017): CREATE TABLE + FK-ji + indeksi +
-- 3 stolpca na obstoječih tabelah. BREZ data loss, brez ALTER obstoječih
-- stolpcev, brez backfill (GRN dokumenti se gradijo od zdaj naprej).

CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "supplierDocNumber" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "receivedById" TEXT,
    "receivedByName" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- GRN števec — kanon "GR-YYYY-NNNNNN" (count+1, P2002 → 409 retry, pariteta PO-2)
CREATE UNIQUE INDEX "GoodsReceipt_grnNumber_key" ON "GoodsReceipt"("grnNumber");

-- Vsi prevzemi naročilnice (GET /api/purchase-orders/[id]/receipts)
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- Dobaviteljevi prevzemi
CREATE INDEX "GoodsReceipt_supplierId_idx" ON "GoodsReceipt"("supplierId");

-- Časovnica prevzemov
CREATE INDEX "GoodsReceipt_receivedAt_idx" ON "GoodsReceipt"("receivedAt");

-- Tenant metadata (pariteta PurchaseOrder.locationId) za prihodnji filtering
CREATE INDEX "GoodsReceipt_locationId_idx" ON "GoodsReceipt"("locationId");

CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "inventoryItemId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "quantityAccepted" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantityRejected" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "rejectReason" TEXT NOT NULL DEFAULT '',
    "packQty" DECIMAL(12,3),
    "packUnit" TEXT,
    "unitPriceOrdered" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- Linije prevzemnega dokumenta
CREATE INDEX "GoodsReceiptItem_goodsReceiptId_idx" ON "GoodsReceiptItem"("goodsReceiptId");

-- Three-way match: vsota quantityAccepted per PO postavko (invoice match)
CREATE INDEX "GoodsReceiptItem_purchaseOrderItemId_idx" ON "GoodsReceiptItem"("purchaseOrderItemId");

-- FK lookup — prevzemi per artikel
CREATE INDEX "GoodsReceiptItem_inventoryItemId_idx" ON "GoodsReceiptItem"("inventoryItemId");

CREATE TABLE "AccountsPayableLine" (
    "id" TEXT NOT NULL,
    "accountsPayableId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantityInvoiced" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitPriceInvoiced" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "vatRateInvoiced" DECIMAL(5,2),
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "varianceStatus" TEXT NOT NULL DEFAULT 'match',
    "varianceNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountsPayableLine_pkey" PRIMARY KEY ("id")
);

-- Linije računa (idempotenten re-POST: deleteMany + createMany)
CREATE INDEX "AccountsPayableLine_accountsPayableId_idx" ON "AccountsPayableLine"("accountsPayableId");

-- Three-way match: AP linije per PO postavka
CREATE INDEX "AccountsPayableLine_purchaseOrderItemId_idx" ON "AccountsPayableLine"("purchaseOrderItemId");

-- Naročilnica: Cascade — GRN dokumenti sledijo naročilnici
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dobavitelj: Restrict — brisanje dobavitelja s prevzemi ne sme počistiti forenziko
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Zaposleni: SetNull — izbris zaposlenega ne sme izgubiti prevzemnega dokumenta (snapshot imena ostane)
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lokacija: SetNull — tenant metadata (pariteta PurchaseOrder.locationId)
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- GRN dokument: Cascade — linije sledijo dokumentu
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PO postavka: SetNull — izbris PO postavke ne sme izgubiti GRN linije (snapshot opisa ostane)
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AP: Cascade — linije sledijo obveznosti
ALTER TABLE "AccountsPayableLine" ADD CONSTRAINT "AccountsPayableLine_accountsPayableId_fkey" FOREIGN KEY ("accountsPayableId") REFERENCES "AccountsPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PO postavka: SetNull (relation "APLinePOItem") — izbris PO postavke ne sme izgubiti AP linije
ALTER TABLE "AccountsPayableLine" ADD CONSTRAINT "AccountsPayableLine_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PurchaseOrder += three-way match roll-up (list filtering; 'none' = brez računa)
ALTER TABLE "PurchaseOrder" ADD COLUMN "invoiceStatus" TEXT NOT NULL DEFAULT 'none';

-- PurchaseOrderItem += kumulirana zavrnjena/odkvana količina (NE vstopi v zalogo)
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "quantityRejected" DECIMAL(12,3) NOT NULL DEFAULT 0;

-- AccountsPayable += three-way match roll-up (unmatched | matched | variance)
ALTER TABLE "AccountsPayable" ADD COLUMN "matchStatus" TEXT NOT NULL DEFAULT 'unmatched';
