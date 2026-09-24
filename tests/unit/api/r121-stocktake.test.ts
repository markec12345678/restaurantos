// ============================================
// R121 / EPIC #115 P0-01 — STOCKTAKE (fizična inventura + reconciliation)
// ============================================
// Pokritje (P0-01 checklist + §32 minimalni dokaz):
//  • S-1 create: DRAFT + snapshot teoretičnega stanja (expected × cost) + audit
//  • S-2 create idempotency: replay (200, en inventura) + P2002 race → 409
//  • S-3 štetje (PATCH): counted + variance snapshot (counted − expected ×
//    cost) + countedBy/At; negativno štetje → 400; tuja vrstica → 400
//  • S-4 zaklep štetja: PATCH na IN_REVIEW → 409 (ponovno štetje = recount)
//  • S-5 submit: DRAFT → IN_REVIEW (≥1 preštecen); brez štetja → 400; dvojni
//    submit → 409
//  • S-6 approve NEGATIVE razlika: zaloga = preštetje (new baseline),
//    StockTransaction 'write-off' (previousQty → newQty brez prepletov),
//    line.stockTransactionId, summary, audit STOCKTAKE_APPROVE
//  • S-7 approve POZITIVNA razlika → 'adjustment'
//  • S-8 DRIFT (prodaja med štetjem in potrditvijo): aplicirana razlika =
//    counted − tx-fresh zaloga ob potrditvi; končna zaloga = preštetje
//  • S-9 ZAŠČITA PRED DVOJNO POTRDITVIJO: zaporedni drugi approve → 409;
//    VZPOREDNA approve (Promise.all, event-loop interleave) → natanko ENA
//    aplicirana korekcija (pogojni updateMany status claim)
//  • S-10 tenant/location isolation: tuja inventura → 404 (vsi prehodi);
//    super-admin brez locationId → 400
//  • S-11 cancel: brez korekcij zaloge; approve po cancel → 409; cancel
//    APPROVED → 409
//  • S-12 recount: IN_REVIEW → DRAFT (recountCount++); iz DRAFT → 409
//  • S-13 strukturni pini: SKUPNI advisory lock ključ ('inv-stock:'), pogojni
//    status claim, ledger zapis (StockTransaction) v approve, FEFO batch hook
//    minusa, submit zahteva preštecene vrstice
//
// Trap DB (hišni stil R119/R120): in-memory model z REALNIMI semantikami
// (OR scope, CAS updateMany, status guardi, nested create) — klicane so
// PRODUKCIJSKE route handler funkcije, ne mock kopije.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'

// ---------- Vrstice ----------
interface InvRow {
  id: string
  name: string
  unit: string
  quantity: number
  costPerUnit: number
  locationId: string | null
}
interface StocktakeRow {
  id: string
  locationId: string
  status: string
  note: string
  createdByName: string
  approvedByName: string
  submittedAt: Date | null
  approvedAt: Date | null
  cancelledAt: Date | null
  recountCount: number
  idempotencyKey: string | null
  createdAt: Date
}
interface StocktakeItemRow {
  id: string
  stocktakeId: string
  inventoryItemId: string
  itemName: string
  unit: string
  expectedQuantity: number
  costPerUnit: number
  countedQuantity: number | null
  varianceQuantity: number | null
  varianceValue: number | null
  lineNote: string
  countedAt: Date | null
  countedByName: string
  stockTransactionId: string | null
}
interface StockTxRow {
  id: string
  inventoryItemId: string
  type: string
  quantity: number
  previousQty: number
  newQty: number
  costPerUnit: number
  totalCost: number
  reason: string
  note: string
  employeeName: string
}

