-- 0015_reorder_center — R129 (epic #115 P1-07): Reorder center + forecasting
--
-- Kanon P1-07: "Za sestavino pokaži, kjer podatki obstajajo: current stock,
-- reserved stock, available stock, minimum, reorder point, average daily
-- usage, recent usage, lead time, safety stock, pending purchase orders,
-- expected delivery, supplier, supplier price. Predlog naročila mora biti
-- razložljiv. Če podatkov ni dovolj, sistem ne sme izmišljati napovedi."
--
-- Trije eksplicitni per-item parametri (nullable — ko manjkajo, kanon izpelje
-- iz ReorderRule/dobavnih intervalov oz. pokaže 'insufficient-data' brez
-- izmišljevanja). Aditivno, brez data loss, brez backfill (NULL = uporabi
-- izpeljavo).

ALTER TABLE "InventoryItem" ADD COLUMN "reorderPoint" DECIMAL(12,3);

ALTER TABLE "InventoryItem" ADD COLUMN "safetyStock" DECIMAL(12,3);

ALTER TABLE "InventoryItem" ADD COLUMN "leadTimeDays" INTEGER;
