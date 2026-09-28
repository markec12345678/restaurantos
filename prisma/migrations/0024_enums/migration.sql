-- 0024_enums — R156-b (repo issue #41: "0 enums used — 20+ status/type polj je
-- prosti String" → 20 native Prisma enumov)
--
-- VSEBINA:
--   (1) 20 CREATE TYPE ... AS ENUM (vsak zaščiten s pg_type guardom —
--       idempotentno; člani in vrstni red = deklaracija v schema.prisma,
--       ker migrate diff --from-empty generira tip v deklaracijskem redu).
--   (2) 22 ALTER COLUMN ... TYPE "Enum" USING "col"::"Enum"
--       (Order.paymentStatus + Check.paymentStatus → PaymentStatus;
--        JournalLine.accountType + ChartOfAccount.accountType → AccountType;
--        ostalih 18 stolpcev 1:1 svoj enum).
--   (3) 18 SET DEFAULT 'v'::"Enum" — samo stolpci s @default v schema.prisma
--       (Payment.type, HaccpEntry.category, ChartOfAccount.accountType,
--        JournalLine.accountType so brez defaulta).
--
-- ⚠️ HASH-CHAIN KONTRAKT (HaccpEntry.status): src/lib/haccp-chain.ts hashira
-- title + value + status + date (EU 852/2004 veriga zanesljivosti). Pretvorba
-- TEXT → ENUM OHRANI bajte ('ok'/'warning'/'critical' se ne spremenijo — cast
-- je brezizguben in determinističen), zato chainHash recompute iz shranjene
-- vrstice ostane identičen. Vrednosti se v tej migraciji NIKOLI ne spreminjajo
-- (sprememba vrednosti = zlom verige — prepovedano R155/R156 kanonom).
--
-- ⚠️ FAIL-CLOSED: PRED vsakim ALTERom je dirty-guard — če stolpec vsebuje
-- vrednost IZVEN enum množice (legacy/stale zapis), migracija abortira z
-- RAISE EXCEPTION (ročni pregled), namesto da bi cast tiho spodletel
-- ("invalid input value") sredi delne spremembe ali (hujše) tiho poslabšal
-- podatke. NULL vrstic guard ne ujame (NULL NOT IN (...) → NULL → ne sproži)
-- — NULL je za enum stolpec vedno veljaven (nullable semantika ni spremenjena;
-- vsi pretvorjeni stolpci so NOT NULL). Guard je read-only.
--
-- IZKLJUČENA POLJA (ostanejo String; app-layer string-literal unije v
-- src/lib/enums/index.ts): Order.status ('in-progress'), Order.type
-- ('dine-in'), StockTransaction.type ('write-off'). RAZLOG: vsebujejo
-- pomlajevalec — Prisma P1012 prepoveduje `-` v Enum vrednostih; @map na
-- vrednosti NE reši (Prisma client TS/JS vrednost postane IME člana
-- 'in_progress', ne DB vrednost 'in-progress' → zlom API wire kontrakta,
-- ki ga 17 testnih fajlov + i18n + webhooks asertirajo); CHECK constraint
-- pa Prisma schema/migrate-diff veriga ne podpira (db push bi javil drift).
-- Zato app-layer unije, brez DB spremembe teh treh stolpcev.
--
-- VRSTNI RED: vsi CREATE TYPE → vsi dirty-guardi → vsi DROP DEFAULT → vsi
-- ALTER TYPE → vsi SET DEFAULT. (Guardi pred ALTERi = vse ali nič: umazana
-- baza ne zaide v delno pretvorjeno stanje. DROP DEFAULT je OBVEZEN:
-- Postgres ne zna samodejno pretvoriti obstoječega TEXT defaulta
-- ('available'::text) v enum ('available'::"TableStatus") — brez DROPa
-- ALTER TYPE javi 'default for column ... cannot be cast automatically'.
-- DROP DEFAULT je idempotenten (no-op če defaulta ni).)
--
-- IDEMPOTENTNOST: CREATE TYPE ima pg_type NOT EXISTS guard (DO $$); dirty-
-- guardi so read-only in na že pretvorjeni bazi ne sprožijo (vrednosti so
-- zdaj člani); ALTER ... TYPE z USING "col"::"Enum" je idempotenten (enum →
-- isti enum cast je identiteta); SET DEFAULT je idempotenten. Ponovni zagon
-- = no-op brez napak in brez duplikatov.

-- ─────────────────────────────────────────────────────────────────
-- (1) CREATE TYPE — 20 enumov (pg_type guard za idempotentnost)
--     Vrstni red članov = deklaracija v schema.prisma (byte-identično z
--     migrate diff --from-empty izhodom).
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderItemStatus') THEN
  CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'fired', 'preparing', 'ready', 'served', 'cancelled', 'voided');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
  CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'storno', 'cancelled');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentType') THEN
  CREATE TYPE "PaymentType" AS ENUM ('cash', 'card', 'mobile', 'voucher', 'loyalty', 'giftcard', 'alternate');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmployeeRole') THEN
  CREATE TYPE "EmployeeRole" AS ENUM ('admin', 'manager', 'staff', 'chef', 'kitchen');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmployeeStatus') THEN
  CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'inactive', 'terminated', 'anonymized');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TableStatus') THEN
  CREATE TYPE "TableStatus" AS ENUM ('available', 'occupied', 'reserved', 'cleaning');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FiscalStatus') THEN
  CREATE TYPE "FiscalStatus" AS ENUM ('none', 'pending', 'processing', 'verifying', 'verified', 'failed');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderStatus') THEN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM ('draft', 'submitted', 'approved', 'partial', 'received', 'cancelled');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderItemStatus') THEN
  CREATE TYPE "PurchaseOrderItemStatus" AS ENUM ('pending', 'partial', 'received', 'cancelled');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JournalEntryStatus') THEN
  CREATE TYPE "JournalEntryStatus" AS ENUM ('draft', 'posted', 'reversed');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
  CREATE TYPE "AccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense', 'unknown');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HaccpCategory') THEN
  CREATE TYPE "HaccpCategory" AS ENUM ('temperature', 'cleaning', 'delivery', 'cooling', 'training');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'HaccpStatus') THEN
  CREATE TYPE "HaccpStatus" AS ENUM ('ok', 'warning', 'critical', 'archived');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionPlan') THEN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'professional', 'enterprise');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffShiftStatus') THEN
  CREATE TYPE "StaffShiftStatus" AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'absent', 'cancelled', 'no_show');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimeEntryType') THEN
  CREATE TYPE "TimeEntryType" AS ENUM ('regular', 'overtime', 'holiday', 'sick', 'vacation');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimeEntryStatus') THEN
  CREATE TYPE "TimeEntryStatus" AS ENUM ('active', 'approved', 'disputed');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationStatus') THEN
  CREATE TYPE "ReservationStatus" AS ENUM ('confirmed', 'seated', 'completed', 'cancelled', 'no_show');
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationSource') THEN
  CREATE TYPE "ReservationSource" AS ENUM ('walk_in', 'phone', 'website', 'app');
