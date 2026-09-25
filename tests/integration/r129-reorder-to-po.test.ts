// @vitest-environment node
// ============================================
// R129 / EPIC #115 P1-07 — INTEGRACIJA: REORDER → DRAFT PO → PREVZEM → ZALOGA
// ============================================
// Canon §21 #6 + #7 ("reorder → PO", "PO → GRN → stock") na pravi bazi
// (PGlite, izoliran PGLITE_DATA_DIR):
//   (a) usage facts: ADU šteje prodajo + porabo priprav (sale +
//       batch-consumption), NE šteje prevzemov/vračil/popravkov
//   (b) GET /api/inventory/reorder → razložljiv predlog (factors, status,
//       dataStatus sufficient, reorderPoint izpeljan)
//   (c) POST /api/reorder/draft-po → draft PO (ND-YYYY-NNNNNN, expectedDate,
//       item iz predloga, supplier FK fail-closed)
//   (d) state machine draft→submitted→approved → prevzem prek kanona
//       receivePurchaseOrderItems → zaloga povišana TOČNO za količino +
//       StockTransaction 'procurement' s ledger trailom
//   (e) fail-closed: dobavitelj brez Supplier zapisa → 400 SUPPLIER_NOT_FOUND
//
// Zagon: node scripts/init-pglite.mjs (PGLITE_DATA_DIR=/tmp/pglite-data-it)
//        → vitest run --config vitest.config.integration.ts <file>
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
import { GET as reorderGet } from '@/app/api/inventory/reorder/route'
import { POST as draftPoPost } from '@/app/api/reorder/draft-po/route'
import { PATCH as poPatch } from '@/app/api/purchase-orders/[id]/route'
import { POST as poReceive } from '@/app/api/purchase-orders/[id]/receive/route'

const RUN_ID = `r129-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const DAY = 86_400_000

const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  supplier: `${RUN_ID}-sup`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-item`,
  inventory: `${RUN_ID}-inv`,
}

