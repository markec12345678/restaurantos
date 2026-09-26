-- 0020_delivery_driver — R137-b (epic #115 P1-13): delivery/driver workflow
--
-- Kanon P1-13: "voznik = prijavljeni zaposleni (self-claim)" — dodelitev
-- dostave brez prostege besedila: voznikova PIN seja (Session.employeeId) je
-- vir identitete, driverName je snapshot imena iz Employee. dispatcher lahko
-- še vedno dodeli prosto besedilo (legacy pot ostane), ampak driverEmployeeId
-- omogoča "moja dostavna opravila" (GET /api/delivery/assignments) brez
-- ugibanja po imenu.
--
--   DeliveryTracking.driverEmployeeId — FK Employee (SetNull: izbris
--     zaposlenega ne sme izgubiti dostavne forenzike — driverName snapshot
--     ostane; pariteta OrderItem.readyById 0019)
--   DeliveryTracking.podNotes — proof-of-delivery opomba voznika ob
--     'delivered' (customerFeedback ostane ocena GOSTA)
--
-- Aditivna migracija (pariteta 0016/0017/0018/0019): 2 stolpca + indeks + FK.
-- BREZ data loss, brez ALTER obstoječih stolpcev, brez backfill
-- (legacy vrstice ostanejo NULL = free-text dodelitev).

-- DeliveryTracking += voznikova identiteta + POD opomba
ALTER TABLE "DeliveryTracking" ADD COLUMN "driverEmployeeId" TEXT,
  ADD COLUMN "podNotes" TEXT;

-- R137-b: "moja dostavna opravila" po vozniku (GET /api/delivery/assignments)
CREATE INDEX "DeliveryTracking_driverEmployeeId_idx" ON "DeliveryTracking"("driverEmployeeId");

-- Zaposleni: SetNull — izbris zaposlenega ne sme izgubiti dostavne forenzike (driverName snapshot ostane)
ALTER TABLE "DeliveryTracking" ADD CONSTRAINT "DeliveryTracking_driverEmployeeId_fkey" FOREIGN KEY ("driverEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
