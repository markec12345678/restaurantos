// @vitest-environment node
// ============================================
// R132 / EPIC #115 P1-12 — INTEGRACIJA: PO → GRN (PREVZEM Z ZAVRNITVO) →
// SUPPLIER INVOICE → THREE-WAY MATCH (prava PGlite)
// ============================================
// Kanon P1-12 "PO (naročeno) ↔ GRN (sprejeto + zavrnjeno) ↔ Supplier invoice
// (zaračunano)" na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR; vzorec:
// r131-supplier-catalog-drill):
//   1. Prevzem z zavrnitvijo: A 9 sprejeto + 1 zavrnjeno, B 5 sprejeto →
//      GRN dokument (GR-YYYY-NNNNNN) + linije, zaloga SAMO accepted,
//      ledger accepted-only forenzika, price history accepted-only,
//      POItem.quantityRejected kumuliran, PO 'partial'
//   2. GET receipts: dokumentiran prevzem (dobavnica) živ
//   3. Nadomestni prevzem (AMANDMA kanona #2: rejected NE porabi kapacitete):
//      A +1 → 10/10, rejected ostane 1, PO 'received' → avto-AP placeholder
//   4. POST invoice: realna številka računa + linije → placeholder AP se
//      POSODOBI (brez dvojnega AP), per-line variance (price + qty),
//      roll-up 'variance', price history NI prepisana, audit
//   5. Idempotenten re-POST (popravljen račun) → 'matched' / 'invoiced'
//   6. GET invoice: živo poročilo
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (route, prevzemni kanon z advisory lockom +
// Serializable, match matematika, Decimal, audit hash-chain) je REALNO na
// PGlite.
// Zagon: PGLITE_DATA_DIR=/tmp/pglite-data-it bun run db:init-pglite
//        → PGLITE_DATA_DIR=/tmp/pglite-data-it bunx vitest run
//          tests/integration/r132-recon-drill.test.ts
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
import { POST as poReceive } from '@/app/api/purchase-orders/[id]/receive/route'
import { GET as receiptsGet } from '@/app/api/purchase-orders/[id]/receipts/route'
import { POST as invoicePost, GET as invoiceGet } from '@/app/api/purchase-orders/[id]/invoice/route'

const RUN_ID = `r132-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const YEAR = new Date().getFullYear()

const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  supplier: `${RUN_ID}-sup`,
  invA: `${RUN_ID}-inv-a`, // kg, legacy base-unit
  invB: `${RUN_ID}-inv-b`, // kos, legacy base-unit
  po: `${RUN_ID}-po`,
}

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
  await db.location.create({ data: { id: IDS.location, name: 'R132 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: 'R132 Test Skladovnik', email: `${RUN_ID}@r132-test.local`, role: 'manager', status: 'active', locationId: IDS.location },
  })
  await db.supplier.create({ data: { id: IDS.supplier, name: `Dobavitelj ${RUN_ID}`, code: `${RUN_ID}-S` } })

  await db.inventoryItem.create({
    data: { id: IDS.invA, name: 'R132 Moka tip 500', unit: 'kg', quantity: 10, minQuantity: 5, costPerUnit: 4.5, servingsPerUnit: 1, locationId: IDS.location },
  })
  await db.inventoryItem.create({
    data: { id: IDS.invB, name: 'R132 Papirnate brisače', unit: 'kos', quantity: 20, minQuantity: 10, costPerUnit: 2.0, servingsPerUnit: 1, locationId: IDS.location },
  })

  // PO direktno v bazi (drill testira prevzem/račun, ne kreacije naročila —
  // ta je pokrita v r129/r131 integracijah): A 10 kg @ 4.50, B 5 kos @ 2.00
  await db.purchaseOrder.create({
    data: {
      id: IDS.po,
      poNumber: `ND-${YEAR}-013200`,
      supplierId: IDS.supplier,
      status: 'approved',
      locationId: IDS.location,
      subtotal: 55,
      vatAmount: 12.1,
      totalAmount: 67.1,
      items: {
        create: [
          { id: `${IDS.po}-i-a`, inventoryItemId: IDS.invA, description: 'R132 Moka tip 500', quantityOrdered: 10, unit: 'kg', unitPrice: 4.5, vatRate: 22, totalPrice: 45 },
          { id: `${IDS.po}-i-b`, inventoryItemId: IDS.invB, description: 'R132 Papirnate brisače', quantityOrdered: 5, unit: 'kos', unitPrice: 2.0, vatRate: 22, totalPrice: 10 },
        ],
      },
    },
  })

  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['manage_inventory', 'view_reports'] }
})

afterAll(async () => {
  // Čiščenje po FK redu (GRN/AP linije → glave → PO → artikel → dobavitelj)
  await db.accountsPayableLine.deleteMany({ where: { accountsPayable: { purchaseOrderId: IDS.po } } }).catch(() => {})
  await db.accountsPayable.deleteMany({ where: { purchaseOrderId: IDS.po } }).catch(() => {})
  await db.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { purchaseOrderId: IDS.po } } }).catch(() => {})
  await db.goodsReceipt.deleteMany({ where: { purchaseOrderId: IDS.po } }).catch(() => {})
  await db.supplierPriceHistory.deleteMany({ where: { inventoryItemId: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.auditLog.deleteMany({ where: { entityId: { in: [IDS.po, `${IDS.po}-i-a`, `${IDS.po}-i-b`] } } }).catch(() => {})
  await db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: IDS.po } }).catch(() => {})
  await db.purchaseOrder.deleteMany({ where: { id: IDS.po } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: { in: [IDS.invA, IDS.invB] } } }).catch(() => {})
  await db.supplier.deleteMany({ where: { id: IDS.supplier } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R132 integracija: prevzem z zavrnitvo → GRN → račun dobavitelja → three-way match', () => {
  it('(1) Prevzem z zavrnitvijo: A 9 sprejeto + 1 zavrnjeno, B 5 → GRN dokument, zaloga/ledger/PH accepted-only, PO partial', async () => {
    const rr = await poReceive(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/receive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          receivedItems: [
            { itemId: `${IDS.po}-i-a`, quantityReceived: 9, quantityRejected: 1, rejectReason: 'Poškodovana embalaža' },
            { itemId: `${IDS.po}-i-b`, quantityReceived: 5 },
          ],
          supplierDocNumber: 'DOB-2026-77',
          notes: 'R132 drill prevzem',
        }),
      }),
      params(IDS.po),
    )
    expect(rr.status).toBe(200)
    const body = await asJson(rr)
    const grn = body.grn as Record<string, unknown>
    expect(grn.grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(grn.supplierDocNumber).toBe('DOB-2026-77')
    expect(grn.status).toBe('confirmed')

    // Zaloga: samo accepted — A 10 + 9 = 19 (NE 20), B 20 + 5 = 25
    expect(Number((await db.inventoryItem.findUnique({ where: { id: IDS.invA } }))!.quantity)).toBe(19)
    expect(Number((await db.inventoryItem.findUnique({ where: { id: IDS.invB } }))!.quantity)).toBe(25)

    // PO postavke: accepted + rejected ločeno, status partial (A 9/10)
    const po = await db.purchaseOrder.findUnique({ where: { id: IDS.po }, include: { items: true } })
    const lineA = po!.items.find(i => i.id === `${IDS.po}-i-a`)!
    const lineB = po!.items.find(i => i.id === `${IDS.po}-i-b`)!
    expect(Number(lineA.quantityReceived)).toBe(9)
    expect(Number(lineA.quantityRejected)).toBe(1)
    expect(Number(lineB.quantityReceived)).toBe(5)
    expect(Number(lineB.quantityRejected)).toBe(0)
    expect(po!.status).toBe('partial')

    // Ledger: accepted-only forenzika (A: 9 @ 4.5 = 40.5)
    const txA = await db.stockTransaction.findFirst({ where: { inventoryItemId: IDS.invA, type: 'procurement' }, orderBy: { createdAt: 'desc' } })
    expect(Number(txA!.quantity)).toBe(9)
    expect(Number(txA!.previousQty)).toBe(10)
    expect(Number(txA!.newQty)).toBe(19)
    expect(Number(txA!.totalCost)).toBe(40.5)

    // GRN dokument v bazi: 2 liniji z zavrnitveno forenziko
    const grnRow = await db.goodsReceipt.findUnique({
      where: { grnNumber: String(grn.grnNumber) },
      include: { items: true },
    })
    expect(grnRow).toBeTruthy()
    expect(grnRow!.receivedById).toBe(IDS.employee)
    expect(grnRow!.receivedByName).toBe('R132 Test Skladovnik')
    expect(grnRow!.locationId).toBe(IDS.location)
    expect(grnRow!.items).toHaveLength(2)
    const grnLineA = grnRow!.items.find(i => i.purchaseOrderItemId === `${IDS.po}-i-a`)!
    expect(Number(grnLineA.quantityAccepted)).toBe(9)
    expect(Number(grnLineA.quantityRejected)).toBe(1)
    expect(grnLineA.rejectReason).toBe('Poškodovana embalaža')
    expect(Number(grnLineA.unitPriceOrdered)).toBe(4.5)

    // Price history: accepted-only (vrstica A 4.5/kg) — zavrnjeno NE vstopa
    const phA = await db.supplierPriceHistory.findFirst({ where: { inventoryItemId: IDS.invA, purchaseOrderId: IDS.po } })
    expect(phA).toBeTruthy()
    expect(Number(phA!.unitPrice)).toBe(4.5)
    expect(phA!.source).toBe('goods_receipt')

    // Audit: PURCHASE_ORDER_RECEIVED z grnNumber + rejectedItems
    const audit = await db.auditLog.findFirst({ where: { action: 'PURCHASE_ORDER_RECEIVED', entityId: IDS.po }, orderBy: { timestamp: 'desc' } })
    expect(audit).toBeTruthy()
    const details = JSON.parse(audit!.details) as Record<string, unknown>
    expect(details.grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(details.supplierDocNumber).toBe('DOB-2026-77')
    expect(Array.isArray(details.rejectedItems)).toBe(true)
  })

  it('(2) GET receipts: prevzemni dokumenti živi (dobavnica + linije)', async () => {
    const res = await receiptsGet(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/receipts`),
      params(IDS.po),
    )
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const receipts = body.receipts as Array<Record<string, unknown>>
    expect(receipts).toHaveLength(1)
    expect(receipts[0].grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(receipts[0].supplierDocNumber).toBe('DOB-2026-77')
    expect(receipts[0].receivedByName).toBe('R132 Test Skladovnik')
    const items = receipts[0].items as Array<Record<string, unknown>>
    expect(items).toHaveLength(2)
    expect(Number(items[0].quantityAccepted) + Number(items[1].quantityAccepted)).toBe(14) // 9 + 5
    expect(Number(items[0].quantityRejected) + Number(items[1].quantityRejected)).toBe(1)
  })

  it('(3) Nadomestni prevzem (amandma #2): A +1 → 10/10, rejected ostane 1, PO received → avto-AP placeholder', async () => {
    const rr = await poReceive(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/receive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          receivedItems: [{ itemId: `${IDS.po}-i-a`, quantityReceived: 1 }],
        }),
      }),
      params(IDS.po),
    )
    expect(rr.status).toBe(200)
    const body = await asJson(rr)
    expect((body.grn as Record<string, unknown>).grnNumber).toBe(`GR-${YEAR}-000002`)

    const po = await db.purchaseOrder.findUnique({ where: { id: IDS.po }, include: { items: true } })
    const lineA = po!.items.find(i => i.id === `${IDS.po}-i-a`)!
    expect(Number(lineA.quantityReceived)).toBe(10) // 9 + 1 nadomestilo
    expect(Number(lineA.quantityRejected)).toBe(1) // dokumentacija ostane
    expect(po!.status).toBe('received')

    // Zaloga A: 19 + 1 = 20
    expect(Number((await db.inventoryItem.findUnique({ where: { id: IDS.invA } }))!.quantity)).toBe(20)

    // Avto-AP placeholder (kanon R105 PO-2): invoiceNumber = poNumber, unmatched
    const ap = await db.accountsPayable.findFirst({ where: { purchaseOrderId: IDS.po } })
    expect(ap).toBeTruthy()
    expect(ap!.invoiceNumber).toBe(po!.poNumber)
    expect(ap!.matchStatus).toBe('unmatched')
  })

  it('(4) POST invoice: realna številka + linije → placeholder UPDATE (brez dvojnega AP), variance price + qty, roll-up, price history NI prepisana', async () => {
    const res = await invoicePost(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/invoice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: 'RA-2026-555',
          invoiceDate: '2026-09-25',
          dueDate: '2026-10-25',
          notes: 'R132 drill račun',
          lines: [
            { poItemId: `${IDS.po}-i-a`, quantityInvoiced: 10, unitPriceInvoiced: 4.6, vatRate: 22 }, // +2.22 % cena
            { poItemId: `${IDS.po}-i-b`, quantityInvoiced: 6, unitPriceInvoiced: 2.0, vatRate: 22 },  // 6 > 5 sprejeto
          ],
        }),
      }),
      params(IDS.po),
    )
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const match = body.match as Record<string, unknown>
    expect(match.matchStatus).toBe('variance')

    const lines = match.lines as Array<Record<string, unknown>>
    const lineA = lines.find(l => l.poItemId === `${IDS.po}-i-a`)!
    const lineB = lines.find(l => l.poItemId === `${IDS.po}-i-b`)!
    expect(lineA.varianceStatus).toBe('variance_price')
    expect(lineA.priceVariancePct).toBe(2.22)
    expect(String(lineA.varianceNote)).toContain('Račun: 4,60 €/kg')
    expect(lineB.varianceStatus).toBe('variance_qty')
    expect(Number(lineB.quantityAccepted)).toBe(5)
    expect(Number(lineB.quantityInvoiced)).toBe(6)

    // AP: TOČNO 1 obveznost — placeholder posodobljen (apNumber ostane),
    // denar iz linij (46 + 12 = 58; DDV 10.12 + 2.64 = 12.76)
    const aps = await db.accountsPayable.findMany({ where: { purchaseOrderId: IDS.po } })
    expect(aps).toHaveLength(1)
    const ap = aps[0]
    expect(ap.invoiceNumber).toBe('RA-2026-555')
    expect(ap.matchStatus).toBe('variance')
    expect(Number(ap.subtotal)).toBe(58)
    expect(Number(ap.vatAmount)).toBe(12.76)
    expect(Number(ap.totalAmount)).toBe(70.76)
    const apLines = await db.accountsPayableLine.findMany({ where: { accountsPayableId: ap.id } })
    expect(apLines).toHaveLength(2)
    expect(apLines.find(l => l.purchaseOrderItemId === `${IDS.po}-i-a`)!.varianceStatus).toBe('variance_price')

    // Roll-up: PO.invoiceStatus = variance
    expect((await db.purchaseOrder.findUnique({ where: { id: IDS.po } }))!.invoiceStatus).toBe('variance')

    // Price history se iz računa NE prepisuje (kanon #6): 2 vrstici (po ena
    // ob vsakem prevzemu — step 1 + step 3), obe še vedno @ 4.5 goods_receipt
    const phA = await db.supplierPriceHistory.findMany({ where: { inventoryItemId: IDS.invA } })
    expect(phA).toHaveLength(2)
    for (const ph of phA) {
      expect(ph.source).toBe('goods_receipt')
      expect(Number(ph.unitPrice)).toBe(4.5)
    }

    // Audit
    const audit = await db.auditLog.findFirst({ where: { action: 'SUPPLIER_INVOICE_RECORDED', entityType: 'AccountsPayable' }, orderBy: { timestamp: 'desc' } })
    expect(audit).toBeTruthy()
    const details = JSON.parse(audit!.details) as Record<string, unknown>
    expect(details.invoiceNumber).toBe('RA-2026-555')
    expect(details.varianceLines).toBe(2)
  })

  it('(5) Idempotenten re-POST (popravljen račun) → matched / invoiced, še vedno 1 AP', async () => {
    const res = await invoicePost(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/invoice`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: 'RA-2026-555',
          invoiceDate: '2026-09-25',
          dueDate: '2026-10-25',
          lines: [
            { poItemId: `${IDS.po}-i-a`, quantityInvoiced: 10, unitPriceInvoiced: 4.5, vatRate: 22 },
            { poItemId: `${IDS.po}-i-b`, quantityInvoiced: 5, unitPriceInvoiced: 2.0, vatRate: 22 },
          ],
        }),
      }),
      params(IDS.po),
    )
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const match = body.match as Record<string, unknown>
    expect(match.matchStatus).toBe('matched')

    expect(await db.accountsPayable.count({ where: { purchaseOrderId: IDS.po } })).toBe(1)
    const ap = await db.accountsPayable.findFirst({ where: { purchaseOrderId: IDS.po } })
    expect(Number(ap!.subtotal)).toBe(55)
    expect(Number(ap!.vatAmount)).toBe(12.1)
    expect(Number(ap!.totalAmount)).toBe(67.1)
    expect(ap!.matchStatus).toBe('matched')
    expect(await db.accountsPayableLine.count({ where: { accountsPayableId: ap!.id } })).toBe(2)
    expect((await db.purchaseOrder.findUnique({ where: { id: IDS.po } }))!.invoiceStatus).toBe('invoiced')
  })

  it('(6) GET invoice: živo poročilo (matched report + AP z linijami)', async () => {
    const res = await invoiceGet(
      authedReq(`http://local/api/purchase-orders/${IDS.po}/invoice`),
      params(IDS.po),
    )
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const match = body.match as Record<string, unknown>
    expect(match.matchStatus).toBe('matched')
    expect((match.lines as Array<Record<string, unknown>>)).toHaveLength(2)
    expect(match.totals).toMatchObject({ ordered: 15, accepted: 15, invoiced: 15 })
    const ap = body.accountsPayable as Record<string, unknown>
    expect(ap.invoiceNumber).toBe('RA-2026-555')
    expect(Array.isArray(ap.lines)).toBe(true)
  })
})