const SUPPLIER_NAME = `Dobavitelj ${RUN_ID}`

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.location, name: 'R129 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: 'R129 Test Skladovnik', email: `${RUN_ID}@r129-test.local`, role: 'manager', status: 'active', locationId: IDS.location },
  })
  await db.supplier.create({ data: { id: IDS.supplier, name: SUPPLIER_NAME, code: `${RUN_ID}-S` } })
  await db.menu.create({ data: { id: IDS.menu, name: `R129 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R129 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R129 Test Moka', price: 2.5, categoryId: IDS.category, vatRate: 9.5 } })

  // Nizka zaloga (8 ≤ izpeljana točka naročila) + eksplicitni dobavitelj + lead 1 dan
  await db.inventoryItem.create({
    data: {
      id: IDS.inventory,
      name: 'R129 Test Moka (zaloga)',
      quantity: 8,
      minQuantity: 10,
      costPerUnit: 4.0,
      servingsPerUnit: 1,
      menuItemId: IDS.menuItem,
      locationId: IDS.location,
      supplier: SUPPLIER_NAME,
      leadTimeDays: 1,
    },
  })

  // Poraba zadnjih 6 dni: 5/dan prodaja + 2/dan priprave = 42 enot v 30-dnevnem oknu (1,4/dan)
  // (return/procurement NE smejo šteti: +4 return vrstica vmes)
  const now = Date.now()
  const txs: Array<{ daysAgo: number; type: string; qty: number }> = []
  for (let d = 1; d <= 6; d++) {
    txs.push({ daysAgo: d, type: 'sale', qty: -5 })
    txs.push({ daysAgo: d, type: 'batch-consumption', qty: -2 })
  }
  txs.push({ daysAgo: 3, type: 'return', qty: 4 })      // NE šteje se v porabo
  txs.push({ daysAgo: 2, type: 'procurement', qty: 20 }) // NE šteje se v porabo
  for (const t of txs) {
    await db.stockTransaction.create({
      data: {
        inventoryItemId: IDS.inventory,
        type: t.type,
        quantity: t.qty,
        previousQty: 8,
        newQty: 8 + t.qty,
        costPerUnit: 4.0,
        totalCost: Math.abs(t.qty) * 4.0,
        createdAt: new Date(now - t.daysAgo * DAY),
      },
    })
  }

  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['manage_inventory'] }
})

afterAll(async () => {
  // Čiščenje po FK redu
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: IDS.inventory } }).catch(() => {})
  const pos = await db.purchaseOrder.findMany({ where: { locationId: IDS.location }, select: { id: true } }).catch(() => [])
  for (const po of pos) {
    await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } }).catch(() => {})
    await db.purchaseOrder.delete({ where: { id: po.id } }).catch(() => {})
  }
  await db.inventoryItem.deleteMany({ where: { id: IDS.inventory } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.supplier.deleteMany({ where: { id: IDS.supplier } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R129 integracija: reorder → draft PO → prevzem → zaloga (canon §21 #6/#7)', () => {
  it('(a+b) GET /api/inventory/reorder — razložljiv predlog s pravilno porabo', async () => {
    const res = await reorderGet(new Request('http://local/api/inventory/reorder', { headers: { authorization: 'Bearer integration' } }))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const suggestions = body.suggestions as Array<Record<string, unknown>>
    const s = suggestions.find(x => x.itemId === IDS.inventory)
    expect(s).toBeDefined()
    // ADU: 6×5 sale + 6×2 batch-consumption = 42 enot porabe / 30-dnevno okno = 1,4/dan;
    // return (+4) in procurement (+20) NE štejeta (kanon CONSUMPTION_TX_TYPES)
    const adu = Number((s as Record<string, unknown>).avgDailyUsage)
    expect(adu).toBeGreaterThan(1.39)
    expect(adu).toBeLessThan(1.41)
    // Razložljivost: factors non-empty + status low + dataStatus sufficient
    expect(Array.isArray((s as Record<string, unknown>).factors)).toBe(true)
    expect(((s as Record<string, unknown>).factors as string[]).length).toBeGreaterThan(0)
    expect((s as Record<string, unknown>).status).toBe('low')
    expect((s as Record<string, unknown>).dataStatus).toBe('sufficient')
    expect(Number((s as Record<string, unknown>).suggestedQty)).toBeGreaterThan(0)
  })

  it('(e) dobavitelj brez Supplier zapisa → 400 SUPPLIER_NOT_FOUND (fail-closed)', async () => {
    // Začasno preimenuj supplier pri artikel, da FK pogača zgreši
    await db.inventoryItem.update({ where: { id: IDS.inventory }, data: { supplier: `Neobstojec ${RUN_ID}` } })
    try {
      const res = await draftPoPost(
        new Request('http://local/api/reorder/draft-po', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
          body: JSON.stringify({ itemIds: [IDS.inventory] }),
        }),
      )
      expect(res.status).toBe(400)
      const body = await asJson(res)
      expect(body.error).toBe('SUPPLIER_NOT_FOUND')
    } finally {
      await db.inventoryItem.update({ where: { id: IDS.inventory }, data: { supplier: SUPPLIER_NAME } })
    }
  })

  it('(c) POST /api/reorder/draft-po → draft PO z expectedDate + predlagano količino', async () => {
    const res = await draftPoPost(
      new Request('http://local/api/reorder/draft-po', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
        body: JSON.stringify({ itemIds: [IDS.inventory] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const orders = body.orders as Array<Record<string, unknown>>
    expect(orders.length).toBe(1)
    const po = orders[0]
    expect(String(po.poNumber)).toMatch(/^ND-\d{4}-\d{6}$/)
    expect(po.supplierName).toBe(SUPPLIER_NAME)
    expect(Number(po.itemCount)).toBe(1)
    expect(Number(po.totalAmount)).toBeGreaterThan(0)
    expect(po.expectedDate).toBeTruthy()
  })

  it('(d) draft → submitted → approved → prevzem → zaloga povišana + procurement tx', async () => {
    // Najdi draft PO
    const po = await db.purchaseOrder.findFirst({ where: { locationId: IDS.location, supplierId: IDS.supplier } })
    expect(po).toBeTruthy()
    const poId = po!.id

    // State machine: draft → submitted → approved
    const r1 = await poPatch(new Request(`http://local/api/purchase-orders/${poId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ status: 'submitted' }),
    }), { params: Promise.resolve({ id: poId }) })
    expect(r1.status).toBe(200)
    const r2 = await poPatch(new Request(`http://local/api/purchase-orders/${poId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ status: 'approved' }),
    }), { params: Promise.resolve({ id: poId }) })
    expect(r2.status).toBe(200)

    // Prevzem celotne količine prek kanona
    const item = await db.purchaseOrderItem.findFirst({ where: { purchaseOrderId: poId, inventoryItemId: IDS.inventory } })
    expect(item).toBeTruthy()
    const qty = Number(item!.quantityOrdered)
    const before = Number((await db.inventoryItem.findUnique({ where: { id: IDS.inventory } }))!.quantity)

    const rr = await poReceive(new Request(`http://local/api/purchase-orders/${poId}/receive`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer integration' },
      body: JSON.stringify({ receivedItems: [{ itemId: item!.id, quantityReceived: qty }], notes: 'R129 integracijski prevzem' }),
    }), { params: Promise.resolve({ id: poId }) })
    expect(rr.status).toBe(200)

    // Zaloga povišana TOČNO za količino
    const after = Number((await db.inventoryItem.findUnique({ where: { id: IDS.inventory } }))!.quantity)
    expect(after).toBe(before + qty)
    expect(po!.status).toBeTruthy()

    // Procurement tx z ledger trailom
    const tx = await db.stockTransaction.findFirst({
      where: { inventoryItemId: IDS.inventory, type: 'procurement', quantity: qty },
      orderBy: { createdAt: 'desc' },
    })
    expect(tx).toBeTruthy()
    expect(Number(tx!.newQty)).toBe(after)
  })
})
