// @vitest-environment node
// ============================================
// R130 / EPIC #115 P1-08 — INTEGRACIJA: SUPPLIER PRICE HISTORY (prava PGlite)
// ============================================
// Kanon P1-08 "Goods Receipt → Supplier → Price History → Recipe Cost →
// Margin" na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR; vzorca:
// r128-offline-exactly-once + r129-reorder-to-po):
//   1. PO → receive → zajem: PO z 2 postavkama (unitPrice 4.50 / 0) →
//      POST /receive → SupplierPriceHistory TOČNO 1 vrstica (ničelna
//      cena PRESKOČENA) z source 'goods_receipt', Decimal(12,4) cena,
//      pravilnimi FK-ji; zaloga se poveča (pariteta z R129)
//   2. Manual POST → stats: POST /api/inventory/price-history (source
//      'manual', novša observedAt) → GET ?inventoryItemId → count 2,
//      lastPrice = manual; kanon trenda: baseline 4.50 → probe 5.00 =
//      +11.11% > +5% → 'up' (dejansko kanonsko pričakovanje)
//   3. Recipes ?priceSource=supplier: costPerServingSupplier iz lastPrice
//      (5.00 × qty), priceSource 'supplier-history', marginPercent;
//      DEFAULT GET (brez parametra) → costPerServing iz costPerUnit,
//      NOVA polja NE obstajajo (nespremenjeno vedenje)
//   4. Reorder enrichment živ: artikel z zgodovino → unitPriceSource
//      'supplier-history' + unitPrice = lastPrice; artikel brez zgodovine
//      (ničelna cena zajema ni zapisala!) → 'item-cost' + costPerUnit
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route, prevzemni kanon z advisory lockom +
// Serializable, Decimal stats, enrichment) je REALNO nad PGlite.
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
import { POST as poReceive } from '@/app/api/purchase-orders/[id]/receive/route'
import { GET as priceHistoryGet, POST as priceHistoryPost } from '@/app/api/inventory/price-history/route'
import { GET as recipesGet } from '@/app/api/recipes/route'
import { GET as reorderGet } from '@/app/api/inventory/reorder/route'

const RUN_ID = `r130-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  supplier: `${RUN_ID}-sup`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-mi`,
  invA: `${RUN_ID}-inv-a`, // artikel Z zgodovino (prevzem + manual vnos)
  invB: `${RUN_ID}-inv-b`, // artikel BREZ zgodovine (ničelna cena preskočena)
  po: `${RUN_ID}-po`,
  poItemA: `${RUN_ID}-po-a`,
  poItemB: `${RUN_ID}-po-b`,
  recipe: `${RUN_ID}-ri`,
}

