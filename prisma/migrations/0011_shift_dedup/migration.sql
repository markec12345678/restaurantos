-- 0011_shift_dedup — ISSUE #36 (R125): ukinitev modela Shift, dedup z StaffShift
--
-- Kanon: StaffShift je edini model izmen (bolj bogat: shiftType, role,
-- actualStart/End, confirmedAt, createdBy). Legacy Shift vrstice se preselijo
-- 1:1: date→shiftDate, status absent→no_show (cancelled ostane cancelled),
-- jobId→jobId (nov stolpec na StaffShift — superset parity), role iz imena
-- delovnega mesta (heuristika, privzeto 'server').
--
-- Idempotentno: INSERT samo vrstice, ki po ID (ali naravni ključi
-- employeeId+shiftDate+startTime+endTime) še ne obstajajo v StaffShift.
--
-- TimeEntry je VIR dogodkov prijava/odjava; StaffShift.actualStart/End je
-- izračunano okno izmene (sinhronizacija ob clock-out v time-entries route).

-- 1. Nov stolpec jobId na StaffShift (parity z legacy Shift)
ALTER TABLE "StaffShift" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
CREATE INDEX IF NOT EXISTS "StaffShift_jobId_idx" ON "StaffShift"("jobId");
DO $$ BEGIN
  ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Preselitev vrstic Shift → StaffShift (idempotentno + robustno:
-- sveže baze iz init-pglite/db push tabele Shift sploh nimajo — preskoči)
DO $$
BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='Shift') THEN
INSERT INTO "StaffShift"
  ("id", "employeeId", "shiftDate", "shiftType", "startTime", "endTime",
   "locationId", "role", "notes", "status", "breakMinutes", "jobId",
   "createdAt", "updatedAt")
SELECT
  s."id",
  s."employeeId",
  s."date",
  'custom',
  s."startTime",
  s."endTime",
  s."locationId",
  CASE LOWER(j."name")
    WHEN 'kuhar' THEN 'chef'
    WHEN 'natakar' THEN 'server'
    WHEN 'barman' THEN 'bartender'
    WHEN 'sank' THEN 'bartender'
    WHEN 'vodja' THEN 'manager'
    WHEN 'menedžer' THEN 'manager'
    WHEN 'hostess' THEN 'host'
    WHEN 'pomivalnik' THEN 'dishwasher'
    WHEN 'priprava' THEN 'prep'
    ELSE 'server'
  END,
  s."notes",
  CASE s."status"
    WHEN 'absent' THEN 'no_show'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE s."status"
  END,
  s."breakMinutes",
  s."jobId",
  s."createdAt",
  s."updatedAt"
FROM "Shift" s
LEFT JOIN "Job" j ON j."id" = s."jobId"
WHERE NOT EXISTS (
  SELECT 1 FROM "StaffShift" t
  WHERE t."id" = s."id"
     OR (t."employeeId" = s."employeeId"
         AND t."shiftDate" = s."date"
         AND t."startTime" = s."startTime"
         AND t."endTime" = s."endTime")
);
END IF;
END $$;

-- 3. Ukinitev tabele Shift (model odstranjen iz prisma/schema.prisma)
DROP TABLE IF EXISTS "Shift";