function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`
  const inv: InvRow[] = []
  const stocktakes: StocktakeRow[] = []
  const stocktakeItems: StocktakeItemRow[] = []
  const stockTx: StockTxRow[] = []
  const audit: Record<string, unknown>[] = []
  const lockKeys: string[] = []
  let createThrowsP2002Next = false
  const batchConsumptionCalls: Record<string, unknown>[] = []

  /** OR scope: lastna lokacija ALI skupni (NULL) vir — pariteta z waste kanonom */
  function invInScope(locationId: string): InvRow[] {
    return inv.filter(i => i.locationId === locationId || i.locationId === null)
  }

  function stocktakeMatches(
    st: StocktakeRow,
    where: { id?: string; locationId?: string; idempotencyKey?: string | null; status?: unknown },
  ): boolean {
    if (where.id && st.id !== where.id) return false
    if (where.locationId && st.locationId !== where.locationId) return false
    if (where.idempotencyKey !== undefined && where.idempotencyKey !== null && st.idempotencyKey !== where.idempotencyKey) return false
    if (where.status !== undefined) {
      if (typeof where.status === 'object' && where.status !== null && 'in' in (where.status as Record<string, unknown>)) {
        const list = (where.status as { in: string[] }).in
        if (!list.includes(st.status)) return false
      } else if (st.status !== where.status) return false
    }
    return true
  }

  const makeClients = () => ({
    inventoryItem: {
      findMany: async ({ where }: { where?: { OR?: { locationId: string | null }[] } }) => {
        if (!where?.OR) return inv.map(i => ({ ...i }))
        // emulacija OR [{locationId}, {locationId: null}]
        const allowed = where.OR.map(o => o.locationId)
        return inv.filter(i => allowed.includes(i.locationId)).map(i => ({ ...i }))
      },
      findFirst: async ({ where }: { where: { id: string; OR?: { locationId: string | null }[] } }) => {
        const row = inv.find(i => i.id === where.id)
        if (!row) return null
        if (where.OR && !where.OR.some(o => o.locationId === row.locationId)) return null
        return { ...row }
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = inv.find(i => i.id === where.id)
        return row ? { ...row } : null
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; quantity?: number; locationId?: string }
        data: { quantity?: number; quantityIncrement?: number }
      }) => {
        const row = inv.find(i => i.id === where.id)
        if (!row) return { count: 0 }
        if (where.quantity !== undefined && row.quantity !== where.quantity) return { count: 0 } // CAS guard
        if (data.quantityIncrement !== undefined) row.quantity += data.quantityIncrement
        else if (data.quantity !== undefined) row.quantity = data.quantity
        return { count: 1 }
      },
    },
    stocktake: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        stocktakes
          .filter(s => stocktakeMatches(s, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(s => ({ ...s, lines: stocktakeItems.filter(l => l.stocktakeId === s.id).map(l => ({ ...l })) })),
      findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: { lines?: boolean } }) => {
        const st = stocktakes.find(s => stocktakeMatches(s, where))
        if (!st) return null
        if (include?.lines) {
          return { ...st, lines: stocktakeItems.filter(l => l.stocktakeId === st.id).map(l => ({ ...l })) }
        }
        return { ...st }
      },
      create: async ({ data, include }: { data: Record<string, unknown>; include?: { lines?: boolean } }) => {
        if (createThrowsP2002Next) {
          createThrowsP2002Next = false
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
        }
        if (
          data.idempotencyKey &&
          stocktakes.some(s => s.locationId === data.locationId && s.idempotencyKey === data.idempotencyKey)
        ) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
        }
        const st: StocktakeRow = {
          id: id('st'),
          locationId: data.locationId as string,
          status: (data.status as string) ?? 'DRAFT',
          note: (data.note as string) ?? '',
          createdByName: (data.createdByName as string) ?? '',
          approvedByName: '',
          submittedAt: null,
          approvedAt: null,
          cancelledAt: null,
          recountCount: 0,
          idempotencyKey: (data.idempotencyKey as string) ?? null,
          createdAt: new Date(),
        }
        stocktakes.push(st)
        const lines = (data.lines as { create: Record<string, unknown>[] } | undefined)?.create ?? []
        for (const l of lines) {
          stocktakeItems.push({
            id: id('sti'),
            stocktakeId: st.id,
            inventoryItemId: l.inventoryItemId as string,
            itemName: l.itemName as string,
            unit: l.unit as string,
            expectedQuantity: l.expectedQuantity as number,
            costPerUnit: l.costPerUnit as number,
            countedQuantity: null,
            varianceQuantity: null,
            varianceValue: null,
            lineNote: '',
            countedAt: null,
            countedByName: '',
            stockTransactionId: null,
          })
        }
        if (include?.lines) {
          return { ...st, lines: stocktakeItems.filter(l => l.stocktakeId === st.id).map(l => ({ ...l })) }
        }
        return { ...st }
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        // Pogojni status guard — WHERE se ponovno vrednoti ob update (realna DB)
        const st = stocktakes.find(s => stocktakeMatches(s, where))
        if (!st) return { count: 0 }
        for (const [k, v] of Object.entries(data)) {
          if (k === 'recountCount') {
            st.recountCount += (v as { increment: number }).increment
          } else {
            ;(st as unknown as Record<string, unknown>)[k] = v
          }
        }
        return { count: 1 }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const st = stocktakes.find(s => s.id === where.id)
        if (!st) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
        Object.assign(st, data)
        return { ...st }
      },
    },
    stocktakeItem: {
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = stocktakeItems.find(l => l.id === where.id)
        if (!row) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
        Object.assign(row, data)
        return { ...row }
      },
      count: async ({ where }: { where: { stocktakeId: string; countedQuantity?: { not: null } } }) =>
        stocktakeItems.filter(l => l.stocktakeId === where.stocktakeId && (where.countedQuantity ? l.countedQuantity !== null : true)).length,
    },
    stockTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row: StockTxRow = {
          id: id('stx'),
          inventoryItemId: data.inventoryItemId as string,
          type: data.type as string,
          quantity: data.quantity as number,
          previousQty: data.previousQty as number,
          newQty: data.newQty as number,
          costPerUnit: data.costPerUnit as number,
          totalCost: data.totalCost as number,
          reason: data.reason as string,
          note: data.note as string,
          employeeName: data.employeeName as string,
        }
        stockTx.push(row)
        return { ...row }
      },
    },
    // R120 FEFO stubi: brez serij = no-op alokacija; kljice se beležijo za pine
    inventoryBatch: {
      findMany: async () => [],
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
    stockBatchAllocation: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'al-stub', ...data }),
      findMany: async () => [],
    },
  })

  const tx = {
    ...makeClients(),
    $executeRaw: async (_strings: TemplateStringsArray, lockKey: string) => {
      lockKeys.push(lockKey)
      return 0
    },
  }

  const db = {
    ...makeClients(),
    $transaction: async <T>(fn: (txClient: typeof tx) => Promise<T>) => fn(tx),
  }

  return {
    db, tx, inv, stocktakes, stocktakeItems, stockTx, audit, lockKeys,
    batchConsumptionCalls,
    resetBatchCalls: () => { batchConsumptionCalls.length = 0 },
    forceP2002Next: () => { createThrowsP2002Next = true },
  }
}

// vi.hoisted — mock factory se izvede PRED modulskim scope-om
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: async (entry: Record<string, unknown>) => {
    ref.current.audit.push(entry)
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))
// R120 mirror hook — zajamemo klice za FEFO pin (batchConsumptionCalls)
vi.mock('@/lib/stock-deduction/batch-allocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stock-deduction/batch-allocation')>()
  return {
    ...actual,
    recordBatchConsumption: async (tx: unknown, opts: Record<string, unknown>) => {
      ref.current.batchConsumptionCalls.push(opts)
      return (actual.recordBatchConsumption as unknown as (t: unknown, o: Record<string, unknown>) => Promise<unknown>)(tx, opts)
    },
  }
})
const requireAuthMock = vi.fn()
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => requireAuthMock(...args),
    // resolveTenantLocationIdOrThrow ostane REALNA (pure) — tenant semantika zares
  }
})

import { POST as stocktakePost, GET as stocktakeGet } from '@/app/api/stocktakes/route'
import { GET as detailGet, PATCH as detailPatch } from '@/app/api/stocktakes/[id]/route'
import { POST as submitPost } from '@/app/api/stocktakes/[id]/submit/route'
import { POST as approvePost } from '@/app/api/stocktakes/[id]/approve/route'
import { POST as recountPost } from '@/app/api/stocktakes/[id]/recount/route'
import { POST as cancelPost } from '@/app/api/stocktakes/[id]/cancel/route'

const state = ref.current

// ---------- Helperji ----------
function session(s: { locationId?: string | null; role?: string; employeeId?: string | null } | null) {
  requireAuthMock.mockResolvedValue(
    s
      ? { session: { employeeId: 'emp-9', ...s }, error: null }
      : { session: null, error: new Response('unauth', { status: 401 }) },
  )
}

function post(body: unknown, query = '') {
  return new Request(`http://localhost:3000/api/stocktakes${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchReq(id: string, body: unknown) {
  return new Request(`http://localhost:3000/api/stocktakes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const PATCH_PARAMS = (id: string) => ({ params: Promise.resolve({ id }) })

function action(id: string, verb: 'submit' | 'approve' | 'recount' | 'cancel') {
  return new Request(`http://localhost:3000/api/stocktakes/${id}/${verb}`, { method: 'POST' })
}