END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────
-- (2) DIRTY-VALUE GUARDI (fail-closed) — vrednosti izven enum množice
--     abortirajo migracijo PRED prvim ALTERom (vse ali nič).
--     NULL-safe: NULL vrstice ne ustrezajo NOT IN pogojema.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
IF EXISTS (SELECT 1 FROM "Table" WHERE "status"::text NOT IN ('available', 'occupied', 'reserved', 'cleaning')) THEN
  RAISE EXCEPTION '0024: Table.status vsebuje vrednosti izven enuma TableStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Order" WHERE "paymentStatus"::text NOT IN ('unpaid', 'partial', 'paid', 'storno', 'cancelled')) THEN
  RAISE EXCEPTION '0024: Order.paymentStatus vsebuje vrednosti izven enuma PaymentStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Check" WHERE "paymentStatus"::text NOT IN ('unpaid', 'partial', 'paid', 'storno', 'cancelled')) THEN
  RAISE EXCEPTION '0024: Check.paymentStatus vsebuje vrednosti izven enuma PaymentStatus';
END IF;
IF EXISTS (SELECT 1 FROM "OrderItem" WHERE "status"::text NOT IN ('pending', 'fired', 'preparing', 'ready', 'served', 'cancelled', 'voided')) THEN
  RAISE EXCEPTION '0024: OrderItem.status vsebuje vrednosti izven enuma OrderItemStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Payment" WHERE "type"::text NOT IN ('cash', 'card', 'mobile', 'voucher', 'loyalty', 'giftcard', 'alternate')) THEN
  RAISE EXCEPTION '0024: Payment.type vsebuje vrednosti izven enuma PaymentType';
