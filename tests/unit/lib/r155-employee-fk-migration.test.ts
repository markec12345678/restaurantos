// ============================================
// R155-b / REPO ISSUE #43 zaključek — WIRING-CHECK (readFileSync kanon)
// ============================================
// Testira OŽIČENJE (wiring), ne runtime:
//   A) migracija 0023_employee_fk_backfill/migration.sql vsebuje: 2× ADD COLUMN
//      IF NOT EXISTS, 4× DO-$$ constraint guard (imena constraintov),
//      7× CREATE INDEX IF NOT EXISTS, backfill UPDATE klavzule za 8 parov
//      (id-match PRVI + name-match točno-1 DISTINCT guard), RAISE EXCEPTION
//      sirote-preverbo za TipDistribution (fail-closed) in hash-chain header
//      opombo (employeeName se NIKOLI ne spreminja).
//   B) prisma/schema.prisma pini: nova FK polja + relacijska imena +
//      Employee back-relacije + 7 @@index dopolnitev.
//   C) setup/db/route.ts legacy ALTER seznam ima 2 nova stolpca.
//   D) dual-write ožičenje v src (ključne dodelitve, vzorec r153-gates:302).
//
// Vzorec: r153-sales-mode-gates.test.ts (D) — SRC(p) = readFileSync(process.cwd()).
// Zagon: bunx vitest run tests/unit/lib/r155-employee-fk-migration.test.ts
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')

const MIGRATION = 'prisma/migrations/0023_employee_fk_backfill/migration.sql'
const SCHEMA = 'prisma/schema.prisma'