const ACTION_PARAMS = (id: string) => ({ params: Promise.resolve({ id }) })

function detailReq(id: string) {
  return new Request(`http://localhost:3000/api/stocktakes/${id}`)
}

/** Celoten workflow do IN_REVIEW (create → count vsi → submit) */
async function createCountSubmit(opts: {
  counts: { lineIndex: number; counted: number }[]
  locationId?: string
  note?: string
}) {
  const locationId = opts.locationId ?? LOC_1
  session({ locationId, role: 'manager' })
  const res = await stocktakePost(post({ note: opts.note ?? '', idempotencyKey: `k-${Math.random()}` }))
  expect(res.status).toBe(201)
  const created = (await res.json()).stocktake
  const counts = opts.counts.map(c => ({
    lineId: created.lines[c.lineIndex].id,
    countedQuantity: c.counted,
  }))
  const pRes = await detailPatch(patchReq(created.id, { counts }), PATCH_PARAMS(created.id))
  expect(pRes.status).toBe(200)
  const sRes = await submitPost(action(created.id, 'submit'), ACTION_PARAMS(created.id))
  expect(sRes.status).toBe(200)
  return created
}

beforeEach(() => {
  vi.clearAllMocks()
  state.inv.length = 0
  state.stocktakes.length = 0
  state.stocktakeItems.length = 0
  state.stockTx.length = 0
  state.audit.length = 0
  state.lockKeys.length = 0
  state.resetBatchCalls()
  state.inv.push(
    { id: 'inv-a', name: 'Mozzarella', unit: 'kg', quantity: 10, costPerUnit: 2.5, locationId: LOC_1 },
    { id: 'inv-b', name: 'Testo', unit: 'kg', quantity: 5, costPerUnit: 1, locationId: LOC_1 },
    { id: 'inv-c', name: 'Olje', unit: 'L', quantity: 8, costPerUnit: 6, locationId: null },
    { id: 'inv-x', name: 'Klobasa', unit: 'kg', quantity: 20, costPerUnit: 7, locationId: LOC_2 },
  )
})