END IF;
-- Employee.role: 'chef' (demo seed) in 'kitchen' (zod employees.ts) sta OBA
-- člana po ground truth (R156-a audit) — nobenega ne "popravljam" ven.
IF EXISTS (SELECT 1 FROM "Employee" WHERE "role"::text NOT IN ('admin', 'manager', 'staff', 'chef', 'kitchen')) THEN
  RAISE EXCEPTION '0024: Employee.role vsebuje vrednosti izven enuma EmployeeRole';
END IF;
IF EXISTS (SELECT 1 FROM "Employee" WHERE "status"::text NOT IN ('active', 'inactive', 'terminated', 'anonymized')) THEN
  RAISE EXCEPTION '0024: Employee.status vsebuje vrednosti izven enuma EmployeeStatus';
END IF;
IF EXISTS (SELECT 1 FROM "TimeEntry" WHERE "type"::text NOT IN ('regular', 'overtime', 'holiday', 'sick', 'vacation')) THEN
  RAISE EXCEPTION '0024: TimeEntry.type vsebuje vrednosti izven enuma TimeEntryType';
END IF;
IF EXISTS (SELECT 1 FROM "TimeEntry" WHERE "status"::text NOT IN ('active', 'approved', 'disputed')) THEN
  RAISE EXCEPTION '0024: TimeEntry.status vsebuje vrednosti izven enuma TimeEntryStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Receipt" WHERE "fiscalStatus"::text NOT IN ('none', 'pending', 'processing', 'verifying', 'verified', 'failed')) THEN
  RAISE EXCEPTION '0024: Receipt.fiscalStatus vsebuje vrednosti izven enuma FiscalStatus';
END IF;
IF EXISTS (SELECT 1 FROM "HaccpEntry" WHERE "category"::text NOT IN ('temperature', 'cleaning', 'delivery', 'cooling', 'training')) THEN
  RAISE EXCEPTION '0024: HaccpEntry.category vsebuje vrednosti izven enuma HaccpCategory';
END IF;
-- HaccpEntry.status je v HASH PAYLOADU (haccp-chain.ts) — vrednosti morajo
-- ostati byte-identične; ta guard zagotavlja, da cast ne bo ničesar spremenil.
IF EXISTS (SELECT 1 FROM "HaccpEntry" WHERE "status"::text NOT IN ('ok', 'warning', 'critical', 'archived')) THEN
  RAISE EXCEPTION '0024: HaccpEntry.status vsebuje vrednosti izven enuma HaccpStatus';
END IF;
-- StaffShift.status: 7 članov = zod write domen (staff-shifts/_helpers.ts:15);
-- 'confirmed' piše [id]/route.ts:65, 'cancelled' piše legacy DELETE (shifts/[id]).
IF EXISTS (SELECT 1 FROM "StaffShift" WHERE "status"::text NOT IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'absent', 'cancelled', 'no_show')) THEN
  RAISE EXCEPTION '0024: StaffShift.status vsebuje vrednosti izven enuma StaffShiftStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Reservation" WHERE "status"::text NOT IN ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')) THEN
  RAISE EXCEPTION '0024: Reservation.status vsebuje vrednosti izven enuma ReservationStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Reservation" WHERE "source"::text NOT IN ('walk_in', 'phone', 'website', 'app')) THEN
  RAISE EXCEPTION '0024: Reservation.source vsebuje vrednosti izven enuma ReservationSource';
