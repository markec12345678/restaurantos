// ============================================
// R117 — DEMO SEED NUMBERING (H-3, P2)
// ============================================
//
// PASS 1 najdba: src/app/api/seed/helpers/demo-data.ts je številčil demo
// naročila z non-atomic GLOBALNIM MAX(orderNumber)+1:
//
//   const maxOrder = await db.order.findFirst({ orderBy: { orderNumber: 'desc' } })
//   const orderNumber = (maxOrder?.orderNumber || 0) + 1
//
//   • non-atomic (read-then-write) → race proti sočasnemu živemu POS prometu
//     → P2002 na @@unique([locationId, orderNumber]),
//   • GLOBALNI max brez lokacije → spodkopava per-lokacijsko številčenje
//     (P1-7/FURS kanon),
//   • vsakemu naročilu svoja findFirst poizvedba (N poizvedb).
//
// Fix: kanonski R100 atomarni per-lokacijski counter getNextOrderNumber(
// locationId) — ENA SQL izjava (INSERT .. ON CONFLICT), samo-inicializacija
// na MAX(orderNumber) TE lokacije + 1, varen ob sočasnem prometu.
//
// Ta test dokazuje (obnašajno + strukturno):
//   1. seedDemoData številči IZKLJUČNO prek kanonskega counterja (NI več
//      globalnega order.findFirst MAX+1),
//   2. counter je poklican z resolved lokacijo (per-lokacijski kanon),
//   3. zaporedje več demo naročil ostane nedotaknjeno (1., 2., 3., … po
//     vrsti redu ustvarjanja).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const LOC_DEMO = 'loc-demo-1'

const mocks = vi.hoisted(() => ({
  locationFindFirst: vi.fn(),
  tableCreate: vi.fn(),
  employeeUpsert: vi.fn(),
  inventoryItemCreate: vi.fn(),
  shiftCreate: vi.fn(),
  orderCreate: vi.fn(),
  // SPY — dokazuje, da globalni MAX+1 pattern NI več uporabljen
  orderFindFirst: vi.fn(),
  getNextOrderNumber: vi.fn(),
  requireEnvSecret: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    location: { findFirst: mocks.locationFindFirst },
    table: { create: mocks.tableCreate },
    employee: { upsert: mocks.employeeUpsert },
    inventoryItem: { create: mocks.inventoryItemCreate },
    shift: { create: mocks.shiftCreate },
    // ISSUE #36 R125: demo seed ustvarja izmene prek StaffShift
    staffShift: { create: mocks.shiftCreate },
    order: { create: mocks.orderCreate, findFirst: mocks.orderFindFirst },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// Kanonski counter mock — realna per-lokacijska semantika (sekvenčno +1)
vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: mocks.getNextOrderNumber,
}))

vi.mock('@/lib/crypto/secrets', () => ({
  requireEnvSecret: mocks.requireEnvSecret,
}))

// bcrypt hash — v tej enoti nepomemben (PIN hash mehanizma je pokrit drugje)
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(async () => 'hashed-pin') },
  hash: vi.fn(async () => 'hashed-pin'),
}))

vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { seedDemoData } from '@/app/api/seed/helpers/demo-data'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.locationFindFirst.mockResolvedValue({ id: LOC_DEMO })
  mocks.tableCreate.mockImplementation(async ({ data }: { data: { number: number } }) => ({ id: `tbl-${data.number}` }))
  mocks.employeeUpsert.mockImplementation(async ({ where }: { where: { email: string } }) => ({ id: `emp-${where.email}`, role: 'admin', status: 'active' }))
  mocks.inventoryItemCreate.mockResolvedValue({})
  mocks.shiftCreate.mockResolvedValue({})
  mocks.orderCreate.mockImplementation(async ({ data }: { data: { orderNumber: number } }) => ({ id: `ord-${data.orderNumber}` }))
  // kanonski counter: atomarno +1 (modelira INSERT .. ON CONFLICT semantiko)
  let seq = 0
  mocks.getNextOrderNumber.mockImplementation(async (locationId: string) => {
    if (locationId !== LOC_DEMO) throw new Error(`counter mora biti per-lokacijski: dobil ${locationId}`)
    seq += 1
    return seq
  })
  mocks.requireEnvSecret.mockReturnValue('test-secret-32-chars-minimum-ok')
})

describe('R117 H-3: demo seed numbering uporablja kanonski per-lokacijski counter', () => {
  it('vsako demo naročilo številči getNextOrderNumber(locationId) — NI globalnega MAX+1 findFirst', async () => {
    // demo-data inventar referencira menuItems[8..10] po indeksu — zato ≥11 artiklov
    const menuItems = Array.from({ length: 12 }, (_, i) => ({ id: `mi-${i}`, price: 10, vatRate: 22 }))
    await seedDemoData(menuItems)

    const createdCount = mocks.orderCreate.mock.calls.length
    // seed ustvari realno število naročil (5–10 na dan × 7 dni, naključno)
    expect(createdCount).toBeGreaterThan(0)

    // 1) counter je poklican TOČNO enkrat na naročilo
    expect(mocks.getNextOrderNumber).toHaveBeenCalledTimes(createdCount)

    // 2) counter je VEDNO poklican z resolved lokacijo (per-lokacijski kanon)
    for (const call of mocks.getNextOrderNumber.mock.calls) {
      expect(call[0]).toBe(LOC_DEMO)
    }

    // 3) orderNumber na order.create = counter sekvenca v vrstnem redu
    //    ustvarjanja (zaporedje/vedenje demo seeda ohranjeno)
    const createdNumbers = mocks.orderCreate.mock.calls.map(
      (c) => (c[0] as { data: { orderNumber: number } }).data.orderNumber,
    )
    expect(createdNumbers).toEqual(createdNumbers.map((_, i) => i + 1))

    // 4) globalni MAX+1 pattern je IZKORENJEN — order.findFirst NI bil
    //    nikoli poklican (prej: findFirst orderBy orderNumber desc + 1)
    expect(mocks.orderFindFirst).not.toHaveBeenCalled()
  })

  it('strukturni pin: vir uporablja getNextOrderNumber(locationId), MAX+1 vzorec je odstranjen', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/seed/helpers/demo-data.ts'), 'utf-8')
    // kanonski counter v viru
    expect(src).toContain('getNextOrderNumber(locationId)')
    // prepovedani non-atomic vzorci
    expect(src).not.toContain("orderBy: { orderNumber: 'desc' }")
    expect(src).not.toContain('(maxOrder?.orderNumber || 0) + 1')
  })
})