// ============================================
// S-1 CREATE
// ============================================
describe('POST /api/stocktakes — create', () => {
  it('DRAFT inventura s snapshotom teoretičnega stanja obsega (lastna + skupni vir)', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await stocktakePost(post({ note: 'Mesečna inventura', idempotencyKey: 'k-1' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.replay).toBe(false)
    expect(data.stocktake.status).toBe('DRAFT')
    expect(data.stocktake.locationId).toBe(LOC_1)
    expect(data.stocktake.createdByName).toBe('emp-9')
    // obseg: inv-a, inv-b (lastna) + inv-c (skupni vir) — brez inv-x (tuja lokacija)
    const items = data.stocktake.lines.map((l: { inventoryItemId: string }) => l.inventoryItemId).sort()
    expect(items).toEqual(['inv-a', 'inv-b', 'inv-c'])
    const lineA = data.stocktake.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === 'inv-a')
    expect(lineA.expectedQuantity).toBe(10)
    expect(lineA.costPerUnit).toBe(2.5)
    expect(lineA.itemName).toBe('Mozzarella')
    expect(lineA.unit).toBe('kg')
    expect(lineA.countedQuantity).toBeNull()
    expect(state.audit[0]).toMatchObject({ action: 'STOCKTAKE_CREATE', entityType: 'Stocktake', locationId: LOC_1 })
  })

  it('super-admin brez izrecnega locationId → 400 (fail-closed)', async () => {
    session({ locationId: null, role: 'admin' })
    const res = await stocktakePost(post({}))
    expect(res.status).toBe(400)
    expect(state.stocktakes).toHaveLength(0)
  })

  it('super-admin z izrecnim locationId → ustvari na tej lokaciji', async () => {
    session({ locationId: null, role: 'admin' })
    const res = await stocktakePost(post({ locationId: LOC_2, idempotencyKey: 'k-admin' }))
    expect(res.status).toBe(201)
    expect((await res.json()).stocktake.locationId).toBe(LOC_2)
  })
})

