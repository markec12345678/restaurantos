// ============================================
// R132 / EPIC #115 P1-12 — INVOICE THREE-WAY MATCH (trap DB)
// ============================================
// Trap DB (hišni stil, vzorca: r132-grn-receive + r131-receive-pack-
// conversion): testira PRODUKCIJSKO route funkcijo POST/GET
// /api/purchase-orders/[id]/invoice (Serializable + advisory lock + tx-fresh).
//
// Kanon P1-12 (§2c/§2d kontrakt):
//   - PO (naročeno) ↔ GRN (sprejeto + zavrnjeno) ↔ Supplier invoice (zaračunano)
//   - Variance per linija: 'match' | 'variance_price' (|inv − ord| >
//     max(0.01, 0.5 %)) | 'variance_qty' (invoiced > accepted) |
//     'variance_both' | 'unreceived' (brez prevzema)
//   - Avto-AP placeholder (invoiceNumber = poNumber) se POSODOBI — NIKOLI
//     dvojni AP; re-POST z istim invoiceNumber je idempotenten update.
//   - Price history se iz računa NIKOLI ne prepisuje (kanon #6).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const PO_ID = 'po-inv-r132'
const EMP_1 = 'emp-1'
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
  status: string
  packQty: number | null
  packUnit: string | null
}
interface PoRow {
  id: string
  poNumber: string
  supplierId: string
  locationId: string
  status: string
  invoiceStatus: string
  subtotal: number
  vatAmount: number
  totalAmount: number
  items: PoItemRow[]
}
interface GrnItemRow { purchaseOrderItemId: string | null; quantityAccepted: number }
interface ApRow extends Record<string, unknown> {
  id: string
  apNumber: string
  supplierId: string
  purchaseOrderId: string
  invoiceNumber: string
  lines?: Array<Record<string, unknown>>
}

