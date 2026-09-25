// ============================================
// R131 / EPIC #115 P1-13 — RECEIVE PACK CONVERSION (trap DB)
// ============================================
// Trap DB (hišni stil, vzorca: r105-receive-concurrency + r130 house pattern):
// testira PRODUKCIJSKO route funkcijo POST /api/purchase-orders/[id]/receive
// → receivePurchaseOrderItems kanon (Serializable + advisory lock + tx-fresh).
//
// Kanon P1-13: PO postavka z veljavnim packQty SNAPSHOT je v PAKETIH —
//   - inventory increment v OSNOVNIH enotah (packs × packQty),
//   - StockTransaction (ledger) v osnovnih enotah, costPerUnit = osnovna cena
//     (round2 — stolpec 12,2), totalCost = packs × unitPrice (DENAR nespremenjen),
//   - SupplierPriceHistory VEDNO na osnovni enoti (unitPrice = baseUnitPrice,
//     unit = InventoryItem.unit, note += pack provenance).
// LEGACY pot (packQty NULL/neveljaven) → BIT-FOR-BIT staro vedenje (22+
// obstoječih prevzemnih testov ostaja zelenih — paritetne asercije spodaj).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
const PO_ID = 'po-r131'
const EMP_1 = 'emp-1'
const SUP_1 = 'sup-1'

// ---------- Trap stanje ----------
interface PoItemRow {
  id: string
  inventoryItemId: string | null
  description: string
  quantityOrdered: number
  quantityReceived: number
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

function createDb() {
  const pos: PoRow[] = []
  const inventory: InvRow[] = []
  const stockTxs: Array<Record<string, unknown>> = []
  const priceHistory: Array<Record<string, unknown>> = []
  const ap: Array<Record<string, unknown>> = []
  // R132 (P1-12): vsak prevzem ustvari GRN dokument + linije v istem tx —
  // aditivni trap stub (asercije ostajajo nespremenjene).
  const grns: Array<Record<string, unknown>> = []
  const captured = {
    invUpdates: [] as Array<{ id: string; increment: number }>,
    poiUpdates: [] as Array<Record<string, unknown>>,
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
    goodsReceipt: {
      count: async ({ where }: { where?: { grnNumber?: { startsWith?: string } } } = {}) => {
        const prefix = where?.grnNumber?.startsWith ?? 'GR-'
        return grns.filter(g => String(g.grnNumber).startsWith(prefix)).length
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        grns.push({ ...data })
        return { id: `gr-${grns.length}`, ...data }
      },
    },
    accountsPayable: {
      findFirst: async () => null,
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        ap.push({ ...data })
        return { id: `ap-${ap.length}`, ...data }
      },
    },
  }

  const db = {
    ...tx,
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  }

  return { db, pos, inventory, stockTxs, priceHistory, ap, grns, captured }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
type DbState = ReturnType<typeof createDb>
const ref = vi.hoisted(() => ({ current: null as unknown as DbState }))
ref.current = createDb()

const m = vi.hoisted(() => ({ requireAuth: vi.fn() }))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async () => {},
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

const state = ref.current

// ---------- Seed ----------
const PACK_ITEM = 'poi-pack'   // packQty 25, unitPrice 45/paket, unit 'vrečka'
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
  state.captured.invUpdates.length = 0
  state.captured.poiUpdates.length = 0