// ============================================
// S-2 IDEMPOTENCA CREATE
// ============================================
describe('POST /api/stocktakes — idempotency', () => {
  it('retry z istim ključem → 200 replay + ENA inventura', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const body = { note: 'x', idempotencyKey: 'same-key' }
    const first = await stocktakePost(post(body))
    expect(first.status).toBe(201)
    const firstId = (await first.json()).stocktake.id
    const retry = await stocktakePost(post(body))
    expect(retry.status).toBe(200)
    const retryJson = await retry.json()
    expect(retryJson.replay).toBe(true)
    expect(retryJson.stocktake.id).toBe(firstId)
    expect(state.stocktakes).toHaveLength(1)
  })

  it('P2002 race (dva vzporedna zahtevka, isti ključ) → 409 z nagovorom', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    state.forceP2002Next()
    const res = await stocktakePost(post({ idempotencyKey: 'race-key' }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('idempotencyKey')
  })
})

// ============================================
// S-3 ŠTETJE (PATCH)
// ============================================
describe('PATCH /api/stocktakes/[id] — štetje', () => {
  it('vnos količin: variance snapshot = counted − expected, vrednost × cost', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await stocktakePost(post({ idempotencyKey: 'k-c1' }))
    const created = (await res.json()).stocktake
    const lineA = created.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === 'inv-a')

    const pRes = await detailPatch(patchReq(created.id, {
      counts: [{ lineId: lineA.id, countedQuantity: 7.5, lineNote: 'razbita embalaža' }],
    }), PATCH_PARAMS(created.id))
    expect(pRes.status).toBe(200)
    const updated = (await pRes.json()).stocktake
    const updA = updated.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === 'inv-a')
    expect(updA.countedQuantity).toBe(7.5)
    expect(updA.varianceQuantity).toBe(-2.5) // 7.5 − 10
    expect(updA.varianceValue).toBe(-6.25)   // −2.5 × 2.5
    expect(updA.lineNote).toBe('razbita embalaža')
    expect(updA.countedByName).toBe('emp-9')
    expect(updA.countedAt).not.toBeNull()
    // še ne potrjeno → zaloga NESPREMENJENA, brez ledger vrstice
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(10)
    expect(state.stockTx).toHaveLength(0)
  })

  it('negativno štetje → 400; tuja vrstica → 400; zaloga se ne spremeni (fail-closed)', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await stocktakePost(post({ idempotencyKey: 'k-c2' }))
    const created = (await res.json()).stocktake
    const lineA = created.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === 'inv-a')

    const neg = await detailPatch(patchReq(created.id, { counts: [{ lineId: lineA.id, countedQuantity: -1 }] }), PATCH_PARAMS(created.id))
    expect(neg.status).toBe(400)

    const foreign = await detailPatch(patchReq(created.id, { counts: [{ lineId: 'sti-tuj', countedQuantity: 5 }] }), PATCH_PARAMS(created.id))
    expect(foreign.status).toBe(400)

    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(10)
    expect(state.stocktakeItems.find(l => l.id === lineA.id)!.countedQuantity).toBeNull()
  })
})

// ============================================
// S-4 ZAKLEP ŠTETJA
// ============================================
describe('PATCH — zaklep štetja izven DRAFT', () => {
  it('PATCH na IN_REVIEW → 409 (štetje zaklenjeno, recount route ga vrne)', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    session({ locationId: LOC_1, role: 'manager' })
    const lineA = state.stocktakeItems.find(l => l.stocktakeId === created.id && l.inventoryItemId === 'inv-a')!
    const res = await detailPatch(patchReq(created.id, { counts: [{ lineId: lineA.id, countedQuantity: 9 }] }), PATCH_PARAMS(created.id))
    expect(res.status).toBe(409)
    expect(state.stocktakeItems.find(l => l.id === lineA.id)!.countedQuantity).toBe(7)
  })
})

