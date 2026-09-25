// ============================================
// R134 / EPIC #115 P1-10 — COURSE MANAGEMENT (trap DB)
// ============================================
// Trap DB (hišni stil, vzorec r133-kds-metrics): createDb + vi.hoisted +
// vi.mock('@/lib/db'). LEKCIJA (R133): lasten deepCopy, NE structuredClone —
// vmThreads host-realm objekti polomijo deepToNumbers/Date duck-tiping.
// Testira:
//   A. POST /api/orders (handlePostOrder) — per-item courseNumber:
//      Course vrstice + courseId wiring + default 3 + kanonska imena (1..4,
//      >=5 'Tok {n}'), legacy brez courseNumber (0 Course, nested create),
//      idempotency replay NE duplicira Course, Zod (1..8 int).
//   B. PUT /api/courses/[id] — hold/unhold (kanon 4), idempotent replay
//      (fire/ready/served na istem statusu → 200 NO-OP, kanon 6), neveljavni
//      prehodi → 400 z currentStatus, propagacija firedAt/readyAt na iteme
//      (kanon 5; served SAMO status), scope 404.
//   C. POST /api/orders/[id]/courses/fire — next (samo najmanjši pending,
//      held preskočen), all (vsi pending, isti firedAt), no-op 200, scope
//      404, Zod validacija, audit COURSE_FIRE.
// requireAuth je mockan na MEJI; resolveTenantLocationIdOrThrow ostane REALEN
// (scope/fail-closed testiranje na pravem pravilniku).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc-1'
const LOC_2 = 'loc-2'
const EMP = 'emp-1'

// ---------- Trap stanje ----------
interface ItemRow {
  id: string
  orderId: string
  menuItemId: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  discountAmount: number
  status: string
  courseId: string | null
  firedAt: Date | null
  readyAt: Date | null
  notes: string
  modifiersJson: unknown
}
interface OrderRow {
  id: string
  orderNumber: number
  idempotencyKey: string | null
  locationId: string
  status: string
  type: string
  subtotal: number
  tax: number
  total: number
  firedAt: Date | null
}
interface CourseRow {
  id: string
  orderId: string
  courseNumber: number
  name: string
  status: string
  firedAt: Date | null
  readyAt: Date | null
  servedAt: Date | null
  createdAt: Date
}

// Realm-varna globoka kopija (LEKCIJA r133: structuredClone v vmThreads
// vrača HOST-realm objekte → deepToNumbers/Date odpove).
function deepCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const like = value as unknown as { getTime?: () => number }
  if (typeof like.getTime === 'function') return new Date(like.getTime()) as unknown as T
  if (Array.isArray(value)) return value.map(v => deepCopy(v)) as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepCopy(v)
  return out as T
}

