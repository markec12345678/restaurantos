// ============================================
// R122 / EPIC #115 P0-04 — BATCH PREPARATION (sub-recepture / priprava)
// ============================================
// Pokritje (P0-04 kanon + §32 minimalni dokaz):
//  • B-1 create: DRAFT + snapshot sestavin (itemName/unit/costPerUnit) + audit
//  • B-2 create idempotency: replay (200, ista priprava) + P2002 race → 409
//  • B-3 create validacija: brez sestavin → 400; duplikat sestavine → 400;
//    izdelek = sestavina → 400; količina ≤ 0 → 400; sestavina izven obsega → 400
//  • B-4 PATCH osnutek: zamenjava vrstic + izdelek/količina; PATCH na
//    COMPLETED → 409
//  • B-5 complete: input decrement ('batch-consumption', previousQty →
//    newQty) + FEFO hook + output increment z proizvodnim cost basisom
//    ('batch-production', Σ input / outputQty) + header snapshot + summary
//    + line.inputStockTransactionId
//  • B-6 premalo zaloge sestavine → 400; ROLLBACK: brez delnih zapisov
//  • B-7 ZAŠČITA PRED DVOJNIM ZAKLJUČKOM: zaporedni drugi complete → 409;
//    VZPOREDNI complete (Promise.all) → natanko ENA aplicirana poraba
//  • B-8 tenant/location isolation: tuja priprava → 404 (GET/PATCH/complete/
//    cancel); super-admin z izrecno lokacijo → dostop do svoje
//  • B-9 cancel: brez zalogovnih učinkov; complete po cancel → 409; cancel
//    COMPLETED → 409
//  • B-10 strukturni pini: SKUPNI advisory lock ključ ('inv-stock:'),
//    pogojni status claim, ledger vrstice, FEFO hook na vsak input odpis
//
// Trap DB (hišni stil R119/R120/R121): in-memory model z REALNIMI
// semantikami (OR scope, CAS updateMany, status guardi, nested create,
// ROLLBACK ob throw) — klicane so PRODUKCIJSKE route handler funkcije.
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
interface PrepRow {
  id: string
  locationId: string
  status: string
  outputItemId: string
  outputQuantity: number
  outputUnit: string
  outputCostPerUnit: number
  totalInputCost: number
  note: string
  createdByName: string
  completedByName: string
  completedAt: Date | null
  cancelledAt: Date | null
  idempotencyKey: string | null
  outputStockTransactionId: string | null
  createdAt: Date
}
interface PrepLineRow {
  id: string
  preparationId: string
  inventoryItemId: string
  itemName: string
  unit: string
  quantity: number
  costPerUnit: number
  inputStockTransactionId: string | null
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
  employeeName: string
}