// ============================================
// S-5 SUBMIT
// ============================================
describe('POST /api/stocktakes/[id]/submit', () => {
  it('brez preštecenih vrstic → 400', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await stocktakePost(post({ idempotencyKey: 'k-s0' }))
    const created = (await res.json()).stocktake
    const sRes = await submitPost(action(created.id, 'submit'), ACTION_PARAMS(created.id))
    expect(sRes.status).toBe(400)
    expect(state.stocktakes[0].status).toBe('DRAFT')
  })

  it('DRAFT → IN_REVIEW + submittedAt + audit; dvojni submit → 409', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    expect(state.stocktakes[0].status).toBe('IN_REVIEW')
    expect(state.stocktakes[0].submittedAt).not.toBeNull()
    const submitAction = state.audit.find(a => a.action === 'STOCKTAKE_SUBMIT')
    expect(submitAction).toMatchObject({ entityType: 'Stocktake', locationId: LOC_1 })

    session({ locationId: LOC_1, role: 'manager' })
    const again = await submitPost(action(created.id, 'submit'), ACTION_PARAMS(created.id))
    expect(again.status).toBe(409)
  })
})

// ============================================
// S-6/S-7 APPROVE — korekcije skozi ledger
// ============================================
describe('POST /api/stocktakes/[id]/approve — apliciranje korekcij', () => {
  it('negativna razlika: zaloga = preštetje, write-off ledger, FEFO hook, summary, audit', async () => {
    const created = await createCountSubmit({
      counts: [
        { lineIndex: 0, counted: 7.5 },  // inv-a: 10 → 7.5 (−2.5 × 2.5 = −6.25)
        { lineIndex: 1, counted: 5 },    // inv-b: 5 → 5 (brez razlike — brez ledger vrstice)
      ],
    })
    const txCountBefore = state.stockTx.length
    session({ locationId: LOC_1, role: 'manager' })
    const res = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.stocktake.status).toBe('APPROVED')
    expect(data.stocktake.approvedAt).not.toBeNull()
    expect(data.summary.adjustedLines).toBe(1) // samo inv-a
    expect(data.summary.totalVarianceValue).toBe(-6.25)
    expect(data.summary.lines).toEqual([{ itemName: 'Mozzarella', appliedDiff: -2.5, newQty: 7.5 }])

    // new baseline = preštetje
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(7.5)
    expect(state.inv.find(i => i.id === 'inv-b')!.quantity).toBe(5)

    // ledger: točno ena nova vrstica (inv-b ni imela razlike)
    expect(state.stockTx.length).toBe(txCountBefore + 1)
    const stx = state.stockTx[txCountBefore]
    expect(stx.type).toBe('write-off')
    expect(stx.quantity).toBe(-2.5)
    expect(stx.previousQty).toBe(10)
    expect(stx.newQty).toBe(7.5)
    expect(stx.reason).toContain('Inventura')
    expect(stx.employeeName).toBe('emp-9')
    // vrstica nosi povezavo na aplicirano korekcijo
    const lineA = state.stocktakeItems.find(l => l.stocktakeId === created.id && l.inventoryItemId === 'inv-a')!
    expect(lineA.stockTransactionId).toBe(stx.id)
    const lineB = state.stocktakeItems.find(l => l.stocktakeId === created.id && l.inventoryItemId === 'inv-b')!
    expect(lineB.stockTransactionId).toBeNull()

    // FEFO batch hook za minus (R120 mirror)
    expect(state.batchConsumptionCalls).toEqual([
      { inventoryItemId: 'inv-a', quantity: 2.5, stockTransactionId: stx.id },
    ])

    expect(state.audit.find(a => a.action === 'STOCKTAKE_APPROVE')).toMatchObject({
      entityType: 'Stocktake',
      locationId: LOC_1,
    })
  })

  it('pozitivna razlika → adjustment ledger tip', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 1, counted: 8 }] })
    session({ locationId: LOC_1, role: 'manager' })
    const res = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.summary.lines).toEqual([{ itemName: 'Testo', appliedDiff: 3, newQty: 8 }])
    expect(state.stockTx[0].type).toBe('adjustment')
    expect(state.stockTx[0].quantity).toBe(3)
    expect(state.inv.find(i => i.id === 'inv-b')!.quantity).toBe(8)
    // pozitivna razlika NE kliče batch consumption (plus = unbatched)
    expect(state.batchConsumptionCalls).toHaveLength(0)
  })

  it('DRIFT: prodaja med štetjem in potrditvijo → aplicirana razlika glede na tx-fresh zalogo, končna = preštetje', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    // med štetjem in potrditvijo prodaja odvzame 1 kg (10 → 9)
    state.inv.find(i => i.id === 'inv-a')!.quantity = 9
    session({ locationId: LOC_1, role: 'manager' })
    const res = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(res.status).toBe(200)
    const data = await res.json()
    // aplicirano: 7 − 9 = −2 (ne −3 kot snapshot); končna zaloga = preštetje 7
    expect(data.summary.lines).toEqual([{ itemName: 'Mozzarella', appliedDiff: -2, newQty: 7 }])
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(7)
    expect(state.stockTx[0].previousQty).toBe(9)
    expect(state.stockTx[0].newQty).toBe(7)
  })
})