function createDb() {
  const orders: OrderRow[] = []
  const items: ItemRow[] = []
  const courses: CourseRow[] = []
  const menuItems = [
    { id: 'mi-1', vatRate: 9.5, price: 10, locationId: LOC_1 },
    { id: 'mi-2', vatRate: 22, price: 5, locationId: LOC_1 },
    { id: 'mi-3', vatRate: 9.5, price: 7, locationId: LOC_1 },
  ]
  let seq = 0
  const captured = {
    orderCreates: [] as Array<Record<string, unknown>>,
    itemCreates: [] as Array<Record<string, unknown>>,
    courseCreates: [] as Array<Record<string, unknown>>,
    itemUpdates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
    courseUpdates: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
    courseUpdateMany: [] as Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>,
  }

  function createItemRow(data: Record<string, unknown>, orderId: string): ItemRow {
    const row: ItemRow = {
      id: `oi-${++seq}`,
      orderId,
      menuItemId: data.menuItemId as string,
      quantity: (data.quantity as number) ?? 1,
      price: (data.price as number) ?? 0,
      vatRate: (data.vatRate as number) ?? 22,
      vatAmount: (data.vatAmount as number) ?? 0,
      discountAmount: (data.discountAmount as number) ?? 0,
      status: (data.status as string) ?? 'pending',
      courseId: (data.courseId as string | null) ?? null,
      firedAt: null,
      readyAt: null,
      notes: (data.notes as string) ?? '',
      modifiersJson: data.modifiersJson ?? '[]',
    }
    items.push(row)
    return row
  }

  const itemPublic = (i: ItemRow) => ({
    ...i,
    menuItem: menuItems.find(mi => mi.id === i.menuItemId) ?? null,
  })
  // parity z realno Prisma include-o: legacy pot (order.create + findFirst
  // replay lookup) ne vrača `courses` ključa; course pot (fresh re-read prek
  // findUnique) ga vrača (include courses: true).
  const orderPublic = (o: OrderRow, withCourses = false) => ({
    ...o,
    table: null,
    orderItems: items.filter(i => i.orderId === o.id).map(itemPublic),
    ...(withCourses ? { courses: courses.filter(c => c.orderId === o.id).map(c => ({ ...c })) } : {}),
  })

  const db = {
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),

    order: {
      findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        const row = orders.find(o =>
          (where.id === undefined || o.id === where.id) &&
          (where.idempotencyKey === undefined || o.idempotencyKey === where.idempotencyKey) &&
          (where.locationId === undefined || o.locationId === where.locationId))
        return row ? deepCopy(orderPublic(row)) : null
      },
      findUnique: async (args: { where?: { id?: string } } = {}) => {
        const row = orders.find(o => o.id === args?.where?.id)
        // R134 course pot: fresh re-read z include courses: true
        return row ? deepCopy(orderPublic(row, true)) : null
      },
      create: async (args: { data: Record<string, unknown> }) => {
        captured.orderCreates.push(args.data)
        const d = args.data
        const row: OrderRow = {
          id: `ord-${++seq}`,
          orderNumber: d.orderNumber as number,
          idempotencyKey: (d.idempotencyKey as string) ?? null,
          locationId: d.locationId as string,
          status: (d.status as string) ?? 'pending',
          type: (d.type as string) ?? 'takeout',
          subtotal: (d.subtotal as number) ?? 0,
          tax: (d.tax as number) ?? 0,
          total: (d.total as number) ?? 0,
          firedAt: (d.firedAt as Date) ?? null,
        }
        orders.push(row)
        const nested = (d.orderItems as { create?: Record<string, unknown>[] } | undefined | null)?.create
        if (nested) {
          for (const it of nested) createItemRow(it, row.id)
        }
        return deepCopy(orderPublic(row))
      },
    },

    course: {
      create: async (args: { data: Record<string, unknown> }) => {
        captured.courseCreates.push(args.data)
        const row: CourseRow = {
          id: `course-${++seq}`,
          orderId: args.data.orderId as string,
          courseNumber: args.data.courseNumber as number,
          name: (args.data.name as string) ?? '',
          status: (args.data.status as string) ?? 'pending',
          firedAt: null,
          readyAt: null,
          servedAt: null,
          createdAt: new Date(),
        }
        courses.push(row)
        return deepCopy({ ...row })
      },
      findUnique: async (args: { where?: { id?: string } } = {}) => {
        const row = courses.find(c => c.id === args?.where?.id)
        return row
          ? deepCopy({ ...row, orderItems: items.filter(i => i.courseId === row.id).map(itemPublic) })
          : null
      },
      findFirst: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        const orderLoc = (where.order as { locationId?: string } | undefined)?.locationId
        const row = courses.find(c =>
          (where.id === undefined || c.id === where.id) &&
          (orderLoc === undefined || orders.find(o => o.id === c.orderId)?.locationId === orderLoc))
        return row
          ? deepCopy({ ...row, orderItems: items.filter(i => i.courseId === row.id).map(itemPublic) })
          : null
      },
      findMany: async (args: { where?: Record<string, unknown>; orderBy?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        let rows = courses.filter(c =>
          (where.orderId === undefined || c.orderId === where.orderId) &&
          (where.status === undefined || c.status === where.status))
        const ob = args?.orderBy as { courseNumber?: string } | undefined
        if (ob?.courseNumber === 'asc') rows = [...rows].sort((a, b) => a.courseNumber - b.courseNumber)
        return deepCopy(rows.map(c => ({
          ...c,
          orderItems: items.filter(i => i.courseId === c.id).map(itemPublic),
        })))
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        captured.courseUpdates.push(args)
        const row = courses.find(c => c.id === args.where.id)
        if (!row) throw new Error('P2025 course not found (trap)')
        if (args.data.status !== undefined) row.status = args.data.status as string
        if (args.data.firedAt !== undefined) row.firedAt = args.data.firedAt as Date
        if (args.data.readyAt !== undefined) row.readyAt = args.data.readyAt as Date
        if (args.data.servedAt !== undefined) row.servedAt = args.data.servedAt as Date
        if (args.data.name !== undefined) row.name = args.data.name as string
        return deepCopy({ ...row, orderItems: items.filter(i => i.courseId === row.id).map(itemPublic) })
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        captured.courseUpdateMany.push(args)
        let count = 0
        for (const c of courses) {
          if (args.where.id !== undefined && c.id !== args.where.id) continue
          if (args.where.status !== undefined && c.status !== args.where.status) continue
          if (args.data.status !== undefined) c.status = args.data.status as string
          if (args.data.firedAt !== undefined) c.firedAt = args.data.firedAt as Date
          count += 1
        }
        return { count }
      },
    },

    orderItem: {
      create: async (args: { data: Record<string, unknown> }) => {
        captured.itemCreates.push(args.data)
        return deepCopy(itemPublic(createItemRow(args.data, args.data.orderId as string)))
      },
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        captured.itemUpdates.push(args)
        let count = 0
        for (const it of items) {
          if (args.where.courseId !== undefined && it.courseId !== args.where.courseId) continue
          if (args.where.orderId !== undefined && it.orderId !== args.where.orderId) continue
          if (args.data.status !== undefined) it.status = args.data.status as string
          if (args.data.firedAt !== undefined) it.firedAt = args.data.firedAt as Date
          if (args.data.readyAt !== undefined) it.readyAt = args.data.readyAt as Date
          count += 1
        }
        return { count }
      },
    },

    menuItem: {
      findMany: async (args: { where?: Record<string, unknown> } = {}) => {
        const where = args?.where ?? {}
        const ids = (where.id as { in?: string[] } | undefined)?.in
        const loc = (where.category as { menu?: { locationId?: string } } | undefined)?.menu?.locationId
        return menuItems
          .filter(mi => (ids === undefined || ids.includes(mi.id)) && (loc === undefined || mi.locationId === loc))
          .map(mi => ({ id: mi.id, vatRate: mi.vatRate, price: mi.price }))
      },
    },

    menuItemModifierGroup: {
      findMany: async () => [],
    },
  }

  return { db, orders, items, courses, menuItems, captured }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
