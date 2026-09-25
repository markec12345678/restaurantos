// ============================================
// R131 / EPIC #115 P1-13 — SUPPLIER CATALOG ROUTE (trap DB)
// ============================================
// Trap DB (hišni stil, vzorec: r130-price-history-routes.test.ts — createDb
// factory + vi.hoisted ref + vi.mock('@/lib/db'), requireAuth mockan na MEJI,
// tenant resolverji REALNI):
//   GET    /api/suppliers/[id]/catalog — anon 401, napačna vloga 403, ghost
//          dobavitelj 404, prazen katalog, poln katalog (baseUnitPrice
//          izračunan, Decimal → number prek deepToNumbers, scope po artikel
//          lokaciji)
//   POST   /api/suppliers/[id]/catalog — anon 401, INVALID_INPUT (packQty 0 /
//          negativna cena), ghost dobavitelj 404, ghost artikel 404 (fail-
//          closed), upsert create 201 + audit, update 200, P2002 race → 409
//   DELETE /api/suppliers/[id]/catalog — manjkajoč ?catalogItemId= 400,
//          uspeh 200 { success }, ghost vrstica 404, tuja vrstica 404
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const SUP_1 = 'sup-1'
const SUP_GHOST = 'sup-ghost'
const ITEM_1 = 'inv-1'
const ITEM_2 = 'inv-2'
const ITEM_OUT = 'inv-out' // artikel na LOC_2 (scope)
const ITEM_GHOST = 'inv-ghost'

// --- Fake Decimal (Prisma.Decimal oblika: toNumber + toString) ---
const dec = (n: number) => ({ toNumber: () => n, toString: () => String(n) })

// ---------- Vrstice ----------
interface SupRow { id: string; name: string }
interface InvRow { id: string; name: string; unit: string; costPerUnit: number; locationId: string }
interface CatalogRow {
  id: string
  supplierId: string
  inventoryItemId: string
  supplierSku: string
  packQty: number
  packUnit: string
  pricePerPack: number
  vatRate: number | null
  minOrderPacks: number
  isActive: boolean
  note: string
}

const inList = (v: unknown): string[] | null =>
  v && typeof v === 'object' && Array.isArray((v as { in?: string[] }).in) ? (v as { in: string[] }).in : null