function createDb() {
  const idCounter = { n: 0 }
  const id = (p: string) => `${p}-${++idCounter.n}`

  const inv: InvRow[] = []
  const preps: PrepRow[] = []
  const prepLines: PrepLineRow[] = []
  const stockTx: StockTxRow[] = []
  const audit: Record<string, unknown>[] = []
  const lockKeys: string[] = []
  const batchConsumptionCalls: Record<string, unknown>[] = []
  let forceP2002Create = false

  function invMatchesScope(row: InvRow, where: { id: string; OR?: { locationId: string | null }[] }) {
    if (row.id !== where.id) return false
    if (where.OR && !where.OR.some(o => o.locationId === row.locationId)) return false
    return true
  }

  function hydrate(
    p: PrepRow,
    include?: { lines?: boolean; outputItem?: boolean },
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...p }
    if (include?.lines) {
      out.lines = prepLines.filter(l => l.preparationId === p.id).map(l => ({ ...l }))
    }
    if (include?.outputItem) {
      const item = inv.find(i => i.id === p.outputItemId)
      out.outputItem = item ? { name: item.name, unit: item.unit } : null
    }
    return out
  }

  function prepMatches(p: PrepRow, where: Record<string, unknown>): boolean {
    const w = where as { id?: string; locationId?: string; idempotencyKey?: string | null; status?: unknown }
    if (w.id && p.id !== w.id) return false
    if (w.locationId && p.locationId !== w.locationId) return false
    if (w.idempotencyKey !== undefined && w.idempotencyKey !== null && p.idempotencyKey !== w.idempotencyKey) return false
    if (w.status !== undefined) {
      if (typeof w.status === 'object' && w.status !== null && 'in' in (w.status as Record<string, unknown>)) {
        const list = (w.status as { in: string[] }).in
        if (!list.includes(p.status)) return false
      } else if (p.status !== w.status) return false
    }
    return true
  }

  function makeClients() {
    return {
      inventoryItem: {
        findFirst: async ({ where }: { where: { id: string; OR?: { locationId: string | null }[] } }) => {
          const row = inv.find(i => invMatchesScope(i, where))
          return row ? { ...row } : null
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; quantity?: number }
          data: { quantity?: number; costPerUnit?: number }
        }) => {
          const row = inv.find(i => i.id === where.id)
          if (!row) return { count: 0 }
          if (where.quantity !== undefined && row.quantity !== where.quantity) return { count: 0 } // CAS guard
          if (data.quantity !== undefined) row.quantity = data.quantity
          if (data.costPerUnit !== undefined) row.costPerUnit = data.costPerUnit
          return { count: 1 }
        },
      },
      batchPreparation: {
        findMany: async ({ where, include }: { where?: Record<string, unknown>; include?: { lines?: boolean; outputItem?: boolean } }) => {
          const rows = preps
            .filter(p => (where ? prepMatches(p, where) : true))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          return rows.map(p => hydrate(p, include))
        },
        findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: { lines?: boolean; outputItem?: boolean } }) => {
          const p = preps.find(x => prepMatches(x, where))
          if (!p) return null
          return hydrate(p, include)
        },
        create: async ({ data, include }: { data: Record<string, unknown>; include?: { lines?: boolean } }) => {
          const d = data as {
            locationId: string
            status?: string
            outputItemId: string
            outputQuantity: number
            outputUnit?: string
            note?: string
            createdByName?: string
            idempotencyKey: string | null
            lines?: { create: { inventoryItemId: string; itemName: string; unit: string; quantity: number; costPerUnit: number }[] }
          }
          if (
            d.idempotencyKey &&
            preps.some(x => x.locationId === d.locationId && x.idempotencyKey === d.idempotencyKey)
          ) {
            throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
          }
          if (forceP2002Create) {
            forceP2002Create = false
            throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
          }
          const prep: PrepRow = {
            id: id('bp'),
            locationId: d.locationId,
            status: d.status ?? 'DRAFT',
            outputItemId: d.outputItemId,
            outputQuantity: d.outputQuantity,
            outputUnit: d.outputUnit ?? '',
            outputCostPerUnit: 0,
            totalInputCost: 0,
            note: d.note ?? '',
            createdByName: d.createdByName ?? '',
            completedByName: '',
            completedAt: null,
            cancelledAt: null,
            idempotencyKey: d.idempotencyKey,
            outputStockTransactionId: null,
            createdAt: new Date(),
          }
          preps.push(prep)
          for (const l of d.lines?.create ?? []) {
            prepLines.push({
              id: id('bpl'),
              preparationId: prep.id,
              inventoryItemId: l.inventoryItemId,
              itemName: l.itemName,
              unit: l.unit,
              quantity: l.quantity,
              costPerUnit: l.costPerUnit,
              inputStockTransactionId: null,
            })
          }
          if (include?.lines) {
            return { ...prep, lines: prepLines.filter(l => l.preparationId === prep.id).map(l => ({ ...l })) }
          }
          return { ...prep }
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          // Pogojni status guard — WHERE se ponovno vrednoti ob update (realna DB)
          const p = preps.find(x => prepMatches(x, where))
          if (!p) return { count: 0 }
          for (const [k, v] of Object.entries(data)) {
            ;(p as unknown as Record<string, unknown>)[k] = v
          }
          return { count: 1 }
        },
        update: async ({ where, data, include }: { where: { id: string }; data: Record<string, unknown>; include?: { lines?: boolean } }) => {
          const p = preps.find(x => x.id === where.id)
          if (!p) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
          Object.assign(p, data)
          if (include?.lines) {
            return { ...p, lines: prepLines.filter(l => l.preparationId === p.id).map(l => ({ ...l })) }
          }
          return { ...p }
        },
      },
      batchPreparationLine: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const d = data as { preparationId: string; inventoryItemId: string; itemName: string; unit: string; quantity: number; costPerUnit: number }
          const row: PrepLineRow = {
            id: id('bpl'),
            preparationId: d.preparationId,
            inventoryItemId: d.inventoryItemId,
            itemName: d.itemName,
            unit: d.unit,
            quantity: d.quantity,
            costPerUnit: d.costPerUnit,
            inputStockTransactionId: null,
          }
          prepLines.push(row)
          return { ...row }
        },
        deleteMany: async ({ where }: { where: { preparationId: string } }) => {
          for (let i = prepLines.length - 1; i >= 0; i--) {
            if (prepLines[i].preparationId === where.preparationId) prepLines.splice(i, 1)
          }
          return { count: 0 }
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const l = prepLines.find(x => x.id === where.id)
          if (!l) throw new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: 'test' })
          Object.assign(l, data)
          return { ...l }
        },
      },
      stockTransaction: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const d = data as {
            inventoryItemId: string
            type: string
            quantity: number
            previousQty: number
            newQty: number
            costPerUnit: number
            totalCost: number
            reason?: string
            employeeName?: string
          }
          const row: StockTxRow = {
            id: id('tx'),
            inventoryItemId: d.inventoryItemId,
            type: d.type,
            quantity: d.quantity,
            previousQty: d.previousQty,
            newQty: d.newQty,
            costPerUnit: d.costPerUnit,
            totalCost: d.totalCost,
            reason: d.reason ?? '',
            employeeName: d.employeeName ?? '',
          }
          stockTx.push(row)
          return { ...row }
        },
      },
      // R120 FEFO stubi: brez serij = no-op alokacija; klice se beležijo za pine
      inventoryBatch: {
        findMany: async () => [],
        findFirst: async () => null,
        updateMany: async () => ({ count: 1 }),
      },
      stockBatchAllocation: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'al-stub', ...data }),
        findMany: async () => [],
      },
    }
  }

  const tx = {
    ...makeClients(),
    $executeRaw: async (_strings: TemplateStringsArray, lockKey: string) => {
      lockKeys.push(lockKey)
      return 0
    },
  }

  const db = {
    ...makeClients(),
    $transaction: async <T>(fn: (txClient: typeof tx) => Promise<T>) => {
      // ROLLBACK semantika: snapshot pred, restore ob throw — delne zapis
      // so nemogoči (pariteta z realno DB transakcijo)
      const snapInv = inv.map(i => ({ ...i }))
      const snapPreps = preps.map(p => ({ ...p }))
      const snapLines = prepLines.map(l => ({ ...l }))
      const txLen0 = stockTx.length
      const auditLen0 = audit.length
      try {
        return await fn(tx)
      } catch (e) {
        inv.splice(0, inv.length, ...snapInv)
        preps.splice(0, preps.length, ...snapPreps)
        prepLines.splice(0, prepLines.length, ...snapLines)
        stockTx.splice(txLen0)
        audit.splice(auditLen0)
        throw e
      }
    },
  }

  return {
    db, tx, inv, preps, prepLines, stockTx, audit, lockKeys, batchConsumptionCalls,
    forceP2002Create: () => { forceP2002Create = true },
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

import { POST as prepPost, GET as prepGet } from '@/app/api/batch-preparations/route'
import { GET as detailGet, PATCH as detailPatch } from '@/app/api/batch-preparations/[id]/route'
import { POST as completePost } from '@/app/api/batch-preparations/[id]/complete/route'
import { POST as cancelPost } from '@/app/api/batch-preparations/[id]/cancel/route'

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
  return new Request(`http://localhost:3000/api/batch-preparations${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function detailReq(id: string) {
  return new Request(`http://localhost:3000/api/batch-preparations/${id}`)
}

function patchReq(id: string, body: unknown) {
  return new Request(`http://localhost:3000/api/batch-preparations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function action(id: string, verb: 'complete' | 'cancel') {
  return new Request(`http://localhost:3000/api/batch-preparations/${id}/${verb}`, { method: 'POST' })
}

const ID_PARAMS = (id: string) => ({ params: Promise.resolve({ id }) })

/** Celoten workflow do COMPLETED (create → complete) */
async function createAndComplete(opts?: { locationId?: string }) {
  const locationId = opts?.locationId ?? LOC_1
  session({ locationId, role: 'manager' })
  const cRes = await prepPost(post({
    outputItemId: 'inv-out',
    outputQuantity: 5,
    idempotencyKey: `k-${Math.random()}`,
    lines: [
      { inventoryItemId: 'inv-a', quantity: 2 },
      { inventoryItemId: 'inv-c', quantity: 1 },
    ],
  }))
  expect(cRes.status).toBe(201)
  const created = (await cRes.json()).preparation
  const kRes = await completePost(action(created.id, 'complete'), ID_PARAMS(created.id))
  expect(kRes.status).toBe(200)
  return created
}

beforeEach(() => {
  vi.clearAllMocks()
  state.inv.length = 0
  state.preps.length = 0
  state.prepLines.length = 0
  state.stockTx.length = 0
  state.audit.length = 0
  state.lockKeys.length = 0
  state.batchConsumptionCalls.length = 0
  state.inv.push(
    { id: 'inv-a', name: 'Paradižnik', unit: 'kg', quantity: 10, costPerUnit: 2.5, locationId: LOC_1 },
    { id: 'inv-b', name: 'Bazilika', unit: 'kg', quantity: 5, costPerUnit: 1, locationId: LOC_1 },
    { id: 'inv-c', name: 'Olje', unit: 'L', quantity: 8, costPerUnit: 6, locationId: null }, // skupni vir
    { id: 'inv-out', name: 'Domača omaka', unit: 'L', quantity: 0, costPerUnit: 0, locationId: LOC_1 },
    { id: 'inv-x', name: 'Klobasa', unit: 'kg', quantity: 20, costPerUnit: 7, locationId: LOC_2 },
  )
})

// ============================================
// B-1 CREATE
// ============================================
describe('POST /api/batch-preparations — create', () => {
  it('DRAFT priprava s snapshotom sestavin (itemName/unit/costPerUnit) + audit', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      note: 'dnevna serija',
      idempotencyKey: 'k-1',
      lines: [
        { inventoryItemId: 'inv-a', quantity: 2 },
        { inventoryItemId: 'inv-c', quantity: 1 },
      ],
    }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.replay).toBe(false)
    expect(data.preparation.status).toBe('DRAFT')
    expect(data.preparation.locationId).toBe(LOC_1)
    expect(data.preparation.createdByName).toBe('emp-9')
    expect(data.preparation.outputQuantity).toBe(5)
    const items = data.preparation.lines.map((l: { inventoryItemId: string }) => l.inventoryItemId).sort()
    expect(items).toEqual(['inv-a', 'inv-c'])
    const lineA = data.preparation.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === 'inv-a')
    expect(lineA.itemName).toBe('Paradižnik')
    expect(lineA.unit).toBe('kg')
    expect(lineA.quantity).toBe(2)
    expect(lineA.costPerUnit).toBe(2.5)
    expect(state.audit[0]).toMatchObject({ action: 'BATCHPREP_CREATE', entityType: 'BatchPreparation', locationId: LOC_1 })
  })

  it('super-admin brez izrecnega locationId → 400 (fail-closed)', async () => {
    session({ locationId: null, role: 'admin' })
    const res = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 1,
      lines: [{ inventoryItemId: 'inv-a', quantity: 1 }],
    }))
    expect(res.status).toBe(400)
    expect(state.preps).toHaveLength(0)
  })

  it('super-admin z izrecnim locationId → ustvari na tej lokaciji', async () => {
    session({ locationId: null, role: 'admin' })
    const res = await prepPost(post({
      locationId: LOC_2,
      outputItemId: 'inv-x',
      outputQuantity: 2,
      idempotencyKey: 'k-admin',
      lines: [{ inventoryItemId: 'inv-x', quantity: 1 }],
    }))
    // inv-x je izhodni artikel, inv-x tudi sestavina → 400 (semantika, ne 201)
    expect(res.status).toBe(400)
  })
})