type DbState = ReturnType<typeof createDb>
const ref = vi.hoisted(() => ({ current: null as unknown as DbState }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createAuditLog: vi.fn(),
  checkStockAvailability: vi.fn(),
  handleStockDeduction: vi.fn(),
  handlePostCreationEffects: vi.fn(),
  getNextOrderNumber: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
  createAuditLog: m.createAuditLog,
}))

vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
    // resolveTenantLocationIdOrThrow ostane REALEN (fail-closed pravilnik)
  }
})

vi.mock('@/lib/counters', () => ({
  getNextOrderNumber: (...args: unknown[]) => m.getNextOrderNumber(...args),
}))

vi.mock('@/lib/stock-deduction', () => ({
  checkStockAvailability: (...args: unknown[]) => m.checkStockAvailability(...args),
  broadcastLowStockAlert: vi.fn(),
  deductStockForOrder: vi.fn(),
}))

vi.mock('@/app/api/orders/_helpers/stock', () => ({
  handleStockDeduction: (...args: unknown[]) => m.handleStockDeduction(...args),
  handlePostCreationEffects: (...args: unknown[]) => m.handlePostCreationEffects(...args),
}))

import { handlePostOrder } from '@/app/api/orders/_helpers/post-handler'
import { PUT as coursePut } from '@/app/api/courses/[id]/route'
import { POST as firePost } from '@/app/api/orders/[id]/courses/fire/route'

const state = ref.current

// ---------- Seed / helperji ----------
function seedBase() {
  state.orders.length = 0
  state.items.length = 0
  state.courses.length = 0
  state.captured.orderCreates.length = 0
  state.captured.itemCreates.length = 0
  state.captured.courseCreates.length = 0
  state.captured.itemUpdates.length = 0
  state.captured.courseUpdates.length = 0
  state.captured.courseUpdateMany.length = 0
  m.requireAuth.mockReset()
  m.createAuditLog.mockReset()
  m.createAuditLog.mockResolvedValue(undefined)
  m.checkStockAvailability.mockReset()
  m.checkStockAvailability.mockResolvedValue({ warnings: [] })
  m.handleStockDeduction.mockReset()
  m.handleStockDeduction.mockResolvedValue({ stockDeducted: false })
  m.handlePostCreationEffects.mockReset()
  m.handlePostCreationEffects.mockResolvedValue(undefined)
  m.getNextOrderNumber.mockReset()
  m.getNextOrderNumber.mockResolvedValue(134001)
}

function authAs(locationId: string | null = LOC_1) {
  m.requireAuth.mockResolvedValue({
    session: { employeeId: EMP, role: 'manager', locationId },
    error: null,
  })
}

