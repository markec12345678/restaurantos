// @vitest-environment node
// ============================================
// R127 / EPIC #115 P0-6 — INTEGRACIJA: BACKUP → RESTORE ROUND-TRIP (prava DB)
// ============================================
// To je AVTOMATIZIRANI PERIODIČNI RESTORE TEST iz P0-6 kanona ("periodični
// restore test"): teče v CI ob vsakem PR na pravi bazi (PostgreSQL service;
// lokalno PGlite na izoliranem PGLITE_DATA_DIR=/tmp/pglite-data-it).
//
// Dokaz: backup (createBackup) → applyRestore (TRUNCATE vseh tabel + insert
// v topološkem FK redu znotraj transakcije) → ponoven backup — counts ENAKI
// in CHECKSUM ENAK (byte-točen round-trip: Decimal kot string, Date ISO,
// AuditLog v vrstnem redu hash verige).
//
// Opombe:
//  • fileParallelism: false (vitest.config.integration.ts) — TRUNCATE se
//    ne teče vzporedno z drugimi integracijskimi datotekami.
//  • DB je za test namenjena (CI service / izoliran PGlite dir) — full
//    restore je tu VARNOSTEN in je točno tisto, kar P0-6 zahteva.
//  • test.env / config env: DATABASE_URL → Postgres, sicer PGlite
//    (isto logiko kot db-invariants.test.ts).
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

// KLJUČNO: tests/setup.ts globalno mock-ira @/lib/db — tu želimo PRAVEGA klienta.
vi.unmock('@/lib/db')

import { db, createAuditLog } from '@/lib/db'
import { createBackup, applyRestore, computeChecksum } from '@/lib/backup'

const RUN_ID = `r127-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ---------- Seed ID-ji (FK veriga Location → Menu → Category → MenuItem → Inventory → StockTx) ----------
const IDS = {
  location: `${RUN_ID}-loc`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-item`,
  inventory: `${RUN_ID}-inv`,
  stockTx: `${RUN_ID}-stx`,
}

