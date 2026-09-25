// @vitest-environment node
// ============================================
// R131 / EPIC #115 P1-13 — INTEGRACIJA: KATALOG → DRAFT-PO (PAKETI) →
// PREVZEM → ZALOGA/LEDGER/PRICE HISTORY → AP (prava PGlite)
// ============================================
// Kanon P1-13 "Katalog → PO v paketih → GRN (prevzem) → zaloga v osnovnih
// enotah → Price History na osnovno enoto" na pravi bazi (PGlite, izoliran
// PGLITE_DATA_DIR; vzorec: r130-supplier-price-history.test.ts):
//   1. Katalog API živ: POST upsert (201 create → 200 update) + GET
//      (baseUnitPrice izračunan, Decimal → number)
//   2. draft-po: suggested 50 kg @ katalog vrečka 25 kg / 45 € → PO vrstica v
//      CELIH PAKETIH (2 × vrečka @ 45 = 90 €) s packQty snapshotom + razlaga
//   3. Prevzem 2 paketov: zaloga TOČNO +50 kg, StockTransaction v base enotah
//      (quantity 50, costPerUnit 1.8, totalCost 90), SupplierPriceHistory na
//      osnovni enoti (unitPrice 1.8, unit kg, provenance note), AP denar =
//      packs × pricePerPack (+ DDV)
//   4. Legacy PO brez katalog linije → legacy base-unit vrstica NESPREMENJENA
//      (prevzem: +14 kg, ledger 14 @ 3 = 42, price history 3/kg brez note)
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route, katalog upsert, draft-po kanon, prevzemni
// kanon z advisory lockom + Serializable, Decimal) je REALNO nad PGlite.
// Zagon: PGLITE_DATA_DIR=/tmp/pglite-data-it bun run db:init-pglite
//        → PGLITE_DATA_DIR=/tmp/pglite-data-it bunx vitest run
//          tests/integration/r131-supplier-catalog-drill.test.ts
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, vi } from 'vitest'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: async () =>
      authRef.current
        ? {
            session: {
              token: 'integration-test-token',
              employeeId: authRef.current.employeeId,
              role: authRef.current.role,
              permissions: authRef.current.permissions,
              createdAt: Date.now(),
              expiresAt: Date.now() + 3_600_000,
              absoluteExpiry: Date.now() + 86_400_000,
              locationId: authRef.current.locationId,
            },
            error: null,
          }
        : { session: null, error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }) },
  }
})

import { db } from '@/lib/db'
import { POST as catalogPost, GET as catalogGet } from '@/app/api/suppliers/[id]/catalog/route'
import { POST as draftPoPost } from '@/app/api/reorder/draft-po/route'
import { POST as poReceive } from '@/app/api/purchase-orders/[id]/receive/route'

