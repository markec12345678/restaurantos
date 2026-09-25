// ============================================
// R132 / EPIC #115 P1-12 — GRN V PREVZEMNEM KANONU (trap DB)
// ============================================
// Trap DB (hišni stil, vzorec r131-receive-pack-conversion):
// createDb + vi.hoisted + vi.mock('@/lib/db'); testira PRODUKCIJSKO route
// funkcijo POST /api/purchase-orders/[id]/receive → receivePurchaseOrderItems
// kanon (Serializable + advisory lock + tx-fresh).
//
// Kanon P1-12: vsak prevzem ustvari GoodsReceipt dokument + linije v ISTEM tx
// (tudi legacy delni). quantityReceived ostane SPREJETA količina; NOVO
// quantityRejected kumulira zavrnjene (NE vstopi v zalogo); cap-check:
// accepted + rejected ≤ ordered. Brez rejected polj je vedenje BIT-FOR-BIT
// staro (zaloga/ledger/price-history/AP asercije = pariteta R131).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const PO_ID = 'po-r132'
const EMP_1 = 'emp-1'
const EMP_NAME = 'Miha Skladovnik'
const SUP_1 = 'sup-1'
const YEAR = new Date().getFullYear()

// ---------- Trap stanje ----------
interface PoItemRow {
  id: string
  inventoryItemId: string | null
  description: string
  quantityOrdered: number
  quantityReceived: number
  quantityRejected: number
  unit: string
  unitPrice: number
  vatRate: number
  totalPrice: number
  status: string
  packQty: number | null
  packUnit: string | null
}
interface InvRow { id: string; quantity: number; unit: string }
interface PoRow {
  id: string
  poNumber: string
  supplierId: string
  locationId: string
  status: string
  subtotal: number
  vatAmount: number
  totalAmount: number
  supplier: { id: string; name: string }
  items: PoItemRow[]
}
interface GrnRow extends Record<string, unknown> { items?: Array<Record<string, unknown>> }

function createDb() {
  const pos: PoRow[] = []
  const inventory: InvRow[] = []
  const stockTxs: Array<Record<string, unknown>> = []
  const priceHistory: Array<Record<string, unknown>> = []
  const ap: Array<Record<string, unknown>> = []
  const grns: GrnRow[] = []
  const employees = new Map<string, string>()
  let grnSeq = 0
  let failGrnCreateP2002 = false
  const captured = {
    invUpdates: [] as Array<{ id: string; increment: number }>,
    poiUpdates: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
  }

  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    purchaseOrder: {
      findFirst: async ({ where }: { where?: { id?: string; locationId?: string } } = {}) => {
        const po = pos.find(p =>
          (where?.id === undefined || p.id === where.id) &&
          (where?.locationId === undefined || p.locationId === where.locationId))
        return po ? structuredClone(po) : null
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const po = pos.find(p => p.id === where.id)
        return po ? structuredClone(po) : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const po = pos.find(p => p.id === where.id)
        if (!po) throw new Error('PO not found')
        if (data.status !== undefined) po.status = data.status as string
        if (data.invoiceStatus !== undefined) {
          ;(po as unknown as Record<string, unknown>).invoiceStatus = data.invoiceStatus
        }
        return structuredClone(po)
      },
    },
    purchaseOrderItem: {
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.poiUpdates.push({ id: where.id, data })
        for (const po of pos) {
          const row = po.items.find(i => i.id === where.id)
          if (row) {
            if (data.quantityReceived !== undefined) row.quantityReceived = data.quantityReceived as number
            if (data.quantityRejected !== undefined) row.quantityRejected = data.quantityRejected as number
            if (data.status !== undefined) row.status = data.status as string
            return { ...row }
          }
        }
        throw new Error('PO item not found')
      },
    },
    inventoryItem: {
      update: async ({ where, data }: { where: { id: string }; data: { quantity?: { increment: number } } }) => {
        const inv = inventory.find(i => i.id === where.id)
        if (!inv) throw new Error('Inventory item not found')
        const increment = data.quantity && typeof data.quantity === 'object' && 'increment' in data.quantity
          ? (data.quantity.increment as number)
          : 0
        captured.invUpdates.push({ id: where.id, increment })
        inv.quantity += increment
        return { ...inv }
      },
    },
    stockTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        stockTxs.push({ ...data })
        return { id: `st-${stockTxs.length}`, ...data }
      },
    },
    supplierPriceHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        priceHistory.push({ ...data })
        return { id: `ph-${priceHistory.length}`, ...data }
      },
    },
    // R132 kanon #3: GRN count + create (nested items.create)
    goodsReceipt: {
      count: async ({ where }: { where?: { grnNumber?: { startsWith?: string } } } = {}) => {
        const prefix = where?.grnNumber?.startsWith ?? 'GR-'
        return grns.filter(g => String(g.grnNumber).startsWith(prefix)).length
      },
      create: async ({ data }: { data: GrnRow }) => {
        if (failGrnCreateP2002) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`GoodsReceipt.grnNumber`)',
            { code: 'P2002', clientVersion: '5.22.0' },
          )
        }
        grnSeq += 1
        const row: GrnRow = { id: `gr-${grnSeq}`, ...data }
        const nested = (data.items as { create?: Array<Record<string, unknown>> } | undefined)?.create ?? []
        row.items = nested.map((it, idx) => ({ id: `gri-${grnSeq}-${idx + 1}`, goodsReceiptId: row.id, ...it }))
        grns.push(row)
        return { ...row }
      },
    },
    accountsPayable: {
      findFirst: async ({ where }: { where?: { purchaseOrderId?: string } } = {}) => {
        return ap.find(a => a.purchaseOrderId === where?.purchaseOrderId) ?? null
      },
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        ap.push({ ...data })
        return { id: `ap-${ap.length}`, ...data }
      },
    },
  }

  const db = {
    ...tx,
    employee: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const name = employees.get(where.id)
        return name !== undefined ? { name } : null
      },
    },
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  }

  return { db, pos, inventory, stockTxs, priceHistory, ap, grns, employees, captured, setGrnFail: (v: boolean) => { failGrnCreateP2002 = v }, resetGrnSeq: () => { grnSeq = 0 } }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