// ============================================
// S-9 ZAŠČITA PRED DVOJNO POTRDITVIJO
// ============================================
describe('POST approve — dvojna potrditev', () => {
  it('zaporedni drugi approve → 409, brez dodatnih korekcij', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    session({ locationId: LOC_1, role: 'manager' })
    const first = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(first.status).toBe(200)
    const txCount = state.stockTx.length
    const second = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(second.status).toBe(409)
    expect(state.stockTx.length).toBe(txCount)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(7)
  })

  it('VZPOREDNI approve (Promise.all) → natanko ENA aplicirana korekcija', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    session({ locationId: LOC_1, role: 'manager' })
    // event-loop interleave: oba approve-a tečeta vzporedno; pogojni updateMany
    // status claim (realna DB semantika v trap DB) pusti skozi natanko ENEGA
    const [a, b] = await Promise.all([
      approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id)),
      approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id)),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])
    // točno ena ledger vrstica + točno ena korekcija zaloge
    expect(state.stockTx).toHaveLength(1)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(7)
    expect(state.stocktakes[0].status).toBe('APPROVED')
  })
})

// ============================================
// S-10 TENANT/LOCATION ISOLATION
// ============================================
describe('tenant/location isolation', () => {
  it('tuja inventura (loc-2) za loc-1 sejo → 404 na GET/PATCH/submit/approve/recount/cancel', async () => {
    // inventura na loc-2 (super-admin izrecno)
    session({ locationId: null, role: 'admin' })
    const res = await stocktakePost(post({ locationId: LOC_2, idempotencyKey: 'k-foreign' }))
    const created = (await res.json()).stocktake
    const lineX = created.lines[0]

    session({ locationId: LOC_1, role: 'manager' })
    expect((await detailGet(detailReq(created.id), PATCH_PARAMS(created.id))).status).toBe(404)
    expect((await detailPatch(patchReq(created.id, { counts: [{ lineId: lineX.id, countedQuantity: 1 }] }), PATCH_PARAMS(created.id))).status).toBe(404)
    expect((await submitPost(action(created.id, 'submit'), ACTION_PARAMS(created.id))).status).toBe(404)
    expect((await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))).status).toBe(404)
    expect((await recountPost(action(created.id, 'recount'), ACTION_PARAMS(created.id))).status).toBe(404)
    expect((await cancelPost(action(created.id, 'cancel'), ACTION_PARAMS(created.id))).status).toBe(404)
    // NIČ se ni spremenilo
    expect(state.stocktakes[0].status).toBe('DRAFT')
    expect(state.stocktakeItems.find(l => l.id === lineX.id)!.countedQuantity).toBeNull()
    expect(state.inv.find(i => i.id === 'inv-x')!.quantity).toBe(20)
  })

  it('GET seznam: loc-1 seja vidi samo loc-1 inventure', async () => {
    session({ locationId: null, role: 'admin' })
    await stocktakePost(post({ locationId: LOC_2, idempotencyKey: 'k-l2' }))
    session({ locationId: LOC_1, role: 'manager' })
    await stocktakePost(post({ idempotencyKey: 'k-l1' }))
    const res = await stocktakeGet(new Request('http://localhost:3000/api/stocktakes'))
    const data = await res.json()
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].locationId).toBe(LOC_1)
  })
})