describe('R155/#43 — migracija 0023_employee_fk_backfill (wiring)', () => {
  const sql = SRC(MIGRATION)

  it('header: R155/#43 kontekst + hash-chain kontrakt (employeeName NIKOLI ne spreminja)', () => {
    expect(sql).toContain('0023_employee_fk_backfill — R155-b')
    expect(sql).toContain('issue #43')
    // Normaliziraj header: odstrani '--' markerje in lome vrstic, da so fraze
    // primerljive neodvisno od oblivanja besedila
    const header = sql.slice(0, 2400).replace(/^--[ \t]?/gm, '').replace(/\s+/g, ' ')
    expect(header).toContain('employeeName se v tej migraciji NIKOLI ne spreminja')
    expect(header).toContain('FAIL-CLOSED')
  })

  it('2× ADD COLUMN IF NOT EXISTS (StockTransaction.employeeId, ZReport.finalizedById)', () => {
    expect(sql).toContain('ALTER TABLE "StockTransaction" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;')
    expect(sql).toContain('ALTER TABLE "ZReport" ADD COLUMN IF NOT EXISTS "finalizedById" TEXT;')
    // Štej SAMO stavke (header komentar omenja vzorec v besedilu)
    expect((sql.match(/^ALTER TABLE .* ADD COLUMN IF NOT EXISTS/gm) ?? []).length).toBe(2)
  })

  it('4× DO-$$ constraint guard z imeni constraintov (Prisma <tabela>_<kolona>_fkey)', () => {
    expect(sql).toContain("'StockTransaction_employeeId_fkey'")
    expect(sql).toContain("'ZReport_finalizedById_fkey'")
    expect(sql).toContain("'GuestVisit_employeeId_fkey'")
    expect(sql).toContain("'TipDistribution_employeeId_fkey'")
    expect((sql.match(/pg_constraint WHERE conname = /g) ?? []).length).toBe(4)
    // SetNull za 3 nove/nullable, RESTRICT za TipDistribution (required scalar)
    expect((sql.match(/ON DELETE SET NULL ON UPDATE CASCADE/g) ?? []).length).toBe(3)
    expect((sql.match(/ON DELETE RESTRICT ON UPDATE CASCADE/g) ?? []).length).toBe(1)
  })

  it('7× CREATE INDEX IF NOT EXISTS (2 nova FK + 5 retro)', () => {
    const idx = [
      'StockTransaction_employeeId_idx',
      'ZReport_finalizedById_idx',
      'Order_cancelledById_idx',
      'StaffShift_createdById_idx',
      'PurchaseOrder_requestedById_idx',
      'PurchaseOrder_approvedById_idx',
      'JournalEntry_postedById_idx',
    ]
    for (const i of idx) {
      expect(sql).toContain(`CREATE INDEX IF NOT EXISTS "${i}"`)
    }
    // Štej SAMO stavke (header komentar omenja vzorec v besedilu)
    expect((sql.match(/^CREATE INDEX IF NOT EXISTS/gm) ?? []).length).toBe(7)
  })

  it('backfill: id-match PRVI (EXISTS guard) za vseh 8 parov', () => {
    const pairs: Array<[string, string]> = [
      ['"Order" t', '"cancelledById" = t."cancelledBy"'],
      ['"PurchaseOrder" t', '"requestedById" = t."requestedBy"'],
      ['"PurchaseOrder" t', '"approvedById" = t."approvedBy"'],
      ['"StaffShift" t', '"createdById" = t."createdBy"'],
      ['"JournalEntry" t', '"postedById" = t."postedBy"'],
      ['"StockTransaction" t', '"employeeId" = t."employeeName"'],
      ['"ZReport" t', '"finalizedById" = t."finalizedBy"'],
    ]
    for (const [table, set] of pairs) {
      expect(sql).toContain(`UPDATE ${table}`)
      expect(sql).toContain(`SET ${set}`)
      expect(sql).toContain('AND EXISTS (SELECT 1 FROM "Employee" e WHERE')
    }
    // GuestVisit: sirote → NULL (SetNull semantika, constraint-ready)
    expect(sql).toContain('UPDATE "GuestVisit" t')
    expect(sql).toContain('SET "employeeId" = NULL')
    expect((sql.match(/AND EXISTS \(SELECT 1 FROM "Employee" e WHERE/g) ?? []).length).toBe(7)
  })

  it('backfill: name-match SAMO točno-1 zaposleni (DISTINCT guard) za vse name-parite', () => {
    // 7 parov × 2 UPDATE-a (id-match + name-match); GuestVisit nima name-matcha
    expect((sql.match(/AND \(SELECT count\(\*\) FROM "Employee" WHERE name = /g) ?? []).length).toBe(7)
    expect(sql).toContain(') = 1;')
  })

  it('fail-closed: TipDistribution sirote-preverba z RAISE EXCEPTION (PRED ADD CONSTRAINT)', () => {
    expect(sql).toContain("RAISE EXCEPTION 'TipDistribution: sirote employeeId (napaka podatkov, ročni pregled)'")
    const guardAt = sql.indexOf('RAISE EXCEPTION')
    const constraintAt = sql.indexOf('TipDistribution_employeeId_fkey"')
    expect(guardAt).toBeGreaterThan(-1)
    expect(constraintAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(constraintAt)
  })

  it('vrstni red: ADD COLUMN → backfill → guard → constraint → index', () => {
    // Precizni anchorji — header komentar omenja iste fraze, zato morajo
    // anchorji biti enolični za stavke
    const addCol = sql.indexOf('ALTER TABLE "StockTransaction" ADD COLUMN IF NOT EXISTS')
    const backfill = sql.indexOf('SET "cancelledById" = t."cancelledBy"')
    const guard = sql.indexOf("RAISE EXCEPTION 'TipDistribution: sirote")
    const constraint = sql.indexOf("pg_constraint WHERE conname = 'StockTransaction_employeeId_fkey'")
    const index = sql.indexOf('CREATE INDEX IF NOT EXISTS "StockTransaction_employeeId_idx"')
    expect(addCol).toBeLessThan(backfill)
    expect(backfill).toBeLessThan(guard)
    expect(guard).toBeLessThan(constraint)
    expect(constraint).toBeLessThan(index)
  })
})

describe('R155/#43 — prisma/schema.prisma pini', () => {
  const schema = SRC(SCHEMA)

  it('StockTransaction: employeeId FK + relacija + @@index (employeeName ostane snapshot)', () => {
    expect(schema).toContain('employeeId      String?')
    expect(schema).toContain('@relation("StockTransactionEmployee", fields: [employeeId], references: [id], onDelete: SetNull, onUpdate: Cascade)')
    expect(schema).toContain('@@index([employeeId])           // ISSUE #43/R155: FK index')
    expect(schema).toContain('employeeName    String        @default("")')
  })

  it('ZReport: finalizedById FK + relacija + @@index', () => {
    expect(schema).toContain('finalizedById     String?')
    expect(schema).toContain('@relation("ZReportFinalizedBy", fields: [finalizedById], references: [id], onDelete: SetNull, onUpdate: Cascade)')
    expect(schema).toContain('@@index([finalizedById])')
  })

  it('GuestVisit: relacija na OBSTOJEČI employeeId (SetNull)', () => {
    expect(schema).toContain('@relation("GuestVisitEmployee", fields: [employeeId], references: [id], onDelete: SetNull, onUpdate: Cascade)')
    expect(schema).toContain('@@index([employeeId])  // Poročila po natakarju')
  })

  it('TipDistribution: relacija na obstoječi NOT NULL employeeId (Restrict)', () => {
    expect(schema).toContain('@relation("TipDistributionEmployee", fields: [employeeId], references: [id], onDelete: Restrict, onUpdate: Cascade)')
  })

  it('Employee: 4 back-relacije', () => {
    expect(schema).toContain('stockTransactions StockTransaction[] @relation("StockTransactionEmployee")')
    expect(schema).toContain('zReportsFinalized ZReport[] @relation("ZReportFinalizedBy")')
    expect(schema).toContain('guestVisits GuestVisit[] @relation("GuestVisitEmployee")')
    expect(schema).toContain('tipDistributions TipDistribution[] @relation("TipDistributionEmployee")')
  })

  it('5 retro @@index dopolnitev za obstoječe FK stolpce', () => {
    expect(schema).toContain('@@index([cancelledById])')
    expect(schema).toContain('@@index([createdById])')
    expect(schema).toContain('@@index([requestedById])')
    expect(schema).toContain('@@index([approvedById])')
    expect(schema).toContain('@@index([postedById])')
  })
})

describe('R155/#43 — legacy idempotentni ALTER seznam (setup/db/route.ts)', () => {
  it('2 nova stolpca po obstoječem vzorcu', () => {
    const src = SRC('src/app/api/setup/db/route.ts')
    expect(src).toContain('ALTER TABLE "StockTransaction" ADD COLUMN IF NOT EXISTS "employeeId" TEXT')
    expect(src).toContain('ALTER TABLE "ZReport" ADD COLUMN IF NOT EXISTS "finalizedById" TEXT')
  })
})

describe('R155/#43 — dual-write ožičenje (src wiring, vzorec r153-gates)', () => {
  it('Order cancel: put-handler server fallback + client-passthrough (FK samo z sessionom)', () => {
    const src = SRC('src/app/api/orders/[id]/_helpers/put-handler.ts')
    expect(src).toContain('updateData.cancelledBy = authResult.session.employeeId')
    expect(src).toContain('updateData.cancelledById = authResult.session.employeeId')
    expect(src).toContain('if (authResult.session?.employeeId) {')
  })

  it('storno-transaction + perform-soft-delete: cancelledById = employeeId ?? null', () => {
    expect(SRC('src/app/api/furs/helpers/storno-invoice/storno-transaction.ts'))
      .toContain('cancelledById: employeeId ?? null,')
    expect(SRC('src/app/api/orders/[id]/webhooks/perform-soft-delete.ts'))
      .toContain('cancelledById: employeeId ?? null,')
  })

  it('purchase-orders: requestedById (POST) + approvedById (PUT+PATCH)', () => {
    expect(SRC('src/app/api/purchase-orders/route.ts')).toContain('requestedById: authResult.session?.employeeId ?? null,')
    const po = SRC('src/app/api/purchase-orders/[id]/route.ts')
    // dodelitvena sintaksa (updateData.approvedById = ...) — PUT + PATCH
    expect(po.split('updateData.approvedById = authResult.session?.employeeId ?? null').length - 1).toBe(2)
  })

  it('staff-shifts: createdById = session.employeeId', () => {
    expect(SRC('src/app/api/staff-shifts/route.ts')).toContain('createdById: authResult.session?.employeeId ?? null,')
  })

  it('journal-generator: postedById na vseh 3 mestih (payment/refund/storno)', () => {
    const src = SRC('src/lib/accounting/journal-generator.ts')
    expect((src.match(/postedById: /g) ?? []).length).toBe(3)
    expect(src).toContain('postedById: employeeId || null,')
    expect((src.match(/postedById: input.employeeId \|\| null,/g) ?? []).length).toBe(2)
  })

  it('build-report: finalizedById = employeeId || null (draft → null)', () => {
    expect(SRC('src/app/api/z-report/_helpers/build-report.ts'))
      .toContain('finalizedById: finalize ? (employeeId || null) : null,')
  })

  it('stock-mutations: 3 helperja sprejmejo employeeId? in ga zapišejo (employeeId: employeeId ?? null)', () => {
    const src = SRC('src/app/api/inventory/_helpers/stock-mutations.ts')
    expect((src.match(/employeeId\?: string \| null/g) ?? []).length).toBe(3)
    expect((src.match(/employeeId: employeeId \?\? null,/g) ?? []).length).toBe(3)
  })

  it('waste-mutations: NE piše FK (recordedByUserId je app-user id, ne Employee id)', () => {
    const src = SRC('src/app/api/waste/_helpers/waste-mutations.ts')
    expect(src).toContain('employeeName: recordedByUserId ?? \'\'')
    expect(src).toContain('employeeName: reversedByUserId ?? \'\'')
    expect(src).not.toContain('employeeId:')
  })

  it('GuestVisit route: bonus content fix (lookup imena, fallback cuid)', () => {
    const src = SRC('src/app/api/guests/[id]/visits/route.ts')
    expect(src).toContain('db.employee.findUnique')
    expect(src).toContain('employeeName: visitEmployeeName')
    // FK scalar se piše že od ustanovitve — ni dual-write potreben
    expect(src).toContain('employeeId: authResult.session?.employeeId || null,')
  })

  it('direktni StockTransaction sites: employeeId dodelitev prisotna', () => {
    expect(SRC('src/app/api/inventory/transactions/route.ts')).toContain('employeeId: authResult.session?.employeeId ?? null,')
    expect(SRC('src/app/api/inventory/[id]/_helpers.ts')).toContain('employeeId: authResult.session?.employeeId ?? null,')
    expect((SRC('src/app/api/inventory/adjust/route.ts').match(/employeeId: authResult.session\?\.employeeId \?\? null,/g) ?? []).length).toBe(3)
    expect(SRC('src/app/api/inventory/restock/route.ts')).toContain('employeeId: authResult.session?.employeeId ?? null,')
    expect((SRC('src/app/api/purchase-orders/[id]/_helpers.ts').match(/employeeId: employeeId \?\? null,/g) ?? []).length).toBe(2)
    expect((SRC('src/app/api/order-items/[id]/_helpers/void-stock-return.ts').match(/employeeId: employeeId \?\? null,/g) ?? []).length).toBe(2)
    expect(SRC('src/app/api/inventory/_helpers/create-inventory-item.ts')).toContain('employeeId: employeeId ?? null,')
    expect(SRC('src/app/api/inventory/reorder/_helpers/create-order.ts')).toContain('employeeId: employeeId ?? null,')
    expect(SRC('src/app/api/inventory/reorder/route.ts')).toContain('createReorderOrder(items, employeeName || \'\', scope.locationId, authResult.session?.employeeId ?? null)')
    expect(SRC('src/app/api/stocktakes/_helpers/stocktake-mutations.ts')).toContain('employeeId: employeeId ?? null,')
    expect(SRC('src/app/api/stocktakes/[id]/approve/route.ts')).toContain('employeeId: authResult.session?.employeeId ?? null,')
    expect((SRC('src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts').match(/employeeId: employeeId \?\? null,/g) ?? []).length).toBe(2)
    expect(SRC('src/app/api/batch-preparations/[id]/complete/route.ts')).toContain('employeeId: authResult.session?.employeeId ?? null,')
  })
})