function createDb() {
  const pos: PoRow[] = []
  const grnItems: GrnItemRow[] = []
  const aps: ApRow[] = []
  const apLines: Array<Record<string, unknown>> = []
  const priceHistory: Array<Record<string, unknown>> = []
  const captured = {
    apUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
    poUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
    lineDeletes: [] as Array<{ accountsPayableId: string }>,
  }
  let apSeq = 0
  let failApCreateP2002 = false

  const findAp = (pred: (a: ApRow) => boolean) => {
    const found = aps.find(pred)
    // Real Prisma include { lines } garantira array (GET ap.lines.map); POST
    // lookupi dodatno polje ignorirajo (berejo samo id/apNumber/...).
    return found ? { ...structuredClone(found), lines: apLines.filter(l => l.accountsPayableId === found.id).map(l => ({ ...l })) } : null
  }

  const withLines = (ap: ApRow) => ({
    ...structuredClone(ap),
    lines: apLines.filter(l => l.accountsPayableId === ap.id).map(l => ({ ...l })),
    supplier: { id: ap.supplierId, name: 'Dobavitelj 1', code: 'SUP-1' },
  })

  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    purchaseOrder: {
      findFirst: async ({ where }: { where?: { id?: string; locationId?: string } } = {}) => {
        const po = pos.find(p =>
          (where?.id === undefined || p.id === where.id) &&
          (where?.locationId === undefined || p.locationId === where.locationId))
        return po ? structuredClone(po) : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const po = pos.find(p => p.id === where.id)
        if (!po) throw new Error('PO not found')
        if (data.invoiceStatus !== undefined) po.invoiceStatus = data.invoiceStatus as string
        captured.poUpdates.push({ id: where.id, data })
        return structuredClone(po)
      },
    },
    goodsReceiptItem: {
      findMany: async ({ where }: { where: { purchaseOrderItemId: { in: string[] } } }) =>
        grnItems
          .filter(g => g.purchaseOrderItemId !== null && where.purchaseOrderItemId.in.includes(g.purchaseOrderItemId))
          .map(g => ({ ...g })),
    },
    accountsPayable: {
      // Dve obliki klica: (1) existing lookup { purchaseOrderId }, (2) dup
      // lookup { supplierId, invoiceNumber, id: { not } } — trap razlikuje po
      // prisotnosti supplierId.
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.purchaseOrderId !== undefined) {
          return findAp(a => a.purchaseOrderId === where.purchaseOrderId)
        }
        if (where.supplierId !== undefined) {
          const notId = (where.id as { not?: string })?.not ?? ''
          return findAp(a =>
            a.supplierId === where.supplierId &&
            a.invoiceNumber === where.invoiceNumber &&
            a.id !== notId)
        }
        return null
      },
      count: async ({ where }: { where?: { apNumber?: { startsWith?: string } } } = {}) => {
        const prefix = where?.apNumber?.startsWith ?? `AP-${YEAR}-`
        return aps.filter(a => String(a.apNumber).startsWith(prefix)).length
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (failApCreateP2002) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`AccountsPayable.apNumber`)',
            { code: 'P2002', clientVersion: '5.22.0' },
          )
        }
        apSeq += 1
        const row = { id: `ap-${apSeq}`, status: 'open', ...data } as unknown as ApRow
        aps.push(row)
        return { ...structuredClone(row) }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const ap = aps.find(a => a.id === where.id)
        if (!ap) throw new Error('AP not found')
        Object.assign(ap, data)
        captured.apUpdates.push({ id: where.id, data })
        return { ...structuredClone(ap) }
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const ap = aps.find(a => a.id === where.id)
        if (!ap) throw new Error('AP not found')
        return withLines(ap)
      },
    },
    accountsPayableLine: {
      deleteMany: async ({ where }: { where: { accountsPayableId: string } }) => {
        captured.lineDeletes.push({ accountsPayableId: where.accountsPayableId })
        const before = apLines.length
        for (let i = apLines.length - 1; i >= 0; i -= 1) {
          if (apLines[i].accountsPayableId === where.accountsPayableId) apLines.splice(i, 1)
        }
        return { count: before - apLines.length }
      },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        data.forEach((d, idx) => apLines.push({ id: `apl-${apLines.length + 1}-${idx}`, ...d }))
        return { count: data.length }
      },
    },
    supplierPriceHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        priceHistory.push({ ...data })
        return { id: `ph-${priceHistory.length}`, ...data }
      },
    },
  }

  const db = {
    ...tx,
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx),
  }

  return {
    db, pos, grnItems, aps, apLines, priceHistory, captured,
    setApFail: (v: boolean) => { failApCreateP2002 = v },
  }
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

import { POST as invoicePost, GET as invoiceGet } from '@/app/api/purchase-orders/[id]/invoice/route'

const state = ref.current

// ---------- Seed ----------
const PACK_ITEM = 'poi-pack'     // 4 paketi @ 45 €/paket (packQty 25)
const LEGACY_ITEM = 'poi-legacy' // 10 kg @ 4.5 €/kg
const ITEM_C = 'poi-c'           // 5 kos @ 2 €/kos — brez prevzema (unreceived scenarij)