// ============================================
// S-11 CANCEL
// ============================================
describe('POST /api/stocktakes/[id]/cancel', () => {
  it('cancel iz DRAFT: brez korekcij zaloge; approve po cancelu → 409', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await stocktakePost(post({ idempotencyKey: 'k-x1' }))
    const created = (await res.json()).stocktake

    const cRes = await cancelPost(action(created.id, 'cancel'), ACTION_PARAMS(created.id))
    expect(cRes.status).toBe(200)
    expect((await cRes.json()).stocktake.status).toBe('CANCELLED')
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(10)
    expect(state.stockTx).toHaveLength(0)

    const aRes = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(aRes.status).toBe(409)
  })

  it('cancel APPROVED → 409 (ledger ostaja resnica)', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    session({ locationId: LOC_1, role: 'manager' })
    await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    const cRes = await cancelPost(action(created.id, 'cancel'), ACTION_PARAMS(created.id))
    expect(cRes.status).toBe(409)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(7)
  })
})

// ============================================
// S-12 RECOUNT
// ============================================
describe('POST /api/stocktakes/[id]/recount', () => {
  it('IN_REVIEW → DRAFT (recountCount++), popravljivo štetje, ponovna potrditev', async () => {
    const created = await createCountSubmit({ counts: [{ lineIndex: 0, counted: 7 }] })
    session({ locationId: LOC_1, role: 'manager' })

    const rRes = await recountPost(action(created.id, 'recount'), ACTION_PARAMS(created.id))
    expect(rRes.status).toBe(200)
    expect((await rRes.json()).stocktake.status).toBe('DRAFT')
    expect(state.stocktakes[0].recountCount).toBe(1)

    // ponovno štetje: 9.5
    const lineA = state.stocktakeItems.find(l => l.stocktakeId === created.id && l.inventoryItemId === 'inv-a')!
    const pRes = await detailPatch(patchReq(created.id, { counts: [{ lineId: lineA.id, countedQuantity: 9.5 }] }), PATCH_PARAMS(created.id))
    expect(pRes.status).toBe(200)
    await submitPost(action(created.id, 'submit'), ACTION_PARAMS(created.id))
    const aRes = await approvePost(action(created.id, 'approve'), ACTION_PARAMS(created.id))
    expect(aRes.status).toBe(200)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(9.5)
  })

  it('recount iz DRAFT → 409', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await stocktakePost(post({ idempotencyKey: 'k-r2' }))
    const created = (await res.json()).stocktake
    expect((await recountPost(action(created.id, 'recount'), ACTION_PARAMS(created.id))).status).toBe(409)
  })
})

// ============================================
// S-13 STRUKTURNI PINI (P0-01 kanon)
// ============================================
describe('strukturni pini — P0-01 kanon', () => {
  const helperSource = () =>
    readFileSync(join(process.cwd(), 'src/app/api/stocktakes/_helpers/stocktake-mutations.ts'), 'utf8')
  const approveRouteSource = () =>
    readFileSync(join(process.cwd(), 'src/app/api/stocktakes/[id]/approve/route.ts'), 'utf8')

  it('approve uporablja SKUPNI advisory lock ključ (inv-stock:) — serializacija s prodajo/odpadom', () => {
    expect(helperSource()).toContain('inventoryStockLockKey(line.inventoryItemId)')
    expect(state.lockKeys.every(k => k.startsWith('inv-stock:'))).toBe(true)
  })

  it('approve claim je POGOJNI updateMany na status IN_REVIEW (zaščita pred dvojno potrditvijo)', () => {
    const src = helperSource()
    expect(src).toContain("where: { id: stocktakeId, status: 'IN_REVIEW' }")
    expect(src).toContain('claim.count === 0')
  })

  it('korekcija gre skozi ledger (StockTransaction), ne gol update količine', () => {
    const src = helperSource()
    expect(src).toContain('tx.stockTransaction.create')
    expect(src).toContain("'adjustment' : 'write-off'")
    expect(src).toContain('previousQty: currentQty')
    expect(src).toContain('newQty: currentQty + appliedDiff')
  })

  it('minus korekcija ima FEFO batch hook (R120 mirror)', () => {
    expect(helperSource()).toContain('recordBatchConsumption(tx,')
  })

  it('submit zahteva vsaj eno prešteco vrstico', () => {
    expect(helperSource()).toContain('Inventura nima nobene preštecene vrstice')
  })

  it('approve route ima P2034 → 409 sočasnostno zaščito', () => {
    expect(approveRouteSource()).toContain('P2034')
  })
})