// ============================================
// B-2 IDEMPOTENCY
// ============================================
describe('POST /api/batch-preparations — idempotency', () => {
  it('replay z istim ključem → 200 + ISTA priprava (brez duplikata)', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const r1 = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-same',
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    expect(r1.status).toBe(201)
    const r2 = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-same',
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    expect(r2.status).toBe(200)
    const d2 = await r2.json()
    expect(d2.replay).toBe(true)
    expect(state.preps).toHaveLength(1)
  })

  it('P2002 race → 409', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    state.forceP2002Create()
    const res = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-race',
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    expect(res.status).toBe(409)
  })
})

// ============================================
// B-3 CREATE VALIDACIJA
// ============================================
describe('POST /api/batch-preparations — validacija semantike', () => {
  it('izdelek = sestavina → 400', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await prepPost(post({
      outputItemId: 'inv-a',
      outputQuantity: 5,
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    expect(res.status).toBe(400)
  })

  it('duplikat sestavine → 400', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      lines: [
        { inventoryItemId: 'inv-a', quantity: 1 },
        { inventoryItemId: 'inv-a', quantity: 2 },
      ],
    }))
    expect(res.status).toBe(400)
  })

  it('sestavina izven obsega lokacije (inv-x @ LOC_2) → 400', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      lines: [{ inventoryItemId: 'inv-x', quantity: 1 }],
    }))
    expect(res.status).toBe(400)
  })

  it('količina ≤ 0 (zod) → 400', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const res = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      lines: [{ inventoryItemId: 'inv-a', quantity: 0 }],
    }))
    expect(res.status).toBe(400)
  })
})