function seedBase(opts?: { withPlaceholderAp?: boolean; poStatus?: string }) {
  state.pos.length = 0
  state.grnItems.length = 0
  state.aps.length = 0
  state.apLines.length = 0
  state.priceHistory.length = 0
  state.captured.apUpdates.length = 0
  state.captured.poUpdates.length = 0
  state.captured.lineDeletes.length = 0
  state.setApFail(false)
  m.audits.length = 0

  state.pos.push({
    id: PO_ID,
    poNumber: 'ND-2026-000132',
    supplierId: SUP_1,
    locationId: LOC_1,
    status: opts?.poStatus ?? 'received',
    invoiceStatus: 'none',
    subtotal: 235,
    vatAmount: 51.7,
    totalAmount: 286.7,
    items: [
      { id: PACK_ITEM, inventoryItemId: 'inv-1', description: 'Moka (vrečka 25 kg)', quantityOrdered: 4, quantityReceived: 4, quantityRejected: 0, unit: 'vrečka', unitPrice: 45, vatRate: 22, status: 'received', packQty: 25, packUnit: 'vrečka' },
      { id: LEGACY_ITEM, inventoryItemId: 'inv-2', description: 'Sladkor (kg)', quantityOrdered: 10, quantityReceived: 10, quantityRejected: 1, unit: 'kg', unitPrice: 4.5, vatRate: 22, status: 'received', packQty: null, packUnit: null },
      { id: ITEM_C, inventoryItemId: 'inv-3', description: 'Papirnate brisače', quantityOrdered: 5, quantityReceived: 0, quantityRejected: 0, unit: 'kos', unitPrice: 2, vatRate: 22, status: 'pending', packQty: null, packUnit: null },
    ],
  })

  // GRN prevzemi: moka 4/4 sprejeto, sladkor 10 sprejeto (1 zavrnjen je na PO itemu)
  state.grnItems.push(
    { purchaseOrderItemId: PACK_ITEM, quantityAccepted: 4 },
    { purchaseOrderItemId: PACK_ITEM, quantityAccepted: 0 },
    { purchaseOrderItemId: LEGACY_ITEM, quantityAccepted: 10 },
  )

  if (opts?.withPlaceholderAp) {
    state.aps.push({
      id: 'ap-ph',
      apNumber: `AP-${YEAR}-000001`,
      supplierId: SUP_1,
      purchaseOrderId: PO_ID,
      invoiceNumber: 'ND-2026-000132', // placeholder = poNumber (avto-AP iz prevzema)
      dueDate: new Date(),
      subtotal: 235,
      vatAmount: 51.7,
      totalAmount: 286.7,
      matchStatus: 'unmatched',
    } as ApRow)
  }
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
  seedBase({ withPlaceholderAp: true })
  authSession()
})

interface InvLine { poItemId: string; quantityInvoiced: number; unitPriceInvoiced: number; vatRate?: number }