END IF;
IF EXISTS (SELECT 1 FROM "PurchaseOrder" WHERE "status"::text NOT IN ('draft', 'submitted', 'approved', 'partial', 'received', 'cancelled')) THEN
  RAISE EXCEPTION '0024: PurchaseOrder.status vsebuje vrednosti izven enuma PurchaseOrderStatus';
END IF;
IF EXISTS (SELECT 1 FROM "PurchaseOrderItem" WHERE "status"::text NOT IN ('pending', 'partial', 'received', 'cancelled')) THEN
  RAISE EXCEPTION '0024: PurchaseOrderItem.status vsebuje vrednosti izven enuma PurchaseOrderItemStatus';
END IF;
IF EXISTS (SELECT 1 FROM "Subscription" WHERE "plan"::text NOT IN ('starter', 'professional', 'enterprise')) THEN
  RAISE EXCEPTION '0024: Subscription.plan vsebuje vrednosti izven enuma SubscriptionPlan';
END IF;
IF EXISTS (SELECT 1 FROM "Subscription" WHERE "status"::text NOT IN ('trial', 'active', 'past_due', 'cancelled', 'expired')) THEN
  RAISE EXCEPTION '0024: Subscription.status vsebuje vrednosti izven enuma SubscriptionStatus';
END IF;
IF EXISTS (SELECT 1 FROM "JournalEntry" WHERE "status"::text NOT IN ('draft', 'posted', 'reversed')) THEN
  RAISE EXCEPTION '0024: JournalEntry.status vsebuje vrednosti izven enuma JournalEntryStatus';
END IF;
IF EXISTS (SELECT 1 FROM "ChartOfAccount" WHERE "accountType"::text NOT IN ('asset', 'liability', 'equity', 'revenue', 'expense')) THEN
  RAISE EXCEPTION '0024: ChartOfAccount.accountType vsebuje vrednosti izven enuma AccountType';
END IF;
-- JournalLine: 'unknown' je LEGACY fallback (resolveAccountCode isValid=false)
-- in se dejansko piše v DB — guard ga tolerate; ChartOfAccount ostane strict.
IF EXISTS (SELECT 1 FROM "JournalLine" WHERE "accountType"::text NOT IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'unknown')) THEN
  RAISE EXCEPTION '0024: JournalLine.accountType vsebuje vrednosti izven enuma AccountType';