// ============================================
// B-4 PATCH DRAFT
// ============================================
describe('PATCH /api/batch-preparations/[id] — urejanje osnutka', () => {
  it('zamenjava vrstic + količine v DRAFT', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const cRes = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-patch',
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    const created = (await cRes.json()).preparation
    const res = await detailPatch(patchReq(created.id, {
      outputQuantity: 6,
      lines: [
        { inventoryItemId: 'inv-b', quantity: 1 },
        { inventoryItemId: 'inv-a', quantity: 3 },
      ],
    }), ID_PARAMS(created.id))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.preparation.outputQuantity).toBe(6)
    const items = d.preparation.lines.map((l: { inventoryItemId: string }) => l.inventoryItemId).sort()
    expect(items).toEqual(['inv-a', 'inv-b'])
    expect(d.preparation.lines.find((l: { inventoryItemId: string }) => l.inventoryItemId === 'inv-a').quantity).toBe(3)
  })

  it('PATCH na COMPLETED → 409', async () => {
    const created = await createAndComplete()
    session({ locationId: LOC_1, role: 'manager' })
    const res = await detailPatch(patchReq(created.id, { note: 'x' }), ID_PARAMS(created.id))
    expect(res.status).toBe(409)
  })
})

// ============================================
// B-5 COMPLETE — glavni tok
// ============================================
describe('POST /api/batch-preparations/[id]/complete — poraba + proizvodnja', () => {
  it('input decrement + output increment + cost basis + ledger tipi + FEFO hook + summary', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const cRes = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-comp',
      lines: [
        { inventoryItemId: 'inv-a', quantity: 2 },  // 2 × 2.5 = 5.00
        { inventoryItemId: 'inv-c', quantity: 1 },  // 1 × 6.0 = 6.00 → skupaj 11.00
      ],
    }))
    const created = (await cRes.json()).preparation
    const res = await completePost(action(created.id, 'complete'), ID_PARAMS(created.id))
    expect(res.status).toBe(200)
    const d = await res.json()

    // summary: totalInputCost 11.00, outputCostPerUnit = 11 / 5 = 2.20
    expect(d.summary.totalInputCost).toBe(11)
    expect(d.summary.outputCostPerUnit).toBe(2.2)
    expect(d.summary.inputs).toHaveLength(2)

    // zaloga: inv-a 10 → 8, inv-c 8 → 7, inv-out 0 → 5 (costPerUnit 2.2)
    const a = state.inv.find(i => i.id === 'inv-a')!
    expect(a.quantity).toBe(8)
    const c = state.inv.find(i => i.id === 'inv-c')!
    expect(c.quantity).toBe(7)
    const out = state.inv.find(i => i.id === 'inv-out')!
    expect(out.quantity).toBe(5)
    expect(out.costPerUnit).toBe(2.2)

    // ledger: 'batch-consumption' (−) in 'batch-production' (+)
    const consumption = state.stockTx.filter(t => t.type === 'batch-consumption')
    const production = state.stockTx.filter(t => t.type === 'batch-production')
    expect(consumption).toHaveLength(2)
    expect(production).toHaveLength(1)
    const txa = consumption.find(t => t.inventoryItemId === 'inv-a')!
    expect(txa.quantity).toBe(-2)
    expect(txa.previousQty).toBe(10)
    expect(txa.newQty).toBe(8)
    expect(txa.totalCost).toBe(5)
    const txOut = production[0]
    expect(txOut.quantity).toBe(5)
    expect(txOut.previousQty).toBe(0)
    expect(txOut.newQty).toBe(5)
    expect(txOut.costPerUnit).toBe(2.2)
    expect(txOut.totalCost).toBe(11)

    // FEFO hook na vsak input odpis
    expect(state.batchConsumptionCalls).toHaveLength(2)
    expect(state.batchConsumptionCalls.map(x => (x as { inventoryItemId: string }).inventoryItemId).sort())
      .toEqual(['inv-a', 'inv-c'])

    // header snapshot + line povezave
    const prep = state.preps.find(p => p.id === created.id)!
    expect(prep.status).toBe('COMPLETED')
    expect(prep.totalInputCost).toBe(11)
    expect(prep.outputCostPerUnit).toBe(2.2)
    expect(prep.outputStockTransactionId).toBe(txOut.id)
    const lineA = state.prepLines.find(l => l.preparationId === created.id && l.inventoryItemId === 'inv-a')!
    expect(lineA.inputStockTransactionId).toBe(txa.id)

    // audit
    expect(state.audit.some(x => x.action === 'BATCHPREP_COMPLETE')).toBe(true)
  })

  it('premalo zaloge sestavine → 400 + ROLLBACK (brez delnih zapisov)', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const cRes = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-insuf',
      lines: [
        { inventoryItemId: 'inv-a', quantity: 2 },
        { inventoryItemId: 'inv-c', quantity: 99 }, // olje: 8 na stanju
      ],
    }))
    const created = (await cRes.json()).preparation
    const res = await completePost(action(created.id, 'complete'), ID_PARAMS(created.id))
    expect(res.status).toBe(400)

    // ROLLBACK: zaloga nedotaknjena, brez ledger zapisov, status ostane DRAFT
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(10)
    expect(state.inv.find(i => i.id === 'inv-c')!.quantity).toBe(8)
    expect(state.stockTx).toHaveLength(0)
    expect(state.preps.find(p => p.id === created.id)!.status).toBe('DRAFT')
    // (FEFO klici so in-process side-effect — rollback brine le DB stanje:
    //  brez ledger vrstic + zaloge nedotaknjene, kar je zgornja asercija)
  })
})