const SUPPLIER_NAME = `Dobavitelj ${RUN_ID}`
const MANUAL_OBSERVED_AT = new Date(Date.now() + 60_000).toISOString() // novša od prevzema → determinističen lastPrice

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function authedReq(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers)
  headers.set('authorization', 'Bearer integration')
  return new Request(url, { ...init, headers })
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.location, name: 'R130 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: 'R130 Test Skladovnik', email: `${RUN_ID}@r130-test.local`, role: 'manager', status: 'active', locationId: IDS.location },
  })
  await db.supplier.create({ data: { id: IDS.supplier, name: SUPPLIER_NAME, code: `${RUN_ID}-S` } })
  await db.menu.create({ data: { id: IDS.menu, name: `R130 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R130 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: 'R130 Test Pica', price: 9.5, categoryId: IDS.category, vatRate: 9.5 } })

  // Artikel A: prevzeta cena 4.50 + manual 5.00; nizka zaloga tudi po prevzemu
  // (quantity 4 + 10 = 14 < minQuantity 20 → reorder status 'low')
  await db.inventoryItem.create({
    data: {
      id: IDS.invA,
      name: 'R130 Moka tip 500',
      unit: 'kg',
      quantity: 4,
      minQuantity: 20,
      costPerUnit: 4.0,
      servingsPerUnit: 1,
      menuItemId: IDS.menuItem,
      locationId: IDS.location,
      supplier: SUPPLIER_NAME,
    },
  })
  // Artikel B: prevzem z unitPrice 0 (darilo) → zgodovina se NE zapiše
  await db.inventoryItem.create({
    data: {
      id: IDS.invB,
      name: 'R130 Vzorec darilo',
      unit: 'pcs',
      quantity: 1,
      minQuantity: 10,
      costPerUnit: 3.0,
      servingsPerUnit: 1,
      locationId: IDS.location,
      supplier: SUPPLIER_NAME,
    },
  })

  // Naročilnica z 2 postavkama: A @ 4.50/kg, B @ 0 (darilo/vzorec)
  await db.purchaseOrder.create({
    data: {
      id: IDS.po,
      poNumber: `${RUN_ID}-ND-1`,
      supplierId: IDS.supplier,
      status: 'approved',
      locationId: IDS.location,
      subtotal: 45,
      vatAmount: 9.9,
      totalAmount: 54.9,
      items: {
        create: [
          { id: IDS.poItemA, inventoryItemId: IDS.invA, description: 'R130 Moka 00', quantityOrdered: 10, quantityReceived: 0, unitPrice: 4.5, vatRate: 22, unit: 'kg', totalPrice: 45 },
          { id: IDS.poItemB, inventoryItemId: IDS.invB, description: 'R130 Darilo — vzorec', quantityOrdered: 5, quantityReceived: 0, unitPrice: 0, vatRate: 22, unit: 'pcs', totalPrice: 0 },
        ],
      },
    },
  })

  // Receptura: 0.2 kg moke na porcijo, yield 100 (brez izgube)
  await db.recipeItem.create({
    data: { id: IDS.recipe, menuItemId: IDS.menuItem, inventoryItemId: IDS.invA, quantityPerServing: 0.2, yieldPercent: 100, unit: 'kg' },
  })

  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['manage_inventory'] }
})

afterAll(async () => {
  // Čiščenje po FK redu (SupplierPriceHistory → Supplier je Restrict)
  await db.supplierPriceHistory.deleteMany({ where: { inventoryItemId: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.recipeItem.deleteMany({ where: { menuItemId: IDS.menuItem } }).catch(() => {})
  await db.accountsPayable.deleteMany({ where: { supplierId: IDS.supplier } }).catch(() => {})
  await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: IDS.po } }).catch(() => {})
  await db.purchaseOrder.deleteMany({ where: { id: IDS.po } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.supplier.deleteMany({ where: { id: IDS.supplier } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R130 integracija: PO → price history → stats → recipes → reorder', () => {
  it('(1) PO → receive → zajem: TOČNO 1 vrstica (ničelna cena preskočena) + zaloga povišana', async () => {
    const poItemA = await db.purchaseOrderItem.findUnique({ where: { id: IDS.poItemA } })
    const poItemB = await db.purchaseOrderItem.findUnique({ where: { id: IDS.poItemB } })
    expect(poItemA).toBeTruthy()
    expect(poItemB).toBeTruthy()

    const beforeA = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invA } }))!.quantity)
    const beforeB = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invB } }))!.quantity)

    // Prevzem OBIH postavk (B ima unitPrice 0 — zajem se mora preskočiti, prevzem NE pasti)
    const rr = await poReceive(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/receive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          receivedItems: [
            { itemId: poItemA!.id, quantityReceived: 10 },
            { itemId: poItemB!.id, quantityReceived: 5 },
          ],
          notes: 'R130 integracijski prevzem',
        }),
      }),
      { params: Promise.resolve({ id: IDS.po }) },
    )
    expect(rr.status).toBe(200)

    // Pariteta z R129: zaloga se poveča TOČNO za prevzete količine
    const afterA = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invA } }))!.quantity)
    const afterB = Number((await db.inventoryItem.findUnique({ where: { id: IDS.invB } }))!.quantity)
    expect(afterA).toBe(beforeA + 10)
    expect(afterB).toBe(beforeB + 5)

    // Zajem cene: TOČNO 1 vrstica za to naročilnicо (ničelna postavka B preskočena)
    const hist = await db.supplierPriceHistory.findMany({ where: { purchaseOrderId: IDS.po } })
    expect(hist).toHaveLength(1)
    const row = hist[0]
    expect(row.source).toBe('goods_receipt')
    expect(row.supplierId).toBe(IDS.supplier)
    expect(row.inventoryItemId).toBe(IDS.invA)
    // Decimal(12,4) — cena v bazi na 4 decimalki ('4.5000'), Decimal.toString → '4.5'
    expect(Number(row.unitPrice)).toBe(4.5)
    expect((row.unitPrice as { toFixed: (n: number) => string }).toFixed(4)).toBe('4.5000')
    expect(row.purchaseOrderId).toBe(IDS.po)
    expect(row.unit).toBe('kg')
    expect(row.locationId).toBe(IDS.location)

    // Artikel B (unitPrice 0) NIMA nobene zgodovine
    const histB = await db.supplierPriceHistory.findMany({ where: { inventoryItemId: IDS.invB } })
    expect(histB).toHaveLength(0)
  })

  it('(2) Manual POST → GET stats: count 2, lastPrice manual, trend up (+11.11% > +5%)', async () => {
    // 2. cena ročno (source 'manual', novša observedAt → determinističen probe)
    const pr = await priceHistoryPost(
      authedReq('http://local/api/inventory/price-history', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          supplierId: IDS.supplier,
          inventoryItemId: IDS.invA,
          unitPrice: 5.0,
          observedAt: MANUAL_OBSERVED_AT,
          note: 'R130 ročni vnos',
        }),
      }),
    )
    expect(pr.status).toBe(201)
    const pbody = await asJson(pr)
    const prow = pbody.row as Record<string, unknown>
    expect(prow.source).toBe('manual')
    expect(Number(prow.unitPrice)).toBe(5)
    expect(prow.observedAt).toBe(MANUAL_OBSERVED_AT)

    // Stats čez GET
    const gr = await priceHistoryGet(authedReq(`http://local/api/inventory/price-history?inventoryItemId=${IDS.invA}`))
    expect(gr.status).toBe(200)
    const gbody = await asJson(gr)
    const stats = gbody.stats as Record<string, unknown>
    expect(stats.count).toBe(2)
    expect(Number(stats.lastPrice)).toBe(5)
    expect(stats.lastAt).toBe(MANUAL_OBSERVED_AT)
    // Kanonsko pričakovanje: baseline 4.50 (goods_receipt) → probe 5.00 (manual)
    // → (5 − 4.5)/4.5 × 100 = +11.11% > +5% → trend 'up'
    expect(stats.trend).toBe('up')
    // avg30 = (4.5 + 5)/2 = 4.75
    expect(Number(stats.avg30)).toBeCloseTo(4.75, 6)

    // Rows DESC: manual prvi, goods_receipt drugi (s FK na PO)
    const rows = gbody.rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].source).toBe('manual')
    expect(rows[1].source).toBe('goods_receipt')
    expect(rows[1].purchaseOrderId).toBe(IDS.po)
    expect(rows[1].supplierName).toBe(SUPPLIER_NAME)
  })

  it('(3) Recipes ?priceSource=supplier: costPerServingSupplier iz lastPrice + margin; default GET nespremenjen', async () => {
    const rs = await recipesGet(authedReq('http://local/api/recipes?priceSource=supplier'))
    expect(rs.status).toBe(200)
    const rbody = await asJson(rs)
    const recipes = rbody.recipes as Array<Record<string, unknown>>
    const line = recipes.find(r => r.inventoryItemId === IDS.invA)
    expect(line).toBeTruthy()

    expect(line!.priceSource).toBe('supplier-history')
    expect(line!.priceAsOf).toBe(MANUAL_OBSERVED_AT) // zadnja cena = manual vnos
    // yield 100 → RAW = usable → strošek = lastPrice(5.00) × qty(0.2) = 1.0
    expect(Number(line!.costPerServingSupplier)).toBeCloseTo(1.0, 6)
    // bazni costPerServing ostane iz item.costPerUnit (4.0 × 0.2 = 0.8)
    expect(Number(line!.costPerServing)).toBeCloseTo(0.8, 6)
    // marža: (9.5 − 1.0)/9.5 × 100 = 89.47…% → '89.5'
    expect(String(line!.marginPercent)).toBe('89.5')

    // DEFAULT GET (brez parametra) — vedenje NESESPEMJENO spremenjeno:
    // costPerServing iz costPerUnit, NOVA polja ne obstajajo
    const rd = await recipesGet(authedReq('http://local/api/recipes'))
    expect(rd.status).toBe(200)
    const dbody = await asJson(rd)
    const dlines = dbody.recipes as Array<Record<string, unknown>>
    const dline = dlines.find(r => r.inventoryItemId === IDS.invA)
    expect(dline).toBeTruthy()
    expect(Number(dline!.costPerServing)).toBeCloseTo(0.8, 6)
    expect(dline!).not.toHaveProperty('priceSource')
    expect(dline!).not.toHaveProperty('priceAsOf')
    expect(dline!).not.toHaveProperty('costPerServingSupplier')
    expect(dline!).not.toHaveProperty('marginPercent')
  })

  it('(4) Reorder enrichment živ: z zgodovino → supplier-history (lastPrice); brez → item-cost (back-compat)', async () => {
    const res = await reorderGet(authedReq('http://local/api/inventory/reorder'))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const suggestions = body.suggestions as Array<Record<string, unknown>>

    // Artikel A: ima zgodovino (prevzem 4.50 + manual 5.00 → last 5.00)
    const withHist = suggestions.find(x => x.itemId === IDS.invA)
    expect(withHist).toBeTruthy()
    expect(withHist!.unitPriceSource).toBe('supplier-history')
    expect(Number(withHist!.unitPrice)).toBe(5) // zadnja cena, NE costPerUnit 4.0
    expect(typeof withHist!.unitPriceAsOf).toBe('string')
    expect(withHist!.unitPriceAsOf).toBe(MANUAL_OBSERVED_AT)
    // back-compat polje ostane iz artikla
    expect(Number(withHist!.costPerUnit)).toBe(4)
    // status low (14 < reorderPoint 20) + insufficient (brez porabnih tx)
    expect(withHist!.status).toBe('low')

    // Artikel B: prevzem z unitPrice 0 → NI zgodovine → item-cost (KRITIČNA back-compat)
    const noHist = suggestions.find(x => x.itemId === IDS.invB)
    expect(noHist).toBeTruthy()
    expect(noHist!.unitPriceSource).toBe('item-cost')
    expect(Number(noHist!.unitPrice)).toBe(3) // = costPerUnit
    expect(noHist!.unitPriceAsOf).toBeNull()
  })
})