beforeAll(async () => {
  // Odstrani morebitne ostanke (ponovni zagon z istim ms je praktično nemogoč,
  // a cleanup po id je poceni)
  await db.stockTransaction.deleteMany({ where: { id: IDS.stockTx } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: IDS.inventory } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})

  await db.location.create({
    data: { id: IDS.location, name: `DR Test ${RUN_ID}`, code: RUN_ID.slice(-12), type: 'restaurant' },
  })
  await db.menu.create({ data: { id: IDS.menu, name: `Jedilnik ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `Pice ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({
    data: {
      id: IDS.menuItem,
      name: `Margherita ${RUN_ID}`,
      price: '19.99', // Decimal(12,2) — round-trip natančnost
      vatRate: '9.50',
      categoryId: IDS.category,
    },
  })
  await db.inventoryItem.create({
    data: {
      id: IDS.inventory,
      name: `Moka ${RUN_ID}`,
      unit: 'kg',
      quantity: '3.5', // Decimal(12,3)
      minQuantity: '1',
      costPerUnit: '19.99',
      menuItemId: IDS.menuItem,
      locationId: IDS.location,
    },
  })
  await db.stockTransaction.create({
    data: {
      id: IDS.stockTx,
      inventoryItemId: IDS.inventory,
      type: 'adjustment',
      quantity: '3.5',
      previousQty: '0',
      newQty: '3.5',
      costPerUnit: '19.99',
      totalCost: '69.965',
      note: `R127 seed ${RUN_ID}`,
    },
  })
})

afterAll(async () => {
  // Po restore so vrstice spet v bazi (isti id) — čiščenje po id
  await db.stockTransaction.deleteMany({ where: { id: IDS.stockTx } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: IDS.inventory } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

// ─────────────────────────────────────────────
describe('R127 integracija: backup → clean restore → round-trip', () => {
  it('P0-6 kanon: backup → applyRestore → counts ENAKI + checksum ENAK (byte-točen)', async () => {
    const b1 = await createBackup()
    expect(b1.format).toBe('restaurantos-backup')
    expect(b1.counts['MenuItem']).toBeGreaterThanOrEqual(1)
    expect(b1.counts['StockTransaction']).toBeGreaterThanOrEqual(1)

    // Seeded vrstice so v backupu z EXACT Decimal stringom ('19.99', '3.5')
    const invRow = (b1.tables['InventoryItem'] as Array<Record<string, unknown>>).find(
      r => r['id'] === IDS.inventory,
    ) as Record<string, unknown> | undefined
    expect(invRow).toBeDefined()
    expect(invRow?.['quantity']).toBe('3.5')
    expect(invRow?.['costPerUnit']).toBe('19.99')

    // CLEAN ENVIRONMENT + RESTORE: TRUNCATE vseh tabel + insert (ena transakcija)
    const result = await applyRestore(b1)
    expect(result.verifyOnly).toBe(false)
    expect(result.matched).toBe(true)
    expect(result.totalRestored).toBe(result.totalExpected)
    expect(result.tables['MenuItem']).toMatchObject({ restored: result.tables['MenuItem'].expected, matched: true })

    // ROUND-TRIP DOKAZ: ponoven backup ima ISTI checksum (vsebina byte-točno enaka)
    const b2 = await createBackup()
    expect(b2.counts).toEqual(b1.counts)
    expect(b2.checksum).toBe(b1.checksum)
    expect(b2.countsChecksum).toBe(b1.countsChecksum)

    // Seeded podatki so dejansko BERLJIVI po restore (aplikacijski pogled)
    const item = await db.menuItem.findUnique({ where: { id: IDS.menuItem } })
    expect(item?.price.toString()).toBe('19.99')
    const inv = await db.inventoryItem.findUnique({ where: { id: IDS.inventory } })
    expect(inv?.quantity.toString()).toBe('3.5')
  }, 120_000)

  it('AuditLog hash veriga se po restore PRAVILNO nadaljuje (append na obnovljeno verigo)', async () => {
    // Zadnja obnovljena vrstica (timestamp desc — ista logika kot createAuditLog)
    const before = await db.auditLog.findFirst({
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      select: { chainHash: true },
    })
    const beforeHash = before?.chainHash ?? ''

    await createAuditLog({
      action: 'R127_TEST_APPEND',
      entityType: 'System',
      entityId: RUN_ID,
      details: { test: RUN_ID },
    })

    const after = await db.auditLog.findFirst({
      where: { action: 'R127_TEST_APPEND' },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      select: { previousHash: true, chainHash: true },
    })
    expect(after).toBeDefined()
    // Nova vrstica se mora verigati na zadnjo OBNOVLJENO vrstico
    expect(after?.previousHash).toBe(beforeHash)
  })

  it('Tamperan backup → CHECKSUM 422 PRED vsakim DB zapisom (integritetna zaščita)', async () => {
    const b1 = await createBackup()
    const tampered = JSON.parse(JSON.stringify(b1)) as typeof b1
    const rows = tampered.tables['MenuItem'] as Array<Record<string, unknown>>
    rows[0]['name'] = 'TAMPERED'
    tampered.checksum = computeChecksum(tampered.tables) // ponastavi checksum na tamperano vsebino → schema ok, a countsChecksum ostane — hmm
    // Bolj realističen tamper: spremeni vsebino BREZ prepisanega checksuma
    rows[0]['name'] = 'TAMPERED2'
    await expect(applyRestore(tampered)).rejects.toMatchObject({
      code: 'CHECKSUM',
      status: 422,
    })
    // Baza NI dotaknjena (napaka pade pred transakcijo)
    const item = await db.menuItem.findUnique({ where: { id: IDS.menuItem } })
    expect(item?.name).not.toBe('TAMPERED2')
  })

  it('verifyOnly: validacija brez zapisov (DB nedotaknjen)', async () => {
    const b1 = await createBackup()
    const countBefore = await db.menuItem.count()
    const res = await applyRestore(b1, { verifyOnly: true })
    expect(res.verifyOnly).toBe(true)
    expect(res.totalRestored).toBe(0)
    expect(res.tables['MenuItem']?.expected).toBe(countBefore)
    expect(await db.menuItem.count()).toBe(countBefore)
  })
})