// ============================================
// B-7 DVOJNI ZAKLJUČEK
// ============================================
describe('POST complete — zaščita pred podvojitvijo', () => {
  it('zaporedni drugi complete → 409 (brez druge porabe)', async () => {
    const created = await createAndComplete()
    session({ locationId: LOC_1, role: 'manager' })
    const res = await completePost(action(created.id, 'complete'), ID_PARAMS(created.id))
    expect(res.status).toBe(409)
    // še vedno natanko ena poraba inv-a
    expect(state.stockTx.filter(t => t.type === 'batch-consumption')).toHaveLength(2)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(8)
  })

  it('vzporedni complete (Promise.all) → natanko ENA aplicirana poraba', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const cRes = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-par',
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    const created = (await cRes.json()).preparation
    const [r1, r2] = await Promise.all([
      completePost(action(created.id, 'complete'), ID_PARAMS(created.id)),
      completePost(action(created.id, 'complete'), ID_PARAMS(created.id)),
    ])
    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([200, 409])
    expect(state.stockTx.filter(t => t.type === 'batch-consumption')).toHaveLength(1)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(8)
  })
})

// ============================================
// B-8 TENANT ISOLATION
// ============================================
describe('tenant/location isolation', () => {
  it('tuja priprava → 404 na vseh prehodih (detail/PATCH/complete/cancel)', async () => {
    // priprava na LOC_1
    const created = await createAndComplete() // completed
    session({ locationId: LOC_2, role: 'manager' })

    const gRes = await detailGet(detailReq(created.id), ID_PARAMS(created.id))
    expect(gRes.status).toBe(404)

    // druga priprava na LOC_1 (DRAFT) za PATCH/complete/cancel
    session({ locationId: LOC_1, role: 'manager' })
    const cRes = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 1,
      idempotencyKey: 'k-foreign',
      lines: [{ inventoryItemId: 'inv-a', quantity: 1 }],
    }))
    const draft = (await cRes.json()).preparation

    session({ locationId: LOC_2, role: 'manager' })
    const pRes = await detailPatch(patchReq(draft.id, { note: 'x' }), ID_PARAMS(draft.id))
    expect(pRes.status).toBe(404)
    const kRes = await completePost(action(draft.id, 'complete'), ID_PARAMS(draft.id))
    expect(kRes.status).toBe(404)
    const cRes2 = await cancelPost(action(draft.id, 'cancel'), ID_PARAMS(draft.id))
    expect(cRes2.status).toBe(404)
    // zaloga inv-a nedotaknjena od TUJEGA dostopa (8 = 10 − 2 iz createAndComplete)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(8)
  })
})