function invoiceReq(over: Partial<Record<string, unknown>> = {}, lines?: InvLine[]): Request {
  const body = {
    invoiceNumber: 'RA-2026-0042',
    invoiceDate: '2026-09-25',
    dueDate: '2026-10-25',
    lines: lines ?? [
      { poItemId: PACK_ITEM, quantityInvoiced: 4, unitPriceInvoiced: 45, vatRate: 22 },
      { poItemId: LEGACY_ITEM, quantityInvoiced: 10, unitPriceInvoiced: 4.5, vatRate: 22 },
    ],
    notes: 'Račun dobavitelja',
    ...over,
  }
  return new Request(`http://local/api/purchase-orders/${PO_ID}/invoice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function routeParams(id = PO_ID) {
  return { params: Promise.resolve({ id }) }
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ════════════════════════════════════════════════════════════════════
describe('R132 invoice — match matematika', () => {
  it('(A1) vse linije ujemajo → matchStatus matched, per-line match, invoiceStatus invoiced', async () => {
    // PO trimmed na zaračunani postavki (ITEM_C ni del tega računa — sicer bi
    // Σ invoiced 14 < Σ ordered 19 → 'partial', kar pokriva B-scenarij).
    state.pos[0].items = state.pos[0].items.filter(i => i.id !== ITEM_C)
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const match = body.match as Record<string, unknown>
    expect(match.matchStatus).toBe('matched')
    const lines = match.lines as Array<Record<string, unknown>>
    expect(lines).toHaveLength(2)
    for (const l of lines) expect(l.varianceStatus).toBe('match')
    expect(match.totals).toMatchObject({ ordered: 14, accepted: 14, invoiced: 14 })
    // Roll-up persistiran
    expect(state.captured.poUpdates).toEqual([{ id: PO_ID, data: { invoiceStatus: 'invoiced' } }])
    expect((state.aps[0] as Record<string, unknown>).matchStatus).toBe('matched')
  })

  it('(A2) cena odmik > toleranca (0.5 % + 0.01) → variance_price + razložljiv note', async () => {
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: LEGACY_ITEM, quantityInvoiced: 10, unitPriceInvoiced: 5.2, vatRate: 22 },
    ]), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const match = body.match as Record<string, unknown>
    expect(match.matchStatus).toBe('variance')
    const line = (match.lines as Array<Record<string, unknown>>)[0]
    expect(line.varianceStatus).toBe('variance_price')
    expect(line.priceVariancePct).toBeCloseTo(15.56, 1)
    expect(String(line.varianceNote)).toContain('Račun: 5,20 €/kg')
    expect(String(line.varianceNote)).toContain('naročeno: 4,50 €/kg')
    // PO.invoiceStatus = variance (prednost)
    expect(state.pos[0].invoiceStatus).toBe('variance')
  })

  it('(A3) cena znotraj tolerance (0.4 % < 0.5 %) → match (relativna toleranca)', async () => {
    // 4.5 → 4.52: diff 0.02 > 0.01 abs, ampak 0.44 % < 0.5 % rel → match
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: LEGACY_ITEM, quantityInvoiced: 10, unitPriceInvoiced: 4.52, vatRate: 22 },
    ]), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const line = ((body.match as Record<string, unknown>).lines as Array<Record<string, unknown>>)[0]
    expect(line.varianceStatus).toBe('match')
  })

  it('(A4) količinski odmik: invoiced > accepted → variance_qty', async () => {
    // GRN accepted za moko: 4; račun 5 → qty variance (cena enaka)
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: PACK_ITEM, quantityInvoiced: 5, unitPriceInvoiced: 45, vatRate: 22 },
    ]), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const match = body.match as Record<string, unknown>
    const line = (match.lines as Array<Record<string, unknown>>)[0]
    expect(line.varianceStatus).toBe('variance_qty')
    expect(String(line.varianceNote)).toContain('Račun: 5 vrečka, sprejeto: 4 vrečka')
    expect((match.totals as Record<string, unknown>).qtyVarTotal).toBe(1)
  })

  it('(A5) cena + količina odmik → variance_both', async () => {
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: LEGACY_ITEM, quantityInvoiced: 12, unitPriceInvoiced: 5.5, vatRate: 22 },
    ]), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const line = ((body.match as Record<string, unknown>).lines as Array<Record<string, unknown>>)[0]
    expect(line.varianceStatus).toBe('variance_both')
    expect(String(line.varianceNote)).toContain('; ')
  })

  it('(A6) brez prevzema + račun → unreceived', async () => {
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: ITEM_C, quantityInvoiced: 5, unitPriceInvoiced: 2, vatRate: 22 },
    ]), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const line = ((body.match as Record<string, unknown>).lines as Array<Record<string, unknown>>)[0]
    expect(line.varianceStatus).toBe('unreceived')
    expect(String(line.varianceNote)).toContain('ni bila prevzeta')
  })
})

describe('R132 invoice — AP kanon', () => {
  it('(B1) avto-AP placeholder se POSODOBI (brez dvojnega AP, star apNumber ostane)', async () => {
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(201)
    // TOČNO 1 AP — placeholder updejan, ne nov
    expect(state.aps).toHaveLength(1)
    const ap = state.aps[0] as Record<string, unknown>
    expect(ap.apNumber).toBe(`AP-${YEAR}-000001`) // star apNumber ostane
    expect(ap.invoiceNumber).toBe('RA-2026-0042') // realna številka
    expect(ap.subtotal).toBe(225) // 4×45 + 10×4.5 = 180 + 45
    expect(ap.vatAmount).toBe(49.5) // 22 % na 225
    expect(ap.totalAmount).toBe(274.5)
    expect(state.captured.apUpdates).toHaveLength(1)
    expect(state.captured.poUpdates).toHaveLength(1)
  })

  it('(B2) brez obstoječega AP (delno prevzeto) → NOV AP s pravo številko računa', async () => {
    seedBase({ withPlaceholderAp: false, poStatus: 'partial' })
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(201)
    expect(state.aps).toHaveLength(1)
    const ap = state.aps[0] as Record<string, unknown>
    expect(ap.apNumber).toBe(`AP-${YEAR}-000001`) // count+1 (prvi AP)
    expect(ap.invoiceNumber).toBe('RA-2026-0042')
    expect(ap.purchaseOrderId).toBe(PO_ID)
    expect(ap.locationId).toBe(LOC_1)
  })

  it('(B3) idempotenten re-POST: linije deleteMany + recreate, še vedno 1 AP', async () => {
    await invoicePost(invoiceReq(), routeParams())
    const res2 = await invoicePost(invoiceReq({ invoiceNumber: 'RA-2026-0042' }), routeParams())
    expect(res2.status).toBe(201)
    expect(state.aps).toHaveLength(1)
    expect(state.captured.lineDeletes).toEqual([{ accountsPayableId: 'ap-ph' }, { accountsPayableId: 'ap-ph' }])
    expect(state.apLines).toHaveLength(2) // 2 liniji (recreate)
    // Drugi POST je posodobil (ne kreiral)
    expect(state.captured.apUpdates).toHaveLength(2)
  })

  it('(B4) duplikat invoiceNumber na DRUGEM AP-ju istega dobavitelja → 409', async () => {
    state.aps.push({
      id: 'ap-other',
      apNumber: `AP-${YEAR}-000002`,
      supplierId: SUP_1,
      purchaseOrderId: 'po-OTHER',
      invoiceNumber: 'RA-2026-0042',
      dueDate: new Date(),
      matchStatus: 'matched',
    } as ApRow)
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(409)
    const body = await parseJson(res)
    expect(String(body.error)).toContain('že obstaja')
    // Brez pisanj
    expect(state.captured.apUpdates).toHaveLength(0)
    expect(state.captured.poUpdates).toHaveLength(0)
  })

  it('(B5) roll-up: variance linija → AP.matchStatus variance + PO.invoiceStatus variance', async () => {
    await invoicePost(invoiceReq({}, [
      { poItemId: PACK_ITEM, quantityInvoiced: 4, unitPriceInvoiced: 50, vatRate: 22 },
    ]), routeParams())
    expect((state.aps[0] as Record<string, unknown>).matchStatus).toBe('variance')
    expect(state.pos[0].invoiceStatus).toBe('variance')
  })

  it('(B6) denar iz linij: subtotal/vat/total + DDV po liniji (calcVat)', async () => {
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: PACK_ITEM, quantityInvoiced: 4, unitPriceInvoiced: 45, vatRate: 22 },
      { poItemId: LEGACY_ITEM, quantityInvoiced: 10, unitPriceInvoiced: 4.5, vatRate: 9.5 },
    ]), routeParams())
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    const ap = body.accountsPayable as Record<string, unknown>
    expect(ap.subtotal).toBe(225) // 180 + 45
    expect(ap.vatAmount).toBe(43.88) // 39.6 (22 % na 180) + 4.28 (round2 od 4.275 = 9.5 % na 45)
    expect(ap.totalAmount).toBe(268.88)
    const apLines = state.apLines as Array<Record<string, unknown>>
    expect(apLines[0].lineTotal).toBe(180)
    expect(apLines[1].lineTotal).toBe(45)
  })

  it('(B7) P2002 na apNumber (nov AP, sočasen zaključek) → 409', async () => {
    seedBase({ withPlaceholderAp: false })
    state.setApFail(true)
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(409)
    const body = await parseJson(res)
    expect(String(body.error)).toContain('sočasen dostop')
  })
})

describe('R132 invoice — varnost, validacija, audit', () => {
  it('(C1) neznan poItemId → 400 fail-closed, brez pisanj', async () => {
    const res = await invoicePost(invoiceReq({}, [
      { poItemId: 'poi-GHOST', quantityInvoiced: 1, unitPriceInvoiced: 1 },
    ]), routeParams())
    expect(res.status).toBe(400)
    expect(state.captured.apUpdates).toHaveLength(0)
    expect(state.captured.poUpdates).toHaveLength(0)
    expect(state.apLines).toHaveLength(0)
  })

  it('(C2) preklicano naročilo → 400', async () => {
    seedBase()
    state.pos[0].status = 'cancelled'
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(400)
  })

  it('(C3) cross-tenant PO (tuja lokacija) → 404', async () => {
    authSession({ locationId: LOC_2 })
    const res = await invoicePost(invoiceReq(), routeParams())
    expect(res.status).toBe(404)
  })

  it('(C4) brez seje → 401; brez dovoljenja manage_inventory → 403', async () => {
    authSession({ authed: false })
    const res401 = await invoicePost(invoiceReq(), routeParams())
    expect(res401.status).toBe(401)

    authSession({ permissions: [] })
    const res403 = await invoicePost(invoiceReq(), routeParams())
    expect(res403.status).toBe(403)
  })

  it('(C5) validacija: prazne linije → 400 (zod)', async () => {
    const res = await invoicePost(invoiceReq({ lines: [] }), routeParams())
    expect(res.status).toBe(400)
  })

  it('(C6) audit SUPPLIER_INVOICE_RECORDED ZUNAJ tx (action + details)', async () => {
    await invoicePost(invoiceReq({}, [
      { poItemId: LEGACY_ITEM, quantityInvoiced: 10, unitPriceInvoiced: 5.2, vatRate: 22 },
    ]), routeParams())
    expect(m.audits).toHaveLength(1)
    const audit = m.audits[0] as Record<string, unknown>
    expect(audit.action).toBe('SUPPLIER_INVOICE_RECORDED')
    expect(audit.entityType).toBe('AccountsPayable')
    const details = audit.details as Record<string, unknown>
    expect(details.invoiceNumber).toBe('RA-2026-0042')
    expect(details.matchStatus).toBe('variance')
    expect(details.varianceLines).toBe(1)
  })

  it('(C7) price history se IZ RAČUNA ne prepisuje (kanon #6 — brez pisanj v zgodovino)', async () => {
    await invoicePost(invoiceReq({}, [
      { poItemId: LEGACY_ITEM, quantityInvoiced: 10, unitPriceInvoiced: 9.99, vatRate: 22 },
    ]), routeParams())
    expect(state.priceHistory).toHaveLength(0) // NIKOLI prepis iz računa
  })

  it('(C8) GET: brez AP → { accountsPayable: null, match: null } 200', async () => {
    seedBase({ withPlaceholderAp: false })
    const res = await invoiceGet(new Request(`http://local/api/purchase-orders/${PO_ID}/invoice`), routeParams())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.accountsPayable).toBeNull()
    expect(body.match).toBeNull()
  })

  it('(C9) GET: z AP → živo poročilo (lines + totals, brez pisanj)', async () => {
    await invoicePost(invoiceReq(), routeParams())
    m.audits.length = 0
    const writesBefore = state.captured.poUpdates.length
    const res = await invoiceGet(new Request(`http://local/api/purchase-orders/${PO_ID}/invoice`), routeParams())
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const match = body.match as Record<string, unknown>
    expect(match.matchStatus).toBe('matched')
    expect((match.lines as Array<Record<string, unknown>>).length).toBe(2)
    expect(state.captured.poUpdates.length).toBe(writesBefore) // GET NE piše
    expect(m.audits).toHaveLength(0) // GET brez audita
  })

  it('(C10) GET brez seje → 401', async () => {
    authSession({ authed: false })
    const res = await invoiceGet(new Request(`http://local/api/purchase-orders/${PO_ID}/invoice`), routeParams())
    expect(res.status).toBe(401)
  })
})