// ---------- Trap DB ----------
function createDb() {
  let seq = 0
  const id = (p: string) => `${p}-${++seq}`

  const suppliers: SupRow[] = []
  const inventoryItems: InvRow[] = []
  const catalog: CatalogRow[] = []
  const audit: Array<Record<string, unknown>> = []
  const captured = {
    siCreate: [] as Array<Record<string, unknown>>,
    siUpdate: [] as Array<Record<string, unknown>>,
    siDelete: [] as string[],
    createShouldConflict: false,
  }

  const serialize = (r: CatalogRow, withItem: boolean) => ({
    id: r.id,
    supplierId: r.supplierId,
    inventoryItemId: r.inventoryItemId,
    supplierSku: r.supplierSku,
    packQty: dec(r.packQty),
    packUnit: r.packUnit,
    pricePerPack: dec(r.pricePerPack),
    vatRate: r.vatRate == null ? null : dec(r.vatRate),
    minOrderPacks: r.minOrderPacks,
    isActive: r.isActive,
    note: r.note,
    ...(withItem
      ? {
          inventoryItem: {
            id: r.inventoryItemId,
            name: inventoryItems.find(i => i.id === r.inventoryItemId)?.name ?? '',
            unit: inventoryItems.find(i => i.id === r.inventoryItemId)?.unit ?? '',
            costPerUnit: dec(inventoryItems.find(i => i.id === r.inventoryItemId)?.costPerUnit ?? 0),
            locationId: inventoryItems.find(i => i.id === r.inventoryItemId)?.locationId ?? '',
          },
        }
      : {}),
  })

  const db = {
    supplier: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        suppliers.find(s => s.id === where.id) ?? null,
    },
    inventoryItem: {
      // POST lookup: findFirst po id (+ lokacijski scope)
      findFirst: async ({ where }: { where?: { id?: string; locationId?: string } } = {}) => {
        const row = inventoryItems.find(r =>
          (where?.id === undefined || r.id === where.id) &&
          (where?.locationId === undefined || r.locationId === where.locationId))
        return row ? { id: row.id, name: row.name, unit: row.unit } : null
      },
    },
    supplierItem: {
      findMany: async (args: { where?: { supplierId?: string }; take?: number } = {}) =>
        catalog
          .filter(r => !args.where?.supplierId || r.supplierId === args.where.supplierId)
          .slice(0, args.take ?? catalog.length)
          .map(r => serialize(r, true)),
      findFirst: async ({ where }: { where?: { id?: string; supplierId?: string } } = {}) => {
        const row = catalog.find(r =>
          (where?.id === undefined || r.id === where.id) &&
          (where?.supplierId === undefined || r.supplierId === where.supplierId))
        return row ? serialize(row, true) : null
      },
      findUnique: async ({ where }: {
        where: { supplierId_inventoryItemId: { supplierId: string; inventoryItemId: string } }
      }) => {
        const p = where.supplierId_inventoryItemId
        const row = catalog.find(r => r.supplierId === p.supplierId && r.inventoryItemId === p.inventoryItemId)
        return row ? { id: row.id } : null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (captured.createShouldConflict) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
        }
        captured.siCreate.push(data)
        const row: CatalogRow = {
          id: id('si'),
          supplierId: data.supplierId as string,
          inventoryItemId: data.inventoryItemId as string,
          supplierSku: (data.supplierSku as string) ?? '',
          packQty: data.packQty as number,
          packUnit: (data.packUnit as string) ?? 'paket',
          pricePerPack: data.pricePerPack as number,
          vatRate: (data.vatRate as number | null) ?? null,
          minOrderPacks: (data.minOrderPacks as number) ?? 1,
          isActive: (data.isActive as boolean) ?? true,
          note: (data.note as string) ?? '',
        }
        catalog.push(row)
        return { id: row.id }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.siUpdate.push({ id: where.id, data })
        const row = catalog.find(r => r.id === where.id)
        if (!row) throw new Error('not found')
        if (data.packQty !== undefined) row.packQty = data.packQty as number
        if (data.packUnit !== undefined) row.packUnit = data.packUnit as string
        if (data.pricePerPack !== undefined) row.pricePerPack = data.pricePerPack as number
        if (data.minOrderPacks !== undefined) row.minOrderPacks = data.minOrderPacks as number
        if (data.isActive !== undefined) row.isActive = data.isActive as boolean
        return { id: row.id }
      },
      delete: async ({ where }: { where: { id: string } }) => {
        captured.siDelete.push(where.id)
        const idx = catalog.findIndex(r => r.id === where.id)
        if (idx >= 0) catalog.splice(idx, 1)
        return { id: where.id }
      },
    },
  }

  return { db, suppliers, inventoryItems, catalog, audit, captured }
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
  createAuditLog: async (entry: Record<string, unknown>) => {
    ref.current.audit.push(entry)
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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: async () => ({ allowed: true, remaining: 10, retryAfterMs: 0 }),
  getClientIp: () => '127.0.0.1',
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60000 },
}))
vi.mock('@/lib/rate-limit/response', () => ({
  rateLimitedResponse: () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
}))

import { GET as catalogGet, POST as catalogPost, DELETE as catalogDelete } from '@/app/api/suppliers/[id]/catalog/route'

const state = ref.current