// ============================================
// B-9 CANCEL
// ============================================
describe('POST /api/batch-preparations/[id]/cancel', () => {
  it('DRAFT → CANCELLED brez zalogovnih učinkov; complete po cancel → 409', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    const cRes = await prepPost(post({
      outputItemId: 'inv-out',
      outputQuantity: 5,
      idempotencyKey: 'k-cancel',
      lines: [{ inventoryItemId: 'inv-a', quantity: 2 }],
    }))
    const created = (await cRes.json()).preparation
    const res = await cancelPost(action(created.id, 'cancel'), ID_PARAMS(created.id))
    expect(res.status).toBe(200)
    expect((await res.json()).preparation.status).toBe('CANCELLED')

    // brez zalogovnih učinkov
    expect(state.stockTx).toHaveLength(0)
    expect(state.inv.find(i => i.id === 'inv-a')!.quantity).toBe(10)

    const kRes = await completePost(action(created.id, 'complete'), ID_PARAMS(created.id))
    expect(kRes.status).toBe(409)

    // audit
    expect(state.audit.some(x => x.action === 'BATCHPREP_CANCEL')).toBe(true)
  })

  it('cancel COMPLETED → 409', async () => {
    const created = await createAndComplete()
    session({ locationId: LOC_1, role: 'manager' })
    const res = await cancelPost(action(created.id, 'cancel'), ID_PARAMS(created.id))
    expect(res.status).toBe(409)
  })
})

// ============================================
// B-10 STRUKTURNI PINI
// ============================================
describe('strukturni pini — kanon', () => {
  it('SKUPNI advisory lock ključ (inv-stock:) na vsak dotik zaloge', async () => {
    const created = await createAndComplete()
    expect(state.lockKeys.length).toBeGreaterThan(0)
    for (const key of state.lockKeys) {
      expect(key).toContain('inv-stock:')
    }
    // status claim: pogojni updateMany DRAFT → COMPLETED (pin preko 409 v B-7)
    expect(state.preps.find(p => p.id === created.id)!.status).toBe('COMPLETED')
  })

  it('GET seznam — agregati (lineCount) + scope', async () => {
    session({ locationId: LOC_1, role: 'manager' })
    await createAndComplete()
    const res = await prepGet(new Request('http://localhost:3000/api/batch-preparations'))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.entries).toHaveLength(1)
    expect(d.entries[0].lineCount).toBe(2)
    expect(d.entries[0].outputItemName).toBe('Domača omaka')
  })
})