END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────
-- (2b) DROP DEFAULT — 18 stolpcev s starim TEXT defaultom. Brez tega
--      ALTER TYPE ne more pretvoriti defaulta (PG 'cannot be cast
--      automatically to type'). Novi enum default pride v koraku (4).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "Table" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Check" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "OrderItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Employee" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TimeEntry" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "TimeEntry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Receipt" ALTER COLUMN "fiscalStatus" DROP DEFAULT;
ALTER TABLE "HaccpEntry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StaffShift" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "JournalEntry" ALTER COLUMN "status" DROP DEFAULT;

-- ─────────────────────────────────────────────────────────────────
-- (3) ALTER COLUMN ... TYPE — 22 stolpcev (TEXT → ENUM)
--     Noben ALTER NE sme obstati za Order.status, Order.type,
--     StockTransaction.type (dash vrednosti — glej izključitve v headerju).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "Table" ALTER COLUMN "status" TYPE "TableStatus" USING "status"::"TableStatus";
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus" USING "paymentStatus"::"PaymentStatus";
ALTER TABLE "Check" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus" USING "paymentStatus"::"PaymentStatus";
ALTER TABLE "OrderItem" ALTER COLUMN "status" TYPE "OrderItemStatus" USING "status"::"OrderItemStatus";
ALTER TABLE "Payment" ALTER COLUMN "type" TYPE "PaymentType" USING "type"::"PaymentType";
ALTER TABLE "Employee" ALTER COLUMN "role" TYPE "EmployeeRole" USING "role"::"EmployeeRole";
ALTER TABLE "Employee" ALTER COLUMN "status" TYPE "EmployeeStatus" USING "status"::"EmployeeStatus";
ALTER TABLE "TimeEntry" ALTER COLUMN "type" TYPE "TimeEntryType" USING "type"::"TimeEntryType";
ALTER TABLE "TimeEntry" ALTER COLUMN "status" TYPE "TimeEntryStatus" USING "status"::"TimeEntryStatus";
ALTER TABLE "Receipt" ALTER COLUMN "fiscalStatus" TYPE "FiscalStatus" USING "fiscalStatus"::"FiscalStatus";
ALTER TABLE "HaccpEntry" ALTER COLUMN "category" TYPE "HaccpCategory" USING "category"::"HaccpCategory";
ALTER TABLE "HaccpEntry" ALTER COLUMN "status" TYPE "HaccpStatus" USING "status"::"HaccpStatus";
ALTER TABLE "StaffShift" ALTER COLUMN "status" TYPE "StaffShiftStatus" USING "status"::"StaffShiftStatus";
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE "ReservationStatus" USING "status"::"ReservationStatus";
ALTER TABLE "Reservation" ALTER COLUMN "source" TYPE "ReservationSource" USING "source"::"ReservationSource";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" TYPE "PurchaseOrderStatus" USING "status"::"PurchaseOrderStatus";
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "status" TYPE "PurchaseOrderItemStatus" USING "status"::"PurchaseOrderItemStatus";
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan" USING "plan"::"SubscriptionPlan";
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus" USING "status"::"SubscriptionStatus";
ALTER TABLE "JournalEntry" ALTER COLUMN "status" TYPE "JournalEntryStatus" USING "status"::"JournalEntryStatus";
ALTER TABLE "ChartOfAccount" ALTER COLUMN "accountType" TYPE "AccountType" USING "accountType"::"AccountType";
ALTER TABLE "JournalLine" ALTER COLUMN "accountType" TYPE "AccountType" USING "accountType"::"AccountType";

-- ─────────────────────────────────────────────────────────────────
-- (4) SET DEFAULT — samo stolpci s @default v schema.prisma (18).
--     Format 'v'::"Enum" = byte-identičen Prisma migrate diff izhodu
--     (CI Test 2 drift check). Payment.type, HaccpEntry.category,
--     ChartOfAccount.accountType in JournalLine.accountType nimajo defaulta.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "Table" ALTER COLUMN "status" SET DEFAULT 'available'::"TableStatus";
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'unpaid'::"PaymentStatus";
ALTER TABLE "Check" ALTER COLUMN "paymentStatus" SET DEFAULT 'unpaid'::"PaymentStatus";
ALTER TABLE "OrderItem" ALTER COLUMN "status" SET DEFAULT 'pending'::"OrderItemStatus";
ALTER TABLE "Employee" ALTER COLUMN "role" SET DEFAULT 'staff'::"EmployeeRole";
ALTER TABLE "Employee" ALTER COLUMN "status" SET DEFAULT 'active'::"EmployeeStatus";
ALTER TABLE "TimeEntry" ALTER COLUMN "type" SET DEFAULT 'regular'::"TimeEntryType";
ALTER TABLE "TimeEntry" ALTER COLUMN "status" SET DEFAULT 'active'::"TimeEntryStatus";
ALTER TABLE "Receipt" ALTER COLUMN "fiscalStatus" SET DEFAULT 'none'::"FiscalStatus";
ALTER TABLE "HaccpEntry" ALTER COLUMN "status" SET DEFAULT 'ok'::"HaccpStatus";
ALTER TABLE "StaffShift" ALTER COLUMN "status" SET DEFAULT 'scheduled'::"StaffShiftStatus";
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'confirmed'::"ReservationStatus";
ALTER TABLE "Reservation" ALTER COLUMN "source" SET DEFAULT 'walk_in'::"ReservationSource";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" SET DEFAULT 'draft'::"PurchaseOrderStatus";
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "status" SET DEFAULT 'pending'::"PurchaseOrderItemStatus";
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'starter'::"SubscriptionPlan";
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'trial'::"SubscriptionStatus";
ALTER TABLE "JournalEntry" ALTER COLUMN "status" SET DEFAULT 'posted'::"JournalEntryStatus";