// ---------- Seed ----------
function seedBase() {
  state.suppliers.length = 0
  state.inventoryItems.length = 0
  state.catalog.length = 0
  state.audit.length = 0
  state.captured.siCreate.length = 0
  state.captured.siUpdate.length = 0
  state.captured.siDelete.length = 0
  state.captured.createShouldConflict = false

  state.suppliers.push({ id: SUP_1, name: 'Dobavitelj 1' })
  state.inventoryItems.push(
    { id: ITEM_1, name: 'Moka tip 500', unit: 'kg', costPerUnit: 4, locationId: LOC_1 },
    { id: ITEM_2, name: 'Sladkor', unit: 'kg', costPerUnit: 2, locationId: LOC_1 },
    { id: ITEM_OUT, name: 'Druga lokacija artikel', unit: 'pcs', costPerUnit: 1, locationId: LOC_2 },
  )
  state.catalog.push({
    id: 'si-1', supplierId: SUP_1, inventoryItemId: ITEM_1, supplierSku: 'MOKA-25',
    packQty: 25, packUnit: 'vrečka', pricePerPack: 45, vatRate: 22, minOrderPacks: 2,
    isActive: true, note: 'glavni cenik',
  })
}

function authSession(role = 'admin', locationId: string | null = LOC_1, employeeId = 'emp-1') {
  m.requireAuth.mockResolvedValue({ session: { employeeId, locationId, role, permissions: ['manage_inventory'] }, error: null })
}

