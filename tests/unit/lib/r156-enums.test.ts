// ============================================
// R156-b / REPO ISSUE #41 — WIRING-CHECK (readFileSync + runtime kanon)
// ============================================
// Testira OŽIČENJE (wiring) + Prisma runtime vrednosti:
//   A) prisma/schema.prisma: 20 nativnih enumov z NATANZNIMI člani
//      (ground truth = zod write domene + dejanska write mesta; seznami v
//      issueju #41 so zastareli), pretvorjena polja, 3 DASH polja ostanejo
//      String (Prisma P1012 prepoveduje '-' v enum vrednostih; @map bi zlomil
//      API wire kontrakt).
//   B) migracija 0024_enums: 20 CREATE TYPE (pg_type guardi), 22 dirty-guardov
//      (fail-closed RAISE EXCEPTION), 22 ALTER TYPE, 18 SET DEFAULT,
//      hash-chain header (HaccpStatus byte-identičen), NI ALTER za dash stolpce.
//   C) src/lib/enums: ground-truth seznami + re-export nativnih enumov +
//      dash string-literal unije.
//   D) zod orders: updateOrderSchema.status filter vsebuje 'served'.
//   E) wire-compat: Prisma runtime enum vrednosti = ground truth seznami
//      (enum se serializira kot navaden string — API podoba nespremenjena).
//   F) seeds: demo-data + e2e-seed vrednosti v enum domeni ('chef' je član!).
//
// Vzorec: r155-employee-fk-migration.test.ts (readFileSync kanon).
// Zagon: bunx vitest run tests/unit/lib/r156-enums.test.ts
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')

const SCHEMA = 'prisma/schema.prisma'
const MIGRATION = 'prisma/migrations/0024_enums/migration.sql'

// Ground truth (R156-a audit + popravki med R156-b implementacijo):
//  - PurchaseOrderStatus: R129 state machine (zod [id]/_helpers.ts:71) —
//    'sent'/'confirmed' iz zastarelega komentarja NE OBSTAJATA.
//  - FiscalStatus: +processing/+verifying (živa transient stanja — furs batch/verify claim).
//  - EmployeeStatus: +anonymized (GDPR anonymize route).
//  - HaccpStatus: +archived (DELETE archive akcija; hash-chain byte-identičen).
//  - AccountType: +unknown (resolveAccountCode legacy fallback — piše se v DB).
//  - PaymentStatus: +cancelled (table-merge void piše paymentStatus 'cancelled').
//  - StaffShiftStatus: 7 članov = zod write domen (staff-shifts/_helpers.ts:15);
//    'confirmed' piše [id]/route.ts:65, 'cancelled' legacy DELETE (shifts/[id]).
const EXPECTED_ENUMS: Record<string, string[]> = {
  OrderItemStatus: ['pending', 'fired', 'preparing', 'ready', 'served', 'cancelled', 'voided'],
  PaymentStatus: ['unpaid', 'partial', 'paid', 'storno', 'cancelled'],
  PaymentType: ['cash', 'card', 'mobile', 'voucher', 'loyalty', 'giftcard', 'alternate'],
  EmployeeRole: ['admin', 'manager', 'staff', 'chef', 'kitchen'],
  EmployeeStatus: ['active', 'inactive', 'terminated', 'anonymized'],
  TableStatus: ['available', 'occupied', 'reserved', 'cleaning'],
  FiscalStatus: ['none', 'pending', 'processing', 'verifying', 'verified', 'failed'],
  PurchaseOrderStatus: ['draft', 'submitted', 'approved', 'partial', 'received', 'cancelled'],
  PurchaseOrderItemStatus: ['pending', 'partial', 'received', 'cancelled'],
  JournalEntryStatus: ['draft', 'posted', 'reversed'],
  AccountType: ['asset', 'liability', 'equity', 'revenue', 'expense', 'unknown'],
  HaccpCategory: ['temperature', 'cleaning', 'delivery', 'cooling', 'training'],
  HaccpStatus: ['ok', 'warning', 'critical', 'archived'],
  SubscriptionPlan: ['starter', 'professional', 'enterprise'],
  SubscriptionStatus: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
  StaffShiftStatus: ['scheduled', 'confirmed', 'in_progress', 'completed', 'absent', 'cancelled', 'no_show'],
  TimeEntryType: ['regular', 'overtime', 'holiday', 'sick', 'vacation'],
  TimeEntryStatus: ['active', 'approved', 'disputed'],
  ReservationStatus: ['confirmed', 'seated', 'completed', 'cancelled', 'no_show'],
  ReservationSource: ['walk_in', 'phone', 'website', 'app'],
}

