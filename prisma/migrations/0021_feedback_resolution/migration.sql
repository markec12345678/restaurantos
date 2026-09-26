-- 0021_feedback_resolution — R140-b (epic #115 P1-14): customer feedback loop — resolution
--
-- Kanon P1-14: mnenje gosta dobi ŽIVLJENJSKI CIKLUS (staff pregled → obdelava →
-- rešeno) + kontekst mize/naročila, ki ga javna pot danes sprejme a IZGUBI:
--   GuestFeedback.status          — 'new' | 'in_review' | 'resolved'
--                                   (CAS prehodi new→in_review, new→resolved,
--                                   in_review→resolved; nazaj = 409, PATCH ruta)
--   GuestFeedback.resolvedById    — LOOSE ref Employee (BREZ FK — pariteta
--                                   guestId/orderId v TEM modelu; model je
--                                   loose-ref stil, audit R140-a potrdil)
--   GuestFeedback.resolvedByName  — SNAPSHOT imena (izbris zaposlenega ne sme
--                                   izgubiti forenzike — pariteta
--                                   DeliveryTracking.driverName / OrderItem.readyByName 0019)
--   GuestFeedback.resolvedAt      — kdaj je bilo rešeno
--   GuestFeedback.tableId         — LOOSE ref Table (javni POST jo pošlje, prej jo je izgubil)
--   GuestFeedback.tableNumber     — SNAPSHOT št. mize (display resiliency —
--                                   mize se lahko brišejo)
--   GuestFeedback.orderRef        — SNAPSHOT Order.orderNumber (NIKOLI FK;
--                                   zero-oracle: shrani SAMO če order obstaja
--                                   na ISTI lokaciji, sicer tiho null)
--
-- Aditivna migracija (pariteta 0016/0017/0018/0019/0020): 7 stolpcev + indeks.
-- BREZ data loss, brez ALTER obstoječih stolpcev, brez backfill
-- (legacy vrstice: status 'new' prek column default, kontekst NULL).

ALTER TABLE "GuestFeedback" ADD COLUMN "tableId" TEXT,
  ADD COLUMN "tableNumber" TEXT,
  ADD COLUMN "orderRef" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN "resolvedById" TEXT,
  ADD COLUMN "resolvedByName" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- P1-14: staff pregled filtrira po statusu (new/in_review/resolved) —
-- enostolpčni indeks po hišnem vzorcu obstoječih 7 indeksov na GuestFeedback
CREATE INDEX "GuestFeedback_status_idx" ON "GuestFeedback"("status");