function authError(status: number) {
  m.requireAuth.mockResolvedValue({
    session: null,
    error: new Response(JSON.stringify({ error: 'Dostop zavrnjen' }), { status }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  authSession()
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const url = (id: string, query = '') => `http://local/api/suppliers/${id}/catalog${query}`

function jsonReq(urlStr: string, method: string, body?: unknown): Request {
  return new Request(urlStr, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

// ============================================
// A. GET
// ============================================
describe('R131 catalog GET', () => {
  it('anon → 401 (requireAuth na meji)', async () => {
    authError(401)
    const res = await catalogGet(jsonReq(url(SUP_1), 'GET'), params(SUP_1))
    expect(res.status).toBe(401)
  })

  it('vloga brez permission → 403', async () => {
    authError(403)
    const res = await catalogGet(jsonReq(url(SUP_1), 'GET'), params(SUP_1))
    expect(res.status).toBe(403)
  })

  it('ghost dobavitelj → 404 fail-closed', async () => {
    const res = await catalogGet(jsonReq(url(SUP_GHOST), 'GET'), params(SUP_GHOST))
    expect(res.status).toBe(404)
    const body = await parseJson(res)
    expect(body.error).toBe('Dobavitelj ni najden')
  })

  it('prazen katalog → 200 items []', async () => {
    state.catalog.length = 0
    const res = await catalogGet(jsonReq(url(SUP_1), 'GET'), params(SUP_1))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.supplierId).toBe(SUP_1)
    expect(body.items).toEqual([])
  })

  it('poln katalog → baseUnitPrice izračunan + Decimal → number (deepToNumbers) + artikel snapshot', async () => {
    const res = await catalogGet(jsonReq(url(SUP_1), 'GET'), params(SUP_1))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const items = body.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    const row = items[0]
    // 45 / 25 = 1.8 (izračunana osnovna cena)
    expect(row.baseUnitPrice).toBe(1.8)
    // Decimal kontrakt: pretvorjeno v number (ne string, ne objekt)
    expect(row.packQty).toBe(25)
    expect(row.pricePerPack).toBe(45)
    expect(row.packUnit).toBe('vrečka')
    expect(row.minOrderPacks).toBe(2)
    expect(row.isActive).toBe(true)
    expect(row.supplierSku).toBe('MOKA-25')
    const item = row.inventoryItem as Record<string, unknown>
    expect(item.id).toBe(ITEM_1)
    expect(item.name).toBe('Moka tip 500')
    expect(item.unit).toBe('kg')
    expect(item.costPerUnit).toBe(4)
  })

  it('tenant scope: artikel na drugi lokaciji je izključen (fail-closed)', async () => {
    state.catalog.push({
      id: 'si-2', supplierId: SUP_1, inventoryItemId: ITEM_OUT, supplierSku: '',
      packQty: 10, packUnit: 'karton', pricePerPack: 5, vatRate: null, minOrderPacks: 1,
      isActive: true, note: '',
    })
    const res = await catalogGet(jsonReq(url(SUP_1), 'GET'), params(SUP_1))
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    const items = body.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect((items[0].inventoryItem as Record<string, unknown>).id).toBe(ITEM_1)
  })
})

// ============================================
// B. POST (upsert)
// ============================================
describe('R131 catalog POST (upsert)', () => {
  const validBody = {
    inventoryItemId: ITEM_2,
    packQty: 50,
    packUnit: 'sod',
    pricePerPack: 90,
    vatRate: 22,
    minOrderPacks: 1,
    supplierSku: 'SLAD-50',
    note: 'nov artikel',
  }

  it('anon → 401', async () => {
    authError(401)
    const res = await catalogPost(jsonReq(url(SUP_1), 'POST', validBody), params(SUP_1))
    expect(res.status).toBe(401)
  })

  it('packQty 0 in negativna cena → 400 INVALID_INPUT (brez zapisa)', async () => {
    const r1 = await catalogPost(jsonReq(url(SUP_1), 'POST', { ...validBody, packQty: 0 }), params(SUP_1))
    expect(r1.status).toBe(400)
    expect((await parseJson(r1)).error).toBe('INVALID_INPUT')

    const r2 = await catalogPost(jsonReq(url(SUP_1), 'POST', { ...validBody, pricePerPack: -5 }), params(SUP_1))
    expect(r2.status).toBe(400)
    expect((await parseJson(r2)).error).toBe('INVALID_INPUT')
    expect(state.captured.siCreate).toHaveLength(0)
  })

  it('ghost dobavitelj → 404 (fail-closed)', async () => {
    const res = await catalogPost(jsonReq(url(SUP_GHOST), 'POST', validBody), params(SUP_GHOST))
    expect(res.status).toBe(404)
    expect((await parseJson(res)).error).toBe('SUPPLIER_NOT_FOUND')
  })

  it('ghost artikel → 404 ITEM_NOT_FOUND (ne fabrikamo FK)', async () => {
    const res = await catalogPost(
      jsonReq(url(SUP_1), 'POST', { ...validBody, inventoryItemId: ITEM_GHOST }),
      params(SUP_1),
    )
    expect(res.status).toBe(404)
    expect((await parseJson(res)).error).toBe('ITEM_NOT_FOUND')
    expect(state.captured.siCreate).toHaveLength(0)
  })

  it('CREATE → 201 + audit SUPPLIER_CATALOG_UPSERT + baseUnitPrice v odgovoru', async () => {
    const res = await catalogPost(jsonReq(url(SUP_1), 'POST', validBody), params(SUP_1))
    expect(res.status).toBe(201)
    const body = await parseJson(res)
    expect(body.created).toBe(true)
    const row = body.row as Record<string, unknown>
    expect(row.packQty).toBe(50)
    expect(row.packUnit).toBe('sod')
    // 90 / 50 = 1.8
    expect(row.baseUnitPrice).toBe(1.8)

    // Audit (pariteta price-history POST)
    expect(state.audit).toHaveLength(1)
    const entry = state.audit[0]
    expect(entry.action).toBe('SUPPLIER_CATALOG_UPSERT')
    expect(entry.entityType).toBe('SupplierItem')
    expect((entry.details as Record<string, unknown>).itemName).toBe('Sladkor')
    expect((entry.details as Record<string, unknown>).created).toBe(true)
  })

  it('UPDATE (isti par) → 200 created=false, vrstica posodobljena', async () => {
    // ITEM_1 že ima katalog vrstico si-1 → upsert posodobi
    const res = await catalogPost(
      jsonReq(url(SUP_1), 'POST', { inventoryItemId: ITEM_1, packQty: 30, packUnit: 'vrečka', pricePerPack: 48 }),
      params(SUP_1),
    )
    expect(res.status).toBe(200)
    const body = await parseJson(res)
    expect(body.created).toBe(false)
    // Brez podvajanja vrstic
    expect(state.catalog).toHaveLength(1)
    expect(state.catalog[0].packQty).toBe(30)
    expect(state.catalog[0].pricePerPack).toBe(48)
    expect(state.captured.siUpdate).toHaveLength(1)
    // Audit vseeno zapisan
    expect(state.audit).toHaveLength(1)
    expect((state.audit[0].details as Record<string, unknown>).created).toBe(false)
  })

  it('P2002 race ob create → 409 retry pattern', async () => {
    state.captured.createShouldConflict = true
    const res = await catalogPost(jsonReq(url(SUP_1), 'POST', validBody), params(SUP_1))
    expect(res.status).toBe(409)
    expect((await parseJson(res)).error).toBe('CONFLICT')
  })
})

// ============================================
// C. DELETE
// ============================================
describe('R131 catalog DELETE', () => {
  it('manjkajoč ?catalogItemId= → 400 PARAM_REQUIRED', async () => {
    const res = await catalogDelete(jsonReq(url(SUP_1), 'DELETE'), params(SUP_1))
    expect(res.status).toBe(400)
    expect((await parseJson(res)).error).toBe('PARAM_REQUIRED')
  })

  it('uspeh → 200 { success: true } + vrstica izginila', async () => {
    const res = await catalogDelete(jsonReq(url(SUP_1, '?catalogItemId=si-1'), 'DELETE'), params(SUP_1))
    expect(res.status).toBe(200)
    expect((await parseJson(res)).success).toBe(true)
    expect(state.catalog).toHaveLength(0)
    expect(state.captured.siDelete).toEqual(['si-1'])
    expect(state.audit).toHaveLength(1)
    expect(state.audit[0].action).toBe('SUPPLIER_CATALOG_DELETE')
  })

  it('ghost vrstica → 404', async () => {
    const res = await catalogDelete(jsonReq(url(SUP_1, '?catalogItemId=si-ghost'), 'DELETE'), params(SUP_1))
    expect(res.status).toBe(404)
  })

  it('vrstica drugega dobavitelja → 404 (ne razkritje)', async () => {
    state.suppliers.push({ id: 'sup-2', name: 'Dobavitelj 2' })
    state.catalog.push({
      id: 'si-other', supplierId: 'sup-2', inventoryItemId: ITEM_2, supplierSku: '',
      packQty: 5, packUnit: 'paket', pricePerPack: 10, vatRate: null, minOrderPacks: 1,
      isActive: true, note: '',
    })
    const res = await catalogDelete(jsonReq(url(SUP_1, '?catalogItemId=si-other'), 'DELETE'), params(SUP_1))
    expect(res.status).toBe(404)
    // tuja vrstica ostane (lastna si-1 tudi — le tuja NI izbrisana)
    expect(state.catalog.filter(r => r.id === 'si-other')).toHaveLength(1)
  })

  it('artikel izven lokacijskega scope-a → 404 (fail-closed)', async () => {
    state.catalog.push({
      id: 'si-out', supplierId: SUP_1, inventoryItemId: ITEM_OUT, supplierSku: '',
      packQty: 5, packUnit: 'paket', pricePerPack: 10, vatRate: null, minOrderPacks: 1,
      isActive: true, note: '',
    })
    const res = await catalogDelete(jsonReq(url(SUP_1, '?catalogItemId=si-out'), 'DELETE'), params(SUP_1))
    expect(res.status).toBe(404)
    expect(state.catalog.filter(r => r.id === 'si-out')).toHaveLength(1)
  })
})