describe('R156/#41 — schema.prisma: 20 nativnih enumov (wiring)', () => {
  const schema = SRC(SCHEMA)

  it('vsebuje TOČNO 20 enum deklaracij z expected imeni', () => {
    const names = [...schema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1])
    expect(names).toHaveLength(20)
    expect(names.sort()).toEqual(Object.keys(EXPECTED_ENUMS).sort())
  })

  it('vsak enum ima TOČNO expected člane v expected vrstnem redu', () => {
    for (const [name, members] of Object.entries(EXPECTED_ENUMS)) {
      const block = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`))
      expect(block, `enum ${name} manjka`).not.toBeNull()
      const actual = [...block![1].matchAll(/^\s+(\w+)\s*$/gm)].map((m) => m[1])
      expect(actual, `enum ${name} člani`).toEqual(members)
    }
  })

  it('pretvorjena polja nosijo enum tipe (spot-check ×6)', () => {
    expect(schema).toMatch(/status\s+TableStatus @default\(available\)/)
    expect(schema).toMatch(/paymentStatus\s+PaymentStatus @default\(unpaid\)/)
    expect(schema).toMatch(/role\s+EmployeeRole @default\(staff\)/)
    expect(schema).toMatch(/fiscalStatus\s+FiscalStatus @default\(none\)/)
    expect(schema).toMatch(/status\s+PurchaseOrderStatus @default\(draft\)/)
    expect(schema).toMatch(/accountType\s+AccountType/)
  })

  it('DASH polja ostanejo String (Order.status, Order.type, StockTransaction.type)', () => {
    expect(schema).not.toContain('enum OrderStatus')
    expect(schema).not.toContain('enum OrderType {')
    expect(schema).not.toContain('enum StockTransactionType')
    // Order.type še vedno String z dash defaultom:
    expect(schema).toContain('type            String     @default("dine-in")')
    // StockTransaction.type še vedno String (dash 'write-off' v komentarju):
    expect(schema).toContain('type            String        // "procurement", "sale", "write-off", "adjustment", "return"')
  })
})

describe('R156/#41 — migracija 0024_enums (wiring)', () => {
  const sql = SRC(MIGRATION)

  it('header: hash-chain kontrakt + fail-closed + idempotentnost + P1012 izključitve', () => {
    const header = sql.slice(0, 3400).replace(/^--[ \t]?/gm, '').replace(/\s+/g, ' ')
    expect(header).toContain('0024_enums — R156-b')
    expect(header).toContain('issue #41')
    expect(header).toContain('HASH-CHAIN KONTRAKT')
    expect(header).toContain('FAIL-CLOSED')
    expect(header).toContain('IDEMPOTENTNOST')
    expect(header).toContain('P1012')
  })

  it('20 CREATE TYPE s pg_type idempotency guardi, člani = ground truth', () => {
    const creates = [...sql.matchAll(/CREATE TYPE "(\w+)" AS ENUM \(([^)]*)\);/g)]
    expect(creates).toHaveLength(20)
    for (const [, name, membersRaw] of creates) {
      const members = [...membersRaw.matchAll(/'([^']+)'/g)].map((m) => m[1])
      expect(members, `CREATE TYPE ${name}`).toEqual(EXPECTED_ENUMS[name])
    }
    expect(sql.match(/IF NOT EXISTS \(SELECT 1 FROM pg_type WHERE typname =/g)).toHaveLength(20)
  })

  it('22 dirty-guardov (fail-closed RAISE EXCEPTION pred ALTERi)', () => {
    const guards = [...sql.matchAll(/RAISE EXCEPTION '0024: ([\w.]+) vsebuje/g)].map((m) => m[1])
    expect(guards).toHaveLength(22)
    expect(guards).toContain('Employee.role')
    expect(guards).toContain('HaccpEntry.status')
    expect(guards).toContain('Order.paymentStatus')
    // vsi RAISE EXCEPTION pred prvim ALTER TYPE (vse ali nič):
    const firstRaise = sql.indexOf('RAISE EXCEPTION')
    const firstAlter = sql.indexOf('ALTER TABLE')
    expect(firstRaise).toBeGreaterThan(-1)
    expect(firstAlter).toBeGreaterThan(-1)
    expect(firstRaise).toBeLessThan(firstAlter)
  })

  it('22 ALTER TYPE + 18 DROP DEFAULT + 18 SET DEFAULT; pravilen vrstni red; NI ALTER za dash stolpce', () => {
    expect(sql.match(/ALTER TABLE "[\w]+" ALTER COLUMN "[\w]+" TYPE "/g)).toHaveLength(22)
    expect(sql.match(/ALTER TABLE "[\w]+" ALTER COLUMN "[\w]+" DROP DEFAULT;/g)).toHaveLength(18)
    expect(sql.match(/ALTER TABLE "[\w]+" ALTER COLUMN "[\w]+" SET DEFAULT '/g)).toHaveLength(18)
    // Vrstni red: dirty-guard (RAISE) → DROP DEFAULT → ALTER TYPE → SET DEFAULT
    // (DROP pred ALTER je OBVEZEN: PG ne zna samodejno pretvoriti TEXT defaulta
    // v enum — 'cannot be cast automatically', empirično potrjeno na dev bazi).
    const iRaise = sql.indexOf('RAISE EXCEPTION')
    const iDrop = sql.indexOf('DROP DEFAULT;')
    const iAlter = sql.indexOf('ALTER TABLE "Table" ALTER COLUMN "status" TYPE')
    const iSet = sql.indexOf("SET DEFAULT 'available'")
    expect(iRaise).toBeGreaterThan(-1)
    expect(iDrop).toBeGreaterThan(iRaise)
    expect(iAlter).toBeGreaterThan(iDrop)
    expect(iSet).toBeGreaterThan(iAlter)
    // dash stolpci se NIKOLI ne pretvorijo:
    expect(sql).not.toContain('ALTER TABLE "Order" ALTER COLUMN "status"')
    expect(sql).not.toContain('ALTER TABLE "Order" ALTER COLUMN "type"')
    expect(sql).not.toContain('ALTER TABLE "StockTransaction"')
  })

  it('dual-model enumi: PaymentStatus (Order+Check) in AccountType (JournalLine+ChartOfAccount)', () => {
    expect(sql).toContain('ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus"')
    expect(sql).toContain('ALTER TABLE "Check" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus"')
    expect(sql).toContain('ALTER TABLE "JournalLine" ALTER COLUMN "accountType" TYPE "AccountType"')
    expect(sql).toContain('ALTER TABLE "ChartOfAccount" ALTER COLUMN "accountType" TYPE "AccountType"')
  })
})

describe('R156/#41 — src/lib/enums (ground truth + re-export + dash unije)', () => {
  it('nativni re-exporti so deep-equal Prisma runtime vrednostim (wire-compat)', async () => {
    const { PaymentStatus, EmployeeRole, FiscalStatus, PurchaseOrderStatus, StaffShiftStatus, AccountType, HaccpStatus } =
      await import('@prisma/client')
    expect(Object.values(PaymentStatus)).toEqual(EXPECTED_ENUMS.PaymentStatus)
    expect(Object.values(EmployeeRole)).toEqual(EXPECTED_ENUMS.EmployeeRole)
    expect(Object.values(FiscalStatus)).toEqual(EXPECTED_ENUMS.FiscalStatus)
    expect(Object.values(PurchaseOrderStatus)).toEqual(EXPECTED_ENUMS.PurchaseOrderStatus)
    expect(Object.values(StaffShiftStatus)).toEqual(EXPECTED_ENUMS.StaffShiftStatus)
    expect(Object.values(AccountType)).toEqual(EXPECTED_ENUMS.AccountType)
    expect(Object.values(HaccpStatus)).toEqual(EXPECTED_ENUMS.HaccpStatus)
  })

  it('dash unije: ORDER_STATUSES / ORDER_TYPES / STOCK_TRANSACTION_TYPES ground truth', async () => {
    const lib = await import('@/lib/enums')
    expect([...lib.ORDER_STATUSES]).toEqual(['pending', 'in-progress', 'ready', 'completed', 'cancelled', 'served'])
    expect([...lib.ORDER_TYPES]).toEqual(['dine-in', 'takeout', 'delivery'])
    expect([...lib.STOCK_TRANSACTION_TYPES]).toEqual(['procurement', 'sale', 'write-off', 'adjustment', 'return'])
  })

  it('const objects vezani na Prisma člane (ni ročnega zdrsa): PAYMENT_STATUS + STAFF_SHIFT_STATUS', async () => {
    const { PaymentStatus, StaffShiftStatus } = await import('@prisma/client')
    const lib = await import('@/lib/enums')
    expect(lib.PAYMENT_STATUS).toEqual({
      UNPAID: PaymentStatus.unpaid,
      PARTIAL: PaymentStatus.partial,
      PAID: PaymentStatus.paid,
      STORNO: PaymentStatus.storno,
    })
    expect(lib.STAFF_SHIFT_STATUS).toEqual({
      SCHEDULED: StaffShiftStatus.scheduled,
      CONFIRMED: StaffShiftStatus.confirmed,
      IN_PROGRESS: StaffShiftStatus.in_progress,
      COMPLETED: StaffShiftStatus.completed,
      ABSENT: StaffShiftStatus.absent,
      CANCELLED: StaffShiftStatus.cancelled,
      NO_SHOW: StaffShiftStatus.no_show,
    })
  })
})

describe('R156/#41 — backup/restore round-trip varnost (r127 CI regresija)', () => {
  it('restore sanitizer vključuje DMMF enum polja (prej scalar-only → izpust polja → defaulti namesto backup vrednosti)', () => {
    const restore = SRC('src/lib/backup/restore.ts')
    expect(restore).toContain("f.kind === 'scalar' || f.kind === 'enum'")
    // manifest chunk-sizing enako:
    const manifest = SRC('src/lib/backup/manifest.ts')
    expect(manifest).toContain("f.kind === 'scalar' || f.kind === 'enum'")
  })
})

describe('R156/#41 — zod + seeds v enum domeni', () => {
  it('zod orders updateOrderSchema.status filter vsebuje served (poseben action endpoint)', () => {
    const zod = SRC('src/lib/validations/orders.ts')
    expect(zod).toContain("z.enum(['pending', 'in-progress', 'ready', 'completed', 'cancelled', 'served'])")
  })

  it('demo-data role/status vrednosti so vsi EmployeeRole/EmployeeStatus člani', () => {
    const demo = SRC('src/app/api/seed/helpers/demo-data.ts')
    const roles = [...demo.matchAll(/role: '(\w+)'/g)].map((m) => m[1])
    expect(roles.length).toBeGreaterThan(0)
    for (const r of roles) expect(EXPECTED_ENUMS.EmployeeRole).toContain(r)
    // samo employee upsert vrstice (demo-data ustvarja tudi Table 'available' itd.)
    const empLines = demo.split('\n').filter((l) => l.includes("db.employee.upsert") && l.includes("role: '"))
    expect(empLines.length).toBeGreaterThan(0)
    for (const line of empLines) {
      const st = line.match(/status: '(\w+)'/)?.[1]
      expect(st, `employee status na vrstici: ${line.trim().slice(0, 80)}`).toBeDefined()
      expect(EXPECTED_ENUMS.EmployeeStatus).toContain(st)
    }
  })

  it('e2e-seed-data piše admin/active (člana EmployeeRole/EmployeeStatus)', () => {
    const seed = SRC('scripts/e2e-seed-data.mjs')
    expect(seed).toContain("'admin', 'active'")
  })
})