function postOrderReq(body: unknown): Request {
  return new Request('http://local/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function handlerSession() {
  return {
    session: { employeeId: EMP, locationId: LOC_1, role: 'manager' },
    scope: { locationId: LOC_1 },
    searchParams: null,
  }
}

async function postOrder(body: unknown) {
  const res = await handlePostOrder(postOrderReq(body), handlerSession())
  const json = await (res as Response).json() as Record<string, unknown>
  return { res: res as Response, json }
}

function coursePutReq(id: string, body: unknown): Request {
  return new Request(`http://local/api/courses/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function fireReq(orderId: string, body: unknown): Request {
  return new Request(`http://local/api/orders/${orderId}/courses/fire`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function seedCourse(num: number, status = 'pending', locationId = LOC_1): CourseRow {
  const order: OrderRow = {
    id: `ord-c${num}-${state.orders.length + 1}`,
    orderNumber: 134100 + state.orders.length,
    idempotencyKey: `key-course-${num}-${state.orders.length}`,
    locationId,
    status: 'in-progress',
    type: 'dine-in',
    subtotal: 30, tax: 4, total: 34, firedAt: new Date(),
  }
  state.orders.push(order)
  const course: CourseRow = {
    id: `course-c${num}-${state.courses.length + 1}`,
    orderId: order.id,
    courseNumber: num,
    name: 'Glavna jed',
    status,
    firedAt: null, readyAt: null, servedAt: null,
    createdAt: new Date(),
  }
  state.courses.push(course)
  for (let i = 0; i < 2; i++) {
    state.items.push({
      id: `oi-c${num}-${state.items.length + 1}`,
      orderId: order.id,
      menuItemId: 'mi-1',
      quantity: 1, price: 10, vatRate: 9.5, vatAmount: 0.95, discountAmount: 0,
      status: 'pending',
      courseId: course.id,
      firedAt: null, readyAt: null,
      notes: '', modifiersJson: '[]',
    })
  }
  return course
}

beforeEach(() => {
  seedBase()
})

// ============================================
// A. POST /api/orders — courseNumber (kanon 3)
// ============================================
describe('R134 A: POST /api/orders s courseNumber', () => {
  it('(A1) ustvari Course vrstice za vsako distinktno številko + wiring courseId (default 3 za brez)', async () => {
    const { res, json } = await postOrder({
      type: 'takeout',
      orderItems: [
        { menuItemId: 'mi-1', quantity: 1, courseNumber: 1 },
        { menuItemId: 'mi-2', quantity: 2 }, // brez → default 3
        { menuItemId: 'mi-3', quantity: 1, courseNumber: 2 },
      ],
      idempotencyKey: 'key-r134-a1',
    })
    expect(res.status).toBe(201)
    // 3 distinktne številke (1, 2, default 3) → 3 Course vrstice
    expect(state.courses).toHaveLength(3)
    const byNum = new Map(state.courses.map(c => [c.courseNumber, c]))
    expect(byNum.get(1)!.name).toBe('Predjed')
    expect(byNum.get(2)!.name).toBe('Juha')
    expect(byNum.get(3)!.name).toBe('Glavna jed')
    for (const c of state.courses) {
      expect(c.status).toBe('pending')
      expect(c.orderId).toBe((json.id as string))
    }
    // wiring: vsi itemi imajo courseId (item brez courseNumber → course 3)
    expect(state.items).toHaveLength(3)
    const itemByMenu = new Map(state.items.map(i => [i.menuItemId, i]))
    expect(itemByMenu.get('mi-1')!.courseId).toBe(byNum.get(1)!.id)
    expect(itemByMenu.get('mi-2')!.courseId).toBe(byNum.get(3)!.id) // default 3
    expect(itemByMenu.get('mi-3')!.courseId).toBe(byNum.get(2)!.id)
    // item status ostane 'pending' (course pending itemi NAMERNO nevidni na KDS)
    expect(state.items.every(i => i.status === 'pending')).toBe(true)
    // aditivni odgovor: course pot ima `courses`, itemi nosijo courseId
    expect(Array.isArray(json.courses)).toBe(true)
    const respItems = json.orderItems as Array<Record<string, unknown>>
    expect(respItems.every(i => typeof i.courseId === 'string')).toBe(true)
  })

  it('(A2) kanonsko ime za >=5 je "Tok {n}"', async () => {
    await postOrder({
      type: 'takeout',
      orderItems: [{ menuItemId: 'mi-1', quantity: 1, courseNumber: 5 }],
      idempotencyKey: 'key-r134-a2',
    })
    expect(state.courses).toHaveLength(1)
    expect(state.courses[0].courseNumber).toBe(5)
    expect(state.courses[0].name).toBe('Tok 5')
  })

  it('(A3) legacy brez courseNumber → 0 Course vrstic, nested create, odgovor brez `courses`', async () => {
    const { res, json } = await postOrder({
      type: 'takeout',
      orderItems: [
        { menuItemId: 'mi-1', quantity: 1 },
        { menuItemId: 'mi-2', quantity: 2 },
      ],
      idempotencyKey: 'key-r134-a3',
    })
    expect(res.status).toBe(201)
    expect(state.courses).toHaveLength(0)
    expect(state.captured.courseCreates).toHaveLength(0)
    // nested create (en sam order.create; itemi brez courseId)
    expect(state.captured.itemCreates).toHaveLength(0)
    expect(state.captured.orderCreates).toHaveLength(1)
    expect(state.captured.orderCreates[0].orderItems).toBeDefined()
    expect(json.courses).toBeUndefined()
    const respItems = json.orderItems as Array<Record<string, unknown>>
    expect(respItems.every(i => i.courseId === null)).toBe(true)
  })

  it('(A4) idempotency replay NE duplicira Course (drugi POST → 200, isti order)', async () => {
    const body = {
      type: 'takeout',
      orderItems: [{ menuItemId: 'mi-1', quantity: 1, courseNumber: 1 }],
      idempotencyKey: 'key-r134-a4',
    }
    const first = await postOrder(body)
    expect(first.res.status).toBe(201)
    expect(state.courses).toHaveLength(1)

    const second = await postOrder(body)
    expect(second.res.status).toBe(200)
    expect(second.json.id).toBe(first.json.id)
    // NI novih Course vrstic / create klicev
    expect(state.courses).toHaveLength(1)
    expect(state.captured.courseCreates).toHaveLength(1)
    // replay vrne obstoječe iteme (tuj replay brez wiring sprememb)
    expect((second.json.orderItems as unknown[]).length).toBe(1)
  })

  it('(A5) Zod: courseNumber 0 in 9 → 400; 1..8 sprejeto', async () => {
    for (const bad of [0, 9, 1.5]) {
      const { res } = await postOrder({
        type: 'takeout',
        orderItems: [{ menuItemId: 'mi-1', quantity: 1, courseNumber: bad }],
        idempotencyKey: `key-r134-bad-${bad}`,
      })
      expect(res.status).toBe(400)
      expect(state.orders).toHaveLength(0)
      expect(state.courses).toHaveLength(0)
    }
    const ok = await postOrder({
      type: 'takeout',
      orderItems: [{ menuItemId: 'mi-1', quantity: 1, courseNumber: 8 }],
      idempotencyKey: 'key-r134-ok-8',
    })
    expect(ok.res.status).toBe(201)
    expect(state.courses.map(c => c.courseNumber)).toEqual([8])
  })
})

// ============================================
// B. PUT /api/courses/[id] — hold/unhold + replay + propagacija
// ============================================
describe('R134 B: PUT /api/courses/[id]', () => {
  it('(B1) fire → status fired + firedAt + itemi { status fired, firedAt }', async () => {
    authAs()
    const course = seedCourse(1)
    const res = await coursePut(coursePutReq(course.id, { action: 'fire' }), routeParams(course.id))
    expect(res.status).toBe(200)
    expect(course.status).toBe('fired')
    expect(course.firedAt).not.toBeNull()
    // propagacija (kanon 5): itemi fired + firedAt
    const items = state.items.filter(i => i.courseId === course.id)
    expect(items.every(i => i.status === 'fired' && i.firedAt !== null)).toBe(true)
    const upd = state.captured.itemUpdates[0]
    expect(upd.where).toEqual({ courseId: course.id })
    expect(upd.data.status).toBe('fired')
    expect((upd.data.firedAt as Date).getTime()).toBe(course.firedAt!.getTime())
  })

  it('(B2) ready → itemi { status ready, readyAt }; served → SAMO status (brez servedAt)', async () => {
    authAs()
    const c1 = seedCourse(1)
    const c2 = seedCourse(2)
    await coursePut(coursePutReq(c1.id, { action: 'fire' }), routeParams(c1.id))
    const rReady = await coursePut(coursePutReq(c1.id, { action: 'ready' }), routeParams(c1.id))
    expect(rReady.status).toBe(200)
    expect(c1.status).toBe('ready')
    expect(state.items.filter(i => i.courseId === c1.id).every(i => i.status === 'ready' && i.readyAt !== null)).toBe(true)

    await coursePut(coursePutReq(c2.id, { action: 'fire' }), routeParams(c2.id))
    await coursePut(coursePutReq(c2.id, { action: 'ready' }), routeParams(c2.id))
    const rServed = await coursePut(coursePutReq(c2.id, { action: 'served' }), routeParams(c2.id))
    expect(rServed.status).toBe(200)
    const lastUpd = state.captured.itemUpdates[state.captured.itemUpdates.length - 1]
    expect(lastUpd.data.status).toBe('served')
    expect(lastUpd.data.readyAt).toBeUndefined()
    expect(lastUpd.data.servedAt).toBeUndefined()
  })

  it('(B3) hold: pending→held (BREZ item propagacije); unhold: held→pending', async () => {
    authAs()
    const course = seedCourse(2)
    const rHold = await coursePut(coursePutReq(course.id, { action: 'hold' }), routeParams(course.id))
    expect(rHold.status).toBe(200)
    const body1 = await asJson(rHold)
    expect(body1.status).toBe('held')
    // itemi ostanejo pending (zadržan tok se ne požge sam)
    expect(state.items.filter(i => i.courseId === course.id).every(i => i.status === 'pending')).toBe(true)
    expect(state.captured.itemUpdates).toHaveLength(0)

    const rUnhold = await coursePut(coursePutReq(course.id, { action: 'unhold' }), routeParams(course.id))
    expect(rUnhold.status).toBe(200)
    const body2 = await asJson(rUnhold)
    expect(body2.status).toBe('pending')
  })

  it('(B4) idempotent replay: fire na fired → 200 trenutno stanje, firedAt UNCHANGED, brez update-ov', async () => {
    authAs()
    const course = seedCourse(1)
    await coursePut(coursePutReq(course.id, { action: 'fire' }), routeParams(course.id))
    const firstFiredAt = course.firedAt!.getTime()
    const updCount = state.captured.itemUpdates.length
    const courseUpdCount = state.captured.courseUpdates.length

    const replay = await coursePut(coursePutReq(course.id, { action: 'fire' }), routeParams(course.id))
    expect(replay.status).toBe(200)
    const body = await asJson(replay)
    expect(body.status).toBe('fired')
    expect(body.id).toBe(course.id)
    // NO-OP: firedAt ostane prvi fire čas; noben nov update
    expect(course.firedAt!.getTime()).toBe(firstFiredAt)
    expect(state.captured.itemUpdates.length).toBe(updCount)
    expect(state.captured.courseUpdates.length).toBe(courseUpdCount)
  })

  it('(B5) idempotent replay: ready na ready → 200; served na served → 200', async () => {
    authAs()
    const c1 = seedCourse(1)
    const c2 = seedCourse(2)
    await coursePut(coursePutReq(c1.id, { action: 'fire' }), routeParams(c1.id))
    await coursePut(coursePutReq(c1.id, { action: 'ready' }), routeParams(c1.id))
    const firstReadyAt = c1.readyAt!.getTime()
    const r = await coursePut(coursePutReq(c1.id, { action: 'ready' }), routeParams(c1.id))
    expect(r.status).toBe(200)
    expect((await asJson(r)).status).toBe('ready')
    expect(c1.readyAt!.getTime()).toBe(firstReadyAt)

    await coursePut(coursePutReq(c2.id, { action: 'fire' }), routeParams(c2.id))
    await coursePut(coursePutReq(c2.id, { action: 'ready' }), routeParams(c2.id))
    await coursePut(coursePutReq(c2.id, { action: 'served' }), routeParams(c2.id))
    const r2 = await coursePut(coursePutReq(c2.id, { action: 'served' }), routeParams(c2.id))
    expect(r2.status).toBe(200)
    expect((await asJson(r2)).status).toBe('served')
  })

  it('(B6) neveljavni prehodi → 400 z currentStatus (fire po ready, fire po served, hold na fired, unhold na pending)', async () => {
    authAs()
    const c1 = seedCourse(1)
    const c2 = seedCourse(2)
    const c3 = seedCourse(3)
    const c4 = seedCourse(4)

    await coursePut(coursePutReq(c1.id, { action: 'fire' }), routeParams(c1.id))
    await coursePut(coursePutReq(c1.id, { action: 'ready' }), routeParams(c1.id))
    const rFire = await coursePut(coursePutReq(c1.id, { action: 'fire' }), routeParams(c1.id))
    expect(rFire.status).toBe(400)
    expect((await asJson(rFire)).currentStatus).toBe('ready')

    await coursePut(coursePutReq(c2.id, { action: 'fire' }), routeParams(c2.id))
    await coursePut(coursePutReq(c2.id, { action: 'ready' }), routeParams(c2.id))
    await coursePut(coursePutReq(c2.id, { action: 'served' }), routeParams(c2.id))
    const rFire2 = await coursePut(coursePutReq(c2.id, { action: 'fire' }), routeParams(c2.id))
    expect(rFire2.status).toBe(400)
    expect((await asJson(rFire2)).currentStatus).toBe('served')

    await coursePut(coursePutReq(c3.id, { action: 'fire' }), routeParams(c3.id))
    const rHold = await coursePut(coursePutReq(c3.id, { action: 'hold' }), routeParams(c3.id))
    expect(rHold.status).toBe(400)
    expect((await asJson(rHold)).currentStatus).toBe('fired')

    const rUnhold = await coursePut(coursePutReq(c4.id, { action: 'unhold' }), routeParams(c4.id))
    expect(rUnhold.status).toBe(400)
    expect((await asJson(rUnhold)).currentStatus).toBe('pending')
  })

  it('(B7) eksplicitni fire na HELD je dovoljen (kanon 4) → fired', async () => {
    authAs()
    const course = seedCourse(2)
    await coursePut(coursePutReq(course.id, { action: 'hold' }), routeParams(course.id))
    const r = await coursePut(coursePutReq(course.id, { action: 'fire' }), routeParams(course.id))
    expect(r.status).toBe(200)
    expect(course.status).toBe('fired')
    expect(course.firedAt).not.toBeNull()
  })

  it('(B8) scope: course tuje lokacije → 404', async () => {
    authAs(LOC_2)
    const course = seedCourse(1, 'pending', LOC_1)
    const r = await coursePut(coursePutReq(course.id, { action: 'fire' }), routeParams(course.id))
    expect(r.status).toBe(404)
    expect(course.status).toBe('pending')
  })

  it('(B9) Zod: neznana akcija → 400', async () => {
    authAs()
    const course = seedCourse(1)
    const r = await coursePut(coursePutReq(course.id, { action: 'explode' }), routeParams(course.id))
    expect(r.status).toBe(400)
    expect(course.status).toBe('pending')
  })
})

// ============================================
// C. POST /api/orders/[id]/courses/fire — next / all
// ============================================
describe('R134 C: fire next/all route', () => {
  function seedFireScenario() {
    // order s tokovi 1 (pending), 2 (pending), 3 (held)
    const order: OrderRow = {
      id: 'ord-fire-1', orderNumber: 134200, idempotencyKey: 'key-fire-1',
      locationId: LOC_1, status: 'in-progress', type: 'dine-in',
      subtotal: 30, tax: 4, total: 34, firedAt: new Date(),
    }
    state.orders.push(order)
    const courses: CourseRow[] = []
    for (const [num, status] of [[1, 'pending'], [2, 'pending'], [3, 'held']] as const) {
      const course: CourseRow = {
        id: `course-fire-${num}`, orderId: order.id, courseNumber: num,
        name: 'Glavna jed', status, firedAt: null, readyAt: null, servedAt: null,
        createdAt: new Date(),
      }
      state.courses.push(course)
      courses.push(course)
      state.items.push({
        id: `oi-fire-${num}`, orderId: order.id, menuItemId: 'mi-1',
        quantity: 1, price: 10, vatRate: 9.5, vatAmount: 0.95, discountAmount: 0,
        status: 'pending', courseId: course.id, firedAt: null, readyAt: null,
        notes: '', modifiersJson: '[]',
      })
    }
    return { order, c1: courses[0], c2: courses[1], c3: courses[2] }
  }

  it('(C1) next → požge SAMO najmanjši pending (tok 1), held (tok 3) preskočen', async () => {
    authAs()
    const { order, c1, c2, c3 } = seedFireScenario()
    const res = await firePost(fireReq(order.id, { mode: 'next' }), routeParams(order.id))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.firedCourseId).toBe(c1.id)
    expect(c1.status).toBe('fired')
    expect(c1.firedAt).not.toBeNull()
    expect(c2.status).toBe('pending')
    expect(c3.status).toBe('held') // held preskočen
    // itemi toka 1 fired + firedAt; drugi nedotaknjeni
    const i1 = state.items.find(i => i.courseId === c1.id)!
    expect(i1.status).toBe('fired')
    expect(i1.firedAt!.getTime()).toBe(c1.firedAt!.getTime())
    expect(state.items.find(i => i.courseId === c2.id)!.status).toBe('pending')
    // audit COURSE_FIRE z mode + courseNumbers
    expect(m.createAuditLog).toHaveBeenCalledTimes(1)
    const auditArg = m.createAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(auditArg.action).toBe('COURSE_FIRE')
    expect((auditArg.details as Record<string, unknown>).mode).toBe('next')
    expect((auditArg.details as Record<string, unknown>).courseNumbers).toEqual([1])
    // permission
    expect(m.requireAuth.mock.calls[0][1]).toEqual({ permission: 'take_orders' })
  })

  it('(C2) all → vsi pending v ENI transakciji z ISTIM firedAt, held preskočen', async () => {
    authAs()
    const { order, c1, c2, c3 } = seedFireScenario()
    const res = await firePost(fireReq(order.id, { mode: 'all' }), routeParams(order.id))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.firedCourseIds).toEqual([c1.id, c2.id])
    expect(c1.status).toBe('fired')
    expect(c2.status).toBe('fired')
    expect(c3.status).toBe('held')
    // isti firedAt za vse (isti `now` v transakciji)
    expect(c1.firedAt!.getTime()).toBe(c2.firedAt!.getTime())
    // vsi itemi požganih tokov imajo isti firedAt
    const firedItems = state.items.filter(i => i.courseId === c1.id || i.courseId === c2.id)
    expect(firedItems.every(i => i.status === 'fired' && i.firedAt!.getTime() === c1.firedAt!.getTime())).toBe(true)
    const auditArg = m.createAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect((auditArg.details as Record<string, unknown>).mode).toBe('all')
    expect((auditArg.details as Record<string, unknown>).courseNumbers).toEqual([1, 2])
  })

  it('(C3) no-op: next brez pending → 200 { firedCourseId: null }; all → { firedCourseIds: [] }', async () => {
    authAs()
    const { order, c1, c2, c3 } = seedFireScenario()
    // požgi vse pending → ostane samo held
    await firePost(fireReq(order.id, { mode: 'all' }), routeParams(order.id))
    m.createAuditLog.mockClear()

    const rNext = await firePost(fireReq(order.id, { mode: 'next' }), routeParams(order.id))
    expect(rNext.status).toBe(200)
    expect(await asJson(rNext)).toMatchObject({ firedCourseId: null })
    // held tok NI požgan (no-op ne požge held)
    expect(c3.status).toBe('held')

    const rAll = await firePost(fireReq(order.id, { mode: 'all' }), routeParams(order.id))
    expect(rAll.status).toBe(200)
    expect(await asJson(rAll)).toMatchObject({ firedCourseIds: [] })
    // no-op = brez audita (nič ni bilo požgano)
    expect(m.createAuditLog).not.toHaveBeenCalled()
    expect(c1.firedAt!.getTime()).toBe(c2.firedAt!.getTime()) // ni re-fire-a
  })

  it('(C4) CAS: course, ki ni več pending, se ne požge (updateMany count 0)', async () => {
    authAs()
    const { order, c1, c2 } = seedFireScenario()
    // simulacija race-a: c1 je med findMany in tx prešla v 'fired'
    c1.status = 'fired'
    const res = await firePost(fireReq(order.id, { mode: 'all' }), routeParams(order.id))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    // samo c2 je dejansko požgan (CAS count>0)
    expect(body.firedCourseIds).toEqual([c2.id])
    expect(m.createAuditLog).toHaveBeenCalledTimes(1)
  })

  it('(C5) scope: naročilo tuje lokacije → 404; neznano naročilo → 404', async () => {
    authAs(LOC_2)
    const { order } = seedFireScenario()
    const r = await firePost(fireReq(order.id, { mode: 'next' }), routeParams(order.id))
    expect(r.status).toBe(404)
    expect(m.createAuditLog).not.toHaveBeenCalled()

    authAs(LOC_1)
    const r404 = await firePost(fireReq('ord-neznano', { mode: 'all' }), routeParams('ord-neznano'))
    expect(r404.status).toBe(404)
  })

  it('(C6) Zod: neveljaven manjkajoč mode → 400', async () => {
    authAs()
    const { order } = seedFireScenario()
    const r = await firePost(fireReq(order.id, { mode: 'explode' }), routeParams(order.id))
    expect(r.status).toBe(400)
    const r2 = await firePost(fireReq(order.id, {}), routeParams(order.id))
    expect(r2.status).toBe(400)
    expect(state.captured.courseUpdateMany).toHaveLength(0)
  })
})