type DbState = ReturnType<typeof createDb>
const ref = vi.hoisted(() => ({ current: null as unknown as DbState }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  audits: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async (args: Record<string, unknown>) => {
    m.audits.push(args)
  },
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
    // resolveTenantLocationIdOrThrow ostane REALEN
  }
})

import { POST as receivePost } from '@/app/api/purchase-orders/[id]/receive/route'
import { handleReceiveAction } from '@/app/api/purchase-orders/[id]/_helpers'

const state = ref.current

// ---------- Seed ----------
const PACK_ITEM = 'poi-pack'     // packQty 25, unitPrice 45/paket, unit 'vrečka'
const LEGACY_ITEM = 'poi-legacy' // packQty null, unitPrice 4.5/kg, unit 'kg'
const INV_PACK = 'inv-pack'
const INV_LEGACY = 'inv-legacy'

function seedBase() {
  state.pos.length = 0
  state.inventory.length = 0
  state.stockTxs.length = 0
  state.priceHistory.length = 0
  state.ap.length = 0
  state.grns.length = 0
  state.resetGrnSeq()
  state.setGrnFail(false)
  state.employees.clear()
  state.captured.invUpdates.length = 0
  state.captured.poiUpdates.length = 0
  m.audits.length = 0

  state.employees.set(EMP_1, EMP_NAME)
  state.inventory.push(
    { id: INV_PACK, quantity: 10, unit: 'kg' },
    { id: INV_LEGACY, quantity: 5, unit: 'kg' },
  )
  state.pos.push({
    id: PO_ID,
    poNumber: 'ND-2026-000132',
    supplierId: SUP_1,
    locationId: LOC_1,
    status: 'approved',
    subtotal: 135,
    vatAmount: 29.7,
    totalAmount: 164.7,
    supplier: { id: SUP_1, name: 'Dobavitelj 1' },
    items: [
      {
        id: PACK_ITEM,
        inventoryItemId: INV_PACK,
        description: 'Moka tip 500 (vrečka 25 kg)',
        quantityOrdered: 4,
        quantityReceived: 0,
        quantityRejected: 0,
        unit: 'vrečka',
        unitPrice: 45,
        vatRate: 22,
        totalPrice: 180,
        status: 'pending',
        packQty: 25,
        packUnit: 'vrečka',
      },
      {
        id: LEGACY_ITEM,
        inventoryItemId: INV_LEGACY,
        description: 'Sladkor (kg)',
        quantityOrdered: 10,
        quantityReceived: 0,
        quantityRejected: 0,
        unit: 'kg',
        unitPrice: 4.5,
        vatRate: 22,
        totalPrice: 45,
        status: 'pending',
        packQty: null,
        packUnit: null,
      },
    ],
  })
}