  state.inventory.push(
    { id: INV_PACK, quantity: 10, unit: 'kg' },
    { id: INV_LEGACY, quantity: 5, unit: 'kg' },
  )
  state.pos.push({
    id: PO_ID,
    poNumber: 'ND-2026-000131',
    supplierId: SUP_1,
    locationId: LOC_1,
    status: 'approved',
    subtotal: 135, // 2×45 (pack) + 10×4.5 (legacy)
    vatAmount: 29.7,
    totalAmount: 164.7,
    supplier: { id: SUP_1, name: 'Dobavitelj 1' },
    items: [
      {
        id: PACK_ITEM,
        inventoryItemId: INV_PACK,
        description: 'Moka tip 500 (vrečka 25 kg)',
        quantityOrdered: 2,
        quantityReceived: 0,
        unit: 'vrečka',
        unitPrice: 45,
        vatRate: 22,
        totalPrice: 90,
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

function authSession() {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: EMP_1, locationId: LOC_1, role: 'manager', permissions: ['manage_inventory'] },
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  authSession()
})

function receiveReq(receivedItems: Array<{ itemId: string; quantityReceived: number }>): Request {
  return new Request(`http://local/api/purchase-orders/${PO_ID}/receive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ receivedItems }),
  })
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ============================================
// A. Pack pot — konverzija v osnovne enote
// ============================================
describe('R131 receive — pack pot (packQty snapshot)', () => {
  it('prevzem 2 paketov × 25 kg → zaloga +50, ledger v base enotah, denar = packs × cena/paket', async () => {
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.success).toBe(true)

    // Inventory increment v OSNOVNIH enotah: 2 × 25 = 50 (NE 2!)
    expect(state.captured.invUpdates).toEqual([{ id: INV_PACK, increment: 50 }])
    const inv = state.inventory.find(i => i.id === INV_PACK)!
    expect(inv.quantity).toBe(60) // 10 + 50

    // Ledger (StockTransaction) v OSNOVNIH enotah + R103 G3 forenzika iz post-op
    expect(state.stockTxs).toHaveLength(1)
    const st = state.stockTxs[0] as Record<string, unknown>
    expect(st.inventoryItemId).toBe(INV_PACK)
    expect(st.type).toBe('procurement')
    expect(st.quantity).toBe(50)
    expect(st.previousQty).toBe(10)
    expect(st.newQty).toBe(60)
    // Osnovna cena: 45 / 25 = 1.8 (stolpec 12,2)
    expect(st.costPerUnit).toBe(1.8)
    // DENAR nespremenjen: totalCost = packs × unitPrice = 2 × 45 = 90
    expect(st.totalCost).toBe(90)
    expect(st.reason).toBe('Prejem ND-2026-000131')
    expect(st.employeeName).toBe(EMP_1)

    // Status roll-up: legacy postavka NI prevzeta → 'partial', brez AP
    // (polni zaključek + AP denar pokrije mešani test v sekciji B)
    expect(state.pos[0].status).toBe('partial')
    expect(state.pos[0].items[0].quantityReceived).toBe(2)
    expect(state.ap).toHaveLength(0)
  })

  it('SupplierPriceHistory VEDNO na osnovni enoti: unitPrice 1.8, unit kg (iz InventoryItem), provenance note', async () => {
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(200)

    expect(state.priceHistory).toHaveLength(1)
    const ph = state.priceHistory[0] as Record<string, unknown>
    expect(ph.supplierId).toBe(SUP_1)
    expect(ph.inventoryItemId).toBe(INV_PACK)
    // Kanon #4: unitPrice = baseUnitPrice (45/25 = 1.8), NE cena na paket!
    expect(ph.unitPrice).toBe(1.8)
    // unit = InventoryItem.unit (updatedInv), NE poItem.unit ('vrečka')
    expect(ph.unit).toBe('kg')
    expect(ph.source).toBe('goods_receipt')
    expect(ph.purchaseOrderId).toBe(PO_ID)
    expect(ph.locationId).toBe(LOC_1)
    // Provenance: "pack: 2 × vrečka po 25 kg"
    expect(ph.note).toBe('pack: 2 × vrečka po 25 kg')
  })

  it('delni prevzem v paketih: 1 od 4 paketov → partial, brez AP, ledger +25 base', async () => {
    state.pos[0].items[0].quantityOrdered = 4
    state.pos[0].items = [state.pos[0].items[0]] // samo pack postavka
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 1 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.status).toBe('partial')
    expect(state.pos[0].status).toBe('partial')
    expect(state.ap).toHaveLength(0)
    expect(state.captured.invUpdates).toEqual([{ id: INV_PACK, increment: 25 }])
    const st = state.stockTxs[0] as Record<string, unknown>
    expect(st.quantity).toBe(25)
    expect(st.totalCost).toBe(45) // 1 paket × 45
  })

  it('pricePerPack 0 (darilo) s packQty → zaloga/ledger v base, price history PRESKOČENA (pariteta R130)', async () => {
    state.pos[0].items = [state.pos[0].items[0]]
    state.pos[0].items[0].unitPrice = 0
    state.pos[0].items[0].totalPrice = 0
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(200)
    // Pack konverzija še vedno velja (packQty je veljaven)
    expect(state.captured.invUpdates).toEqual([{ id: INV_PACK, increment: 50 }])
    expect(state.stockTxs).toHaveLength(1)
    // ZASEBNOST kanon R130: cena 0 se NE zajame
    expect(state.priceHistory).toHaveLength(0)
  })

  it('cap-check ostane v paketih: 3 od 2 paketov → 400 brez zalogovnih pisanj', async () => {
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 3 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(400)
    const body = await parseJson(res)
    // 3 > 2 (ista enota — paketi)
    expect(String(body.error)).toContain('presega naročeno (2)')
    // Fail-closed: NIč pisanj
    expect(state.captured.invUpdates).toHaveLength(0)
    expect(state.stockTxs).toHaveLength(0)
    expect(state.priceHistory).toHaveLength(0)
  })
})

// ============================================
// B. LEGACY pot — BIT-FOR-BIT staro vedenje (pariteta)
// ============================================
describe('R131 receive — legacy pot (packQty NULL/neveljaven)', () => {
  it('packQty NULL: 10 kg → zaloga +10 (NE ×25), ledger v kg, price history unitPrice = unitPrice na ENOTO', async () => {
    const res = await receivePost(receiveReq([{ itemId: LEGACY_ITEM, quantityReceived: 10 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(200)

    // Zaloga +10 (vrstica je v kg — brez konverzije)
    expect(state.captured.invUpdates).toEqual([{ id: INV_LEGACY, increment: 10 }])
    expect(state.inventory.find(i => i.id === INV_LEGACY)!.quantity).toBe(15)

    // Ledger: R2 legacy semantika (round2 količine)
    const st = state.stockTxs[0] as Record<string, unknown>
    expect(st.quantity).toBe(10)
    expect(st.previousQty).toBe(5)
    expect(st.newQty).toBe(15)
    expect(st.costPerUnit).toBe(4.5) // = unitPrice (na enoto)
    expect(st.totalCost).toBe(45) // 10 × 4.5

    // Price history: unitPrice = poItem.unitPrice (NA OSNOVNO ENOTO, ne /packQty),
    // unit = poItem.unit ('kg'), BREZ note (bit-for-bit: legacy create nima note ključa)
    expect(state.priceHistory).toHaveLength(1)
    const ph = state.priceHistory[0] as Record<string, unknown>
    expect(ph.unitPrice).toBe(4.5)
    expect(ph.unit).toBe('kg')
    expect(ph.source).toBe('goods_receipt')
    expect(ph).not.toHaveProperty('note')
  })

  it('packQty 0 (neveljaven snapshot) → legacy pot (fallback, nikoli crash)', async () => {
    state.pos[0].items[0].packQty = 0
    const res = await receivePost(receiveReq([{ itemId: PACK_ITEM, quantityReceived: 2 }]), {
      params: Promise.resolve({ id: PO_ID }),
    })
    expect(res.status).toBe(200)
    // Legacy: increment = 2 (količina kot je, brez konverzije)
    expect(state.captured.invUpdates).toEqual([{ id: INV_PACK, increment: 2 }])
    const st = state.stockTxs[0] as Record<string, unknown>
    expect(st.quantity).toBe(2)
    expect(st.costPerUnit).toBe(45) // unitPrice kot je
    expect(st.totalCost).toBe(90)
    // Price history legacy: unitPrice = unitPrice (45), unit = poItem.unit ('vrečka'), brez note
    const ph = state.priceHistory[0] as Record<string, unknown>
    expect(ph.unitPrice).toBe(45)
    expect(ph.unit).toBe('vrečka')
    expect(ph).not.toHaveProperty('note')
  })

  it('mešana PO: pack postavka + legacy postavka — vsaka po svoji semantiki (isti prevzem)', async () => {
    const res = await receivePost(
      receiveReq([
        { itemId: PACK_ITEM, quantityReceived: 2 },   // 2 paketa × 25 kg = 50 kg
        { itemId: LEGACY_ITEM, quantityReceived: 10 }, // 10 kg
      ]),
      { params: Promise.resolve({ id: PO_ID }) },
    )
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.status).toBe('received')

    // Pack: +50 base; legacy: +10 base (po svoji enoti)
    expect(state.captured.invUpdates).toEqual([
      { id: INV_PACK, increment: 50 },
      { id: INV_LEGACY, increment: 10 },
    ])
    expect(state.inventory.find(i => i.id === INV_PACK)!.quantity).toBe(60)
    expect(state.inventory.find(i => i.id === INV_LEGACY)!.quantity).toBe(15)

    // Ledger: dve vrstici, vsaka v svojih enotah
    expect(state.stockTxs).toHaveLength(2)
    const packSt = state.stockTxs[0] as Record<string, unknown>
    const legacySt = state.stockTxs[1] as Record<string, unknown>
    expect(packSt.quantity).toBe(50)
    expect(packSt.costPerUnit).toBe(1.8)
    expect(packSt.totalCost).toBe(90)
    expect(legacySt.quantity).toBe(10)
    expect(legacySt.costPerUnit).toBe(4.5)
    expect(legacySt.totalCost).toBe(45)

    // Price history: pack vrstica na osnovni enoti + provenance; legacy brez note
    expect(state.priceHistory).toHaveLength(2)
    const packPh = state.priceHistory[0] as Record<string, unknown>
    const legacyPh = state.priceHistory[1] as Record<string, unknown>
    expect(packPh.unitPrice).toBe(1.8)
    expect(packPh.unit).toBe('kg')
    expect(packPh.note).toBe('pack: 2 × vrečka po 25 kg')
    expect(legacyPh.unitPrice).toBe(4.5)
    expect(legacyPh.unit).toBe('kg')
    expect(legacyPh).not.toHaveProperty('note')

    // AP: subtotal PO nespremenjen (135 = 90 + 45) — denar na nivoju vrstic
    expect(state.ap).toHaveLength(1)
    expect(state.ap[0].subtotal).toBe(135)
  })
})