const RUN_ID = `r131-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  supplier: `${RUN_ID}-sup`,
  invA: `${RUN_ID}-inv-a`, // Z katalog linijo (vrečka 25 kg @ 45)
  invB: `${RUN_ID}-inv-b`, // BREZ katalog linije (legacy)
}

const SUPPLIER_NAME = `Dobavitelj ${RUN_ID}`

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function authedReq(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers)
  headers.set('authorization', 'Bearer integration')
  return new Request(url, { ...init, headers })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.location, name: 'R131 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: 'R131 Test Skladovnik', email: `${RUN_ID}@r131-test.local`, role: 'manager', status: 'active', locationId: IDS.location },
  })
  await db.supplier.create({ data: { id: IDS.supplier, name: SUPPLIER_NAME, code: `${RUN_ID}-S` } })

  // Artikel A: min 30, zaloga 10 → insufficient predlog = 2×30 − 10 = 50 kg
  // → katalog vrečka 25 kg → 2 cela paketa
  await db.inventoryItem.create({
    data: {
      id: IDS.invA,
      name: 'R131 Moka tip 500',
      unit: 'kg',
      quantity: 10,
      minQuantity: 30,
      costPerUnit: 2.0,
      servingsPerUnit: 1,
      locationId: IDS.location,
      supplier: SUPPLIER_NAME,
    },
  })
  // Artikel B: brez kataloga (legacy base-unit pot)
  await db.inventoryItem.create({
    data: {
      id: IDS.invB,
      name: 'R131 Sladkor',
      unit: 'kg',
      quantity: 2,
      minQuantity: 8,
      costPerUnit: 3.0,
      servingsPerUnit: 1,
      locationId: IDS.location,
      supplier: SUPPLIER_NAME,
    },
  })

  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['manage_inventory'] }
})

afterAll(async () => {
  // Čiščenje po FK redu (SupplierItem/SupplierPriceHistory → Supplier)
  await db.supplierItem.deleteMany({ where: { supplierId: IDS.supplier } }).catch(() => {})
  await db.supplierPriceHistory.deleteMany({ where: { inventoryItemId: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.accountsPayable.deleteMany({ where: { supplierId: IDS.supplier } }).catch(() => {})
  await db.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { supplierId: IDS.supplier } } }).catch(() => {})
  await db.purchaseOrder.deleteMany({ where: { supplierId: IDS.supplier } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.supplier.deleteMany({ where: { id: IDS.supplier } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R131 integracija: katalog → draft-po (paketi) → prevzem → zaloga/ledger/price history/AP', () => {
  let poAId = ''
  let poBId = ''

  it('(1) Katalog API živ: POST upsert 201 → 200 update, GET z baseUnitPrice 1.8', async () => {
    // CREATE
    const cr = await catalogPost(
      authedReq(`http://local/api/suppliers/${IDS.supplier}/catalog`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: IDS.invA,
          packQty: 25,
          packUnit: 'vrečka',
          pricePerPack: 45,
          vatRate: 22,
          minOrderPacks: 1,
          supplierSku: 'MOKA-25',
          note: 'R131 drill cenik',
        }),
      }),
      params(IDS.supplier),
    )
    expect(cr.status).toBe(201)
    const cbody = await asJson(cr)
    expect(cbody.created).toBe(true)
    const crow = cbody.row as Record<string, unknown>
    expect(Number(crow.packQty)).toBe(25)
    expect(crow.baseUnitPrice).toBe(1.8) // 45 / 25

    // UPDATE (isti par) → 200
    const ur = await catalogPost(
      authedReq(`http://local/api/suppliers/${IDS.supplier}/catalog`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: IDS.invA,
          packQty: 25,
          packUnit: 'vrečka',
          pricePerPack: 45,
          minOrderPacks: 1,
        }),
      }),
      params(IDS.supplier),
    )
    expect(ur.status).toBe(200)
    expect((await asJson(ur)).created).toBe(false)

    // GET — točno 1 vrstica, Decimal → number, izračunana osnovna cena
    const gr = await catalogGet(authedReq(`http://local/api/suppliers/${IDS.supplier}/catalog`), params(IDS.supplier))
    expect(gr.status).toBe(200)
    const gbody = await asJson(gr)
    const items = gbody.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].packQty).toBe(25) // deepToNumbers
    expect(items[0].pricePerPack).toBe(45)
    expect(items[0].baseUnitPrice).toBe(1.8)
    expect(items[0].packUnit).toBe('vrečka')
    const item = items[0].inventoryItem as Record<string, unknown>
    expect(item.id).toBe(IDS.invA)
    expect(item.unit).toBe('kg')
  })

  it('(2) draft-po: suggested 50 kg → PO v CELIH paketih (2 × vrečka @ 45) s packQty snapshotom + razlago', async () => {
    const res = await draftPoPost(
      authedReq('http://local/api/reorder/draft-po', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemIds: [IDS.invA] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders).toHaveLength(1)
    const order = orders[0]
    poAId = order.id as string

    // Response items: pack povzetek
    const items = order.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0]).toEqual({
      name: 'R131 Moka tip 500',
      packs: 2,
      packUnit: 'vrečka',
      packQty: 25,
      baseQty: 50,
      pricePerPack: 45,
      totalPrice: 90,
    })
    expect(Number(order.totalAmount)).toBeCloseTo(109.8, 2) // 90 + 22 % DDV

    // PO v bazi: vrstica v PAKETIH + snapshot
    const po = await db.purchaseOrder.findUnique({
      where: { id: poAId },
      include: { items: true },
    })
    expect(po).toBeTruthy()
    expect(po!.items).toHaveLength(1)
    const line = po!.items[0]
    expect(Number(line.quantityOrdered)).toBe(2) // PAKETI, ne kg
    expect(line.unit).toBe('vrečka')
    expect(Number(line.unitPrice)).toBe(45) // cena na PAKET
    expect(Number(line.packQty)).toBe(25) // snapshot (kanon #3)
    expect(line.packUnit).toBe('vrečka')
    expect(Number(line.totalPrice)).toBe(90)
    // Pack razlaga v opombi (ob faktorjih R129)
    expect(po!.notes).toContain('naročeno 2 × vrečka po 25 kg = 50 kg (predlog 50 kg)')
  })

  it('(3) Prevzem 2 paketov: zaloga TOČNO +50 kg, ledger base (50 @ 1.8, totalCost 90), price history base + provenance, AP = packs × pricePerPack', async () => {
    const poItem = await db.purchaseOrderItem.findFirst({ where: { purchaseOrderId: poAId } })
    expect(poItem).toBeTruthy()

    const before = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invA } }))!.quantity)
    expect(before).toBe(10)

    const rr = await poReceive(
      authedReq(`http://local/api/purchase-orders/${poAId}/receive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          receivedItems: [{ itemId: poItem!.id, quantityReceived: 2 }], // 2 PAKETA
          notes: 'R131 integracijski prevzem (paketi)',
        }),
      }),
      params(poAId),
    )
    expect(rr.status).toBe(200)

    // Zaloga: 10 + (2 × 25) = 60 — TOČNO +50 kg (NE +2!)
    const after = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invA } }))!.quantity)
    expect(after).toBe(60)

    // Ledger v OSNOVNIH enotah + forenzika iz post-op (R103 G3)
    const txs = await db.stockTransaction.findMany({ where: { inventoryItemId: IDS.invA, type: 'procurement' } })
    expect(txs).toHaveLength(1)
    const st = txs[0]
    expect(Number(st.quantity)).toBe(50)
    expect(Number(st.previousQty)).toBe(10)
    expect(Number(st.newQty)).toBe(60)
    // Osnovna cena: 45 / 25 = 1.8 (stolpec 12,2)
    expect(Number(st.costPerUnit)).toBe(1.8)
    expect((st.costPerUnit as { toFixed: (n: number) => string }).toFixed(2)).toBe('1.80')
    // DENAR nespremenjen: 2 paketa × 45 = 90
    expect(Number(st.totalCost)).toBe(90)
    // supplierDoc = PO številka (ND-YYYY-NNNNNN kanon)
    expect(String(st.supplierDoc)).toMatch(/^ND-\d{4}-\d{6}$/)

    // SupplierPriceHistory VEDNO na osnovni enoti (kanon #4) + provenance
    const hist = await db.supplierPriceHistory.findMany({ where: { inventoryItemId: IDS.invA } })
    expect(hist).toHaveLength(1)
    const ph = hist[0]
    expect(ph.source).toBe('goods_receipt')
    expect(ph.supplierId).toBe(IDS.supplier)
    expect(ph.purchaseOrderId).toBe(poAId)
    // Decimal(12,4) — '1.8000' v bazi; Number + toFixed (R130-a2 lekcija)
    expect(Number(ph.unitPrice)).toBe(1.8)
    expect((ph.unitPrice as { toFixed: (n: number) => string }).toFixed(4)).toBe('1.8000')
    expect(ph.unit).toBe('kg') // InventoryItem.unit, NE 'vrečka'
    expect(ph.note).toBe('pack: 2 × vrečka po 25 kg')

    // AP: denar = packs × pricePerPack + DDV (glava PO nespremenjena)
    const ap = await db.accountsPayable.findFirst({ where: { purchaseOrderId: poAId } })
    expect(ap).toBeTruthy()
    expect(Number(ap!.subtotal)).toBe(90)
    expect(Number(ap!.vatAmount)).toBeCloseTo(19.8, 2)
    expect(Number(ap!.totalAmount)).toBeCloseTo(109.8, 2)
  })

  it('(4) Legacy PO brez katalog linije: base-unit vrstica NESPREMENJENA (prevzem +14 kg, ledger 14 @ 3, cena 3/kg brez note)', async () => {
    const res = await draftPoPost(
      authedReq('http://local/api/reorder/draft-po', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemIds: [IDS.invB] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders).toHaveLength(1)
    poBId = orders[0].id as string

    // Legacy summary: pack polja null
    const items = orders[0].items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].packQty).toBeNull()
    expect(items[0].packUnit).toBeNull()
    expect(items[0].pricePerPack).toBeNull()
    expect(items[0].packs).toBe(14) // suggested = 2×8 − 2 (base enote)
    expect(items[0].totalPrice).toBe(42)

    const poItem = await db.purchaseOrderItem.findFirst({ where: { purchaseOrderId: poBId } })
    expect(poItem).toBeTruthy()
    // Legacy vrstica: brez pack snapshotov
    expect(poItem!.packQty).toBeNull()
    expect(poItem!.packUnit).toBeNull()
    expect(Number(poItem!.quantityOrdered)).toBe(14)
    expect(poItem!.unit).toBe('kg')
    expect(Number(poItem!.unitPrice)).toBe(3)

    const before = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invB } }))!.quantity)
    expect(before).toBe(2)

    const rr = await poReceive(
      authedReq(`http://local/api/purchase-orders/${poBId}/receive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          receivedItems: [{ itemId: poItem!.id, quantityReceived: 14 }], // kg
          notes: 'R131 integracijski prevzem (legacy)',
        }),
      }),
      params(poBId),
    )
    expect(rr.status).toBe(200)

    // Zaloga TOČNO +14 kg
    const after = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invB } }))!.quantity)
    expect(after).toBe(16)

    // Ledger legacy: 14 @ 3 = 42
    const txs = await db.stockTransaction.findMany({ where: { inventoryItemId: IDS.invB, type: 'procurement' } })
    expect(txs).toHaveLength(1)
    expect(Number(txs[0].quantity)).toBe(14)
    expect(Number(txs[0].costPerUnit)).toBe(3)
    expect(Number(txs[0].totalCost)).toBe(42)

    // Price history legacy: unitPrice = 3 (na ENOTO), unit kg, BREZ pack note
    const hist = await db.supplierPriceHistory.findMany({ where: { inventoryItemId: IDS.invB } })
    expect(hist).toHaveLength(1)
    expect(Number(hist[0].unitPrice)).toBe(3)
    expect(hist[0].unit).toBe('kg')
    expect(hist[0].note).toBe('') // legacy create ne piše note (DB default '')
  })
})