function authSession(opts?: { role?: string; permissions?: string[]; locationId?: string | null; authed?: boolean }) {
  if (opts?.authed === false) {
    m.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), { status: 401 }),
    })
    return
  }
  if (opts?.permissions !== undefined && opts.permissions.length === 0) {
    m.requireAuth.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Nimate dovoljenja.' }), { status: 403 }),
    })
    return
  }
  m.requireAuth.mockResolvedValue({
    session: {
      employeeId: EMP_1,
      locationId: opts?.locationId !== undefined ? opts.locationId : LOC_1,
      role: opts?.role ?? 'manager',
      permissions: opts?.permissions ?? ['manage_inventory'],
    },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  authSession()
})

interface RecLine { itemId: string; quantityReceived: number; quantityRejected?: number; rejectReason?: string }

function receiveReq(receivedItems: RecLine[], extra: Record<string, unknown> = {}): Request {
  return new Request(`http://local/api/purchase-orders/${PO_ID}/receive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ receivedItems, ...extra }),
  })
}

function routeParams(id = PO_ID) {
  return { params: Promise.resolve({ id }) }
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ============================================
// A. GRN dokument — kreacija, številčenje, linije
// ============================================
describe('R132 receive — GRN dokument', () => {
  it('(A1) full receive → GRN confirmed + linije + grnNumber format GR-YYYY-NNNNNN', async () => {
    const res = await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 4 },
      { itemId: LEGACY_ITEM, quantityReceived: 10 },
    ]), routeParams())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.success).toBe(true)

    expect(state.grns).toHaveLength(1)
    const grn = state.grns[0]
    expect(grn.grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(grn.purchaseOrderId).toBe(PO_ID)
    expect(grn.supplierId).toBe(SUP_1)
    expect(grn.status).toBe('confirmed')
    expect(grn.locationId).toBe(LOC_1)
    // 2 linije (po eno per receivedItem)
    const items = grn.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(2)
    // Snapshot iz PO postavke
    expect(items[0].purchaseOrderItemId).toBe(PACK_ITEM)
    expect(items[0].description).toBe('Moka tip 500 (vrečka 25 kg)')
    expect(items[0].unit).toBe('vrečka')
    expect(items[0].quantityAccepted).toBe(4)
    expect(items[0].quantityRejected).toBe(0)
    expect(Number(items[0].packQty)).toBe(25)
    expect(items[0].packUnit).toBe('vrečka')
    expect(Number(items[0].unitPriceOrdered)).toBe(45)
    expect(items[1].purchaseOrderItemId).toBe(LEGACY_ITEM)
    expect(items[1].unit).toBe('kg')
    expect(items[1].quantityAccepted).toBe(10)
  })

  it('(A2) partial receive → GRN s delnimi linijami, status PO partial, brez AP', async () => {
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), routeParams())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.status).toBe('partial')
    expect(state.grns).toHaveLength(1) // tudi delni prevzem = dokument (kanon #3)
    expect(state.grns[0].status).toBe('confirmed')
    const items = state.grns[0].items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].quantityAccepted).toBe(2)
    expect(state.ap).toHaveLength(0)
  })

  it('(A3) grnNumber števec: drugi prevzem → 000002 (count+1 padStart 6)', async () => {
    state.pos[0].items = [state.pos[0].items[0]]
    state.pos[0].items[0].quantityOrdered = 4
    await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), routeParams())
    await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), routeParams())
    expect(state.grns).toHaveLength(2)
    expect(state.grns[0].grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(state.grns[1].grnNumber).toBe(`GR-${YEAR}-000002`)
  })

  it('(A4) response vsebuje grn: { id, grnNumber, status, supplierDocNumber }', async () => {
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 5 }], { supplierDocNumber: 'DOBAV-77' }), routeParams())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const grn = body.grn as Record<string, unknown>
    expect(grn.grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(grn.status).toBe('confirmed')
    expect(grn.supplierDocNumber).toBe('DOBAV-77')
    expect(grn.id).toBe('gr-1')
  })

  it('(A5) supplierDocNumber + notes + receivedByName snapshot se persistirajo na GRN', async () => {
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 5 }], {
      supplierDocNumber: 'DOB-2026-055',
      notes: 'Dostava popoldne',
    }), routeParams())
    expect(res.status).toBe(200)
    const grn = state.grns[0]
    expect(grn.supplierDocNumber).toBe('DOB-2026-055')
    expect(grn.notes).toBe('Dostava popoldne')
    expect(grn.receivedById).toBe(EMP_1)
    expect(grn.receivedByName).toBe(EMP_NAME) // snapshot imena zaposlenega
  })
})

// ============================================
// B. Rejected kanon — zaloga samo accepted, kumulacija, cap-check
// ============================================
describe('R132 receive — rejected kanon', () => {
  it('(B1) rejected NE vstopi v zalogo: 2 sprejeta + 1 zavrnjen paket → +50 kg (NE +75), ledger accepted-only', async () => {
    const res = await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 2, quantityRejected: 1, rejectReason: 'Poškodovana vrečka' },
    ]), routeParams())
    expect(res.status).toBe(200)

    // Zaloga: samo accepted — 2 × 25 = 50 (NE 3 × 25 = 75)
    expect(state.captured.invUpdates).toEqual([{ id: INV_PACK, increment: 50 }])
    expect(state.inventory.find(i => i.id === INV_PACK)!.quantity).toBe(60)

    // Ledger: accepted-only forenzika
    expect(state.stockTxs).toHaveLength(1)
    const st = state.stockTxs[0] as Record<string, unknown>
    expect(st.quantity).toBe(50)
    expect(st.totalCost).toBe(90) // 2 paketa × 45 (denar samo accepted)
    // Price history: zajeta samo iz accepted dela (45/25 = 1.8 base)
    expect(state.priceHistory).toHaveLength(1)
    expect((state.priceHistory[0] as Record<string, unknown>).unitPrice).toBe(1.8)
  })

  it('(B2) POItem.quantityRejected kumulira med prevzemi (1 + 2 = 3)', async () => {
    state.pos[0].items = [state.pos[0].items[0]]
    state.pos[0].items[0].quantityOrdered = 6 // kapaciteta za 2 sprejeta + 3 zavrnjena
    await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 1, quantityRejected: 1 }]), routeParams())
    await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 1, quantityRejected: 2 }]), routeParams())
    expect(state.pos[0].items[0].quantityReceived).toBe(2)
    expect(state.pos[0].items[0].quantityRejected).toBe(3) // kumulirano
  })

  it('(B3) AMANDMA kanona #2: rejected NE vpliva na cap-check — accepted ≤ ordered, nadomestni prevzem po odkvitvi je možen', async () => {
    // ordered 4; 2 sprejeto + 3 zavrnjeno (odklonjena prevelika dobava) → 200,
    // rejected je dokumentacija (ne porabi naročilne kapacitete)
    const res = await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 2, quantityRejected: 3, rejectReason: 'Odkano — prevelika dobava' },
    ]), routeParams())
    expect(res.status).toBe(200)
    expect(state.pos[0].items[0].quantityRejected).toBe(3)
    expect(state.grns).toHaveLength(1)
    const grnLine = (state.grns[0].items as Array<Record<string, unknown>>)[0]
    expect(grnLine.quantityAccepted).toBe(2)
    expect(grnLine.quantityRejected).toBe(3)

    // Nadomestni prevzem: +2 sprejeto → accepted 4/4 ('received'), rejected 3 ostane
    const res2 = await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 2 },
    ]), routeParams())
    expect(res2.status).toBe(200)
    expect(state.pos[0].items[0].quantityReceived).toBe(4)
    expect(state.pos[0].items[0].quantityRejected).toBe(3)
    expect(state.pos[0].items[0].status).toBe('received')

    // Cap-check ŠE VEDNO varuje accepted: +1 presega ordered → 400, fail-closed
    state.pos[0].items[0].quantityOrdered = 4
    const res3 = await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 1 },
    ]), routeParams())
    expect(res3.status).toBe(400)
    expect(String((await parseJson(res3)).error)).toContain('presega naročeno (4)')
  })

  it('(B4) brez rejected polj je cap-check BIT-FOR-BIT star (legacy pariteta: zaloga/ledger/price-history/AP)', async () => {
    // Full receive pariteta → PO trimmed na legacy postavko (pack postavka ima
    // svoj B1/B5 pokritost; tukaj gre za dokaz legacy full-receive: 'received'
    // + AP placeholder + ledger/price-history pariteta R131).
    state.pos[0].items = [state.pos[0].items[1]]
    const res = await receivePost(receiveReq([
      { itemId: LEGACY_ITEM, quantityReceived: 10 },
    ]), routeParams())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.status).toBe('received')

    // Ledger: r2 legacy semantika (10 @ 4.5)
    const st = state.stockTxs[0] as Record<string, unknown>
    expect(st.quantity).toBe(10)
    expect(st.previousQty).toBe(5)
    expect(st.newQty).toBe(15)
    expect(st.costPerUnit).toBe(4.5)
    expect(st.totalCost).toBe(45)
    // Price history legacy: unitPrice na enoto, brez pack note
    expect(state.priceHistory).toHaveLength(1)
    const ph = state.priceHistory[0] as Record<string, unknown>
    expect(ph.unitPrice).toBe(4.5)
    expect(ph.unit).toBe('kg')
    expect(ph).not.toHaveProperty('note')
    // AP ob full receive (nespremenjeno)
    expect(state.ap).toHaveLength(1)
    expect(state.ap[0].invoiceNumber).toBe('ND-2026-000132')
    expect(state.ap[0].subtotal).toBe(135)
    // GRN vseeno ustvarjen (kanon #3 — tudi legacy)
    expect(state.grns).toHaveLength(1)
  })

  it('(B5) rejectReason se persistira na GRN liniji', async () => {
    await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 2, quantityRejected: 1, rejectReason: 'Premočeno' },
    ]), routeParams())
    const items = state.grns[0].items as Array<Record<string, unknown>>
    expect(items[0].quantityRejected).toBe(1)
    expect(items[0].rejectReason).toBe('Premočeno')
  })
})

// ============================================
// C. Audit + race-pathi + auth + scope
// ============================================
describe('R132 receive — audit, race, auth, scope', () => {
  it('(C1) audit PURCHASE_ORDER_RECEIVED details += grnNumber, supplierDocNumber, rejectedItems (additivno)', async () => {
    await receivePost(receiveReq([
      { itemId: PACK_ITEM, quantityReceived: 2, quantityRejected: 1, rejectReason: 'Odpad' },
    ]), routeParams())
    expect(m.audits).toHaveLength(1)
    const audit = m.audits[0]
    expect(audit.action).toBe('PURCHASE_ORDER_RECEIVED')
    const details = audit.details as Record<string, unknown>
    expect(details.grnNumber).toBe(`GR-${YEAR}-000001`)
    expect(details.supplierDocNumber).toBe('')
    expect(details.rejectedItems).toEqual([
      { itemId: PACK_ITEM, quantityRejected: 1, rejectReason: 'Odpad' },
    ])
  })

  it('(C2) P2002 na grnNumber @unique → 409 (nikoli 500, pariteta PO-2)', async () => {
    state.setGrnFail(true)
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 1 }]), routeParams())
    expect(res.status).toBe(409)
    const body = await parseJson(res)
    expect(String(body.error)).toContain('sočasen dostop')
  })

  it('(C3) brez seje → 401', async () => {
    authSession({ authed: false })
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 1 }]), routeParams())
    expect(res.status).toBe(401)
    expect(state.grns).toHaveLength(0)
  })

  it('(C4) brez dovoljenja manage_inventory → 403', async () => {
    authSession({ permissions: [] })
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 1 }]), routeParams())
    expect(res.status).toBe(403)
    expect(state.grns).toHaveLength(0)
  })

  it('(C5) cross-tenant (PO tuje lokacije) → 404, brez pisanj', async () => {
    authSession({ locationId: LOC_2 })
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 1 }]), routeParams())
    expect(res.status).toBe(404)
    expect(state.grns).toHaveLength(0)
    expect(state.captured.invUpdates).toHaveLength(0)
  })

  it('(C6) legacy entry point handleReceiveAction (PUT/PATCH) → GRN prav tako ustvarjen', async () => {
    const res = await handleReceiveAction(PO_ID, [{ itemId: LEGACY_ITEM, quantityReceived: 10 }], EMP_1, LOC_1, { supplierDocNumber: 'PUT-DOB-1' })
    expect(res.status).toBe(200)
    expect(state.grns).toHaveLength(1)
    expect(state.grns[0].supplierDocNumber).toBe('PUT-DOB-1')
    expect(state.grns[0].grnNumber).toBe(`GR-${YEAR}-000001`)
  })
})
