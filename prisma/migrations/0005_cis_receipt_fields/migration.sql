-- 0005_cis_receipt_fields — CIS (Hrvaška) fiskalizacija na Receipt (runda 29)
--
-- Produkcijska vezava CIS oddaje na plačilni tok: Receipt dobi ZKI/JIR polja
-- vzporedno s FURS ZOI/EOR. Multi-državni račun nosi oba fiskalna kompleta
-- (SI gost → FURS ZOI/EOR, HR gost → FINA ZKI/JIR — isti Receipt row).
--
-- Migracija je čisto ADDITIVNA (4 stolpci + 1 indeks, vse z default) —
-- non-breaking: obstoječe vrstice dobijo cisStatus='none' (nikoli poskuseno)
-- in prazna ZKI/JIR polja. Zahteva prisma generate (nova polja v clientu).

-- ── 1. Stolpci ──
ALTER TABLE "Receipt" ADD COLUMN "cisStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Receipt" ADD COLUMN "cisZki" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Receipt" ADD COLUMN "cisJir" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Receipt" ADD COLUMN "cisSubmittedAt" TIMESTAMP(3);

-- ── 2. Indeks za batch retry (cisStatus='pending' — oddaja FINA ni uspela) ──
CREATE INDEX "Receipt_cisStatus_idx" ON "Receipt"("cisStatus");
