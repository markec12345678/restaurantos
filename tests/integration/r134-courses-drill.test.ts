// @vitest-environment node
// ============================================
// R134 / EPIC #115 P1-10 — INTEGRACIJA: COURSE MANAGEMENT (prava PGlite)
// ============================================
// Kanon P1-10 na pravi bazi (PGlite, izoliran PGLITE_DATA_DIR; vzorec:
// r133-kds-metrics-drill / r132-recon-drill):
//   1. POST /api/orders s courseNumber 1/2/3 → 3 Course vrstice + courseId wiring
//   2. fire next → SAMO tok 1 fired (+ itemi fired, firedAt ≠ null)
//   3. hold tok 2 → held
//   4. fire all → SAMO tok 3 (tok 2 ostane held — izključen iz fire)
//   5. unhold tok 2 → fire all → tok 2 fired
//   6. ready tok 1 → itemi readyAt ≠ null
//   7. GET /api/kitchen → flattened course fields (courseNumber/courseName/
//      courseStatus), legacy itemi NULL-varno
//   8. legacy order brez courseNumber → 0 Course vrstic (bit-for-bit legacy)
//
// Opomba: auth-middleware (requireAuth) je mockan na MEJI (realna session
// struktura); VSE ostalo (ruta, Zod, tx, audit, deepToNumbers, kitchen
// agregati) je REALNO.
// Zagon: PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/init-pglite.mjs
//        → PGLITE_DATA_DIR=/tmp/pglite-data-it bunx vitest run
//          tests/integration/r134-courses-drill.test.ts
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
import { POST as orderPost } from '@/app/api/orders/route'
import { PUT as coursePut } from '@/app/api/courses/[id]/route'
import { POST as firePost } from '@/app/api/orders/[id]/courses/fire/route'
import { GET as kitchenGet } from '@/app/api/kitchen/route'

const RUN_ID = `r134-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const IDS = {
  location: `${RUN_ID}-loc`,
  employee: `${RUN_ID}-emp`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-mi`,
  orderA: `${RUN_ID}-ord-a`,
  orderLegacy: `${RUN_ID}-ord-legacy`,
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

async function postOrder(body: Record<string, unknown>): Promise<Response> {
  return orderPost(
    authedReq('http://local/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

async function courseAction(courseId: string, action: string): Promise<Response> {
  return coursePut(
    authedReq(`http://local/api/courses/${courseId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
    params(courseId),
  )
}

async function fireAll(orderId: string): Promise<Response> {
  return firePost(
    authedReq(`http://local/api/orders/${orderId}/courses/fire`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'all' }),
    }),
    params(orderId),
  )
}

beforeAll(async () => {
  await db.location.create({ data: { id: IDS.location, name: 'R134 Lokacija', code: `${RUN_ID}-L`, premisesId: `${RUN_ID}-p`, isActive: true } })
  await db.employee.create({
    data: { id: IDS.employee, name: 'R134 Natakar', email: `${RUN_ID}@r134-test.local`, role: 'manager', status: 'active', locationId: IDS.location },
  })
  await db.menu.create({ data: { id: IDS.menu, name: `R134 Meni ${RUN_ID}`, locationId: IDS.location } })
  await db.category.create({ data: { id: IDS.category, name: `R134 Kat ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({
    data: { id: IDS.menuItem, name: 'R134 Test Goveja ločnik', price: 12.5, categoryId: IDS.category, vatRate: 9.5 },
  })

  authRef.current = { employeeId: IDS.employee, role: 'manager', locationId: IDS.location, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu (itemi → tokovi → naročila → katalog → oseba → lokacija)
  await db.orderItem.deleteMany({ where: { orderId: { in: [IDS.orderA, IDS.orderLegacy] } } }).catch(() => {})
  await db.course.deleteMany({ where: { orderId: { in: [IDS.orderA, IDS.orderLegacy] } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: [IDS.orderA, IDS.orderLegacy] } } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.employee } }).catch(() => {})
  await db.location.deleteMany({ where: { id: IDS.location } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R134 integracija: order s tokovi → hold/fire cycle → KDS pariteta', () => {
  let course1 = ''
  let course2 = ''
  let course3 = ''

  it('(1) POST /api/orders s courseNumber 1/2/3 → 3 Course vrstice + courseId wiring + kanonska imena', async () => {
    const res = await postOrder({
      type: 'dine-in',
      orderItems: [
        { menuItemId: IDS.menuItem, quantity: 1, courseNumber: 1 },
        { menuItemId: IDS.menuItem, quantity: 1, courseNumber: 2 },
        { menuItemId: IDS.menuItem, quantity: 2, courseNumber: 3 },
      ],
      idempotencyKey: `${RUN_ID}-key-a`,
    })
    expect(res.status).toBe(201)
    const body = await asJson(res)
    IDS.orderA = body.id as string

    const courses = await db.course.findMany({ where: { orderId: IDS.orderA }, orderBy: { courseNumber: 'asc' } })
    expect(courses).toHaveLength(3)
    expect(courses.map(c => c.courseNumber)).toEqual([1, 2, 3])
    expect(courses.map(c => c.name)).toEqual(['Predjed', 'Juha', 'Glavna jed'])
    expect(courses.every(c => c.status === 'pending')).toBe(true)
    course1 = courses[0].id
    course2 = courses[1].id
    course3 = courses[2].id

    // wiring: itemi nosijo pravi courseId; item status ostane pending
    const items = await db.orderItem.findMany({ where: { orderId: IDS.orderA } })
    expect(items).toHaveLength(3)
    expect(items.find(i => i.courseId === course1)).toBeTruthy()
    expect(items.find(i => i.courseId === course2)).toBeTruthy()
    expect(items.filter(i => i.courseId === course3)).toHaveLength(1)
    expect(items.filter(i => i.courseId === course3)[0].quantity).toBe(2)
    expect(items.every(i => i.status === 'pending' && i.firedAt === null)).toBe(true)
  })

  it('(2) fire next → SAMO tok 1 fired (+ itemi fired, firedAt ≠ null); tok 2/3 pending', async () => {
    const res = await firePost(
      authedReq(`http://local/api/orders/${IDS.orderA}/courses/fire`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'next' }),
      }),
      params(IDS.orderA),
    )
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.firedCourseId).toBe(course1)

    const c1 = await db.course.findUnique({ where: { id: course1 } })
    const c2 = await db.course.findUnique({ where: { id: course2 } })
    const c3 = await db.course.findUnique({ where: { id: course3 } })
    expect(c1!.status).toBe('fired')
    expect(c1!.firedAt).not.toBeNull()
    expect(c2!.status).toBe('pending')
    expect(c3!.status).toBe('pending')

    const c1Items = await db.orderItem.findMany({ where: { courseId: course1 } })
    expect(c1Items.every(i => i.status === 'fired' && i.firedAt !== null)).toBe(true)
    // KDS časovnik kanon 5: item firedAt ≈ course firedAt (isti trenutek)
    expect(c1Items[0].firedAt!.getTime()).toBe(c1!.firedAt!.getTime())
  })

  it('(3) hold tok 2 → held', async () => {
    const res = await courseAction(course2, 'hold')
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.status).toBe('held')
    const c2 = await db.course.findUnique({ where: { id: course2 } })
    expect(c2!.status).toBe('held')
  })

  it('(4) fire all → SAMO tok 3 fired (tok 2 ostane held)', async () => {
    const res = await fireAll(IDS.orderA)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.firedCourseIds).toEqual([course3])

    const c2 = await db.course.findUnique({ where: { id: course2 } })
    const c3 = await db.course.findUnique({ where: { id: course3 } })
    expect(c2!.status).toBe('held')
    expect(c3!.status).toBe('fired')
    expect(c3!.firedAt).not.toBeNull()
  })

  it('(5) unhold tok 2 → fire all → tok 2 fired', async () => {
    const rUnhold = await courseAction(course2, 'unhold')
    expect(rUnhold.status).toBe(200)
    const res = await fireAll(IDS.orderA)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.firedCourseIds).toEqual([course2])

    const c2 = await db.course.findUnique({ where: { id: course2 } })
    expect(c2!.status).toBe('fired')
    expect(c2!.firedAt).not.toBeNull()
  })

  it('(6) ready tok 1 → itemi { status ready, readyAt ≠ null }', async () => {
    const res = await courseAction(course1, 'ready')
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.status).toBe('ready')

    const items = await db.orderItem.findMany({ where: { courseId: course1 } })
    expect(items.every(i => i.status === 'ready' && i.readyAt !== null)).toBe(true)
    // firedAt ostane (ne overwrite-a se z ready)
    expect(items.every(i => i.firedAt !== null)).toBe(true)
  })

  it('(7) GET /api/kitchen → flattened course fields; legacy itemi NULL-varno', async () => {
    // legacy order (BREZ courseNumber) — za NULL-varno preverbo v istem payloadu
    const rLegacy = await postOrder({
      type: 'dine-in',
      orderItems: [{ menuItemId: IDS.menuItem, quantity: 1 }],
      idempotencyKey: `${RUN_ID}-key-legacy`,
    })
    expect(rLegacy.status).toBe(201)
    const legacyBody = await asJson(rLegacy)
    IDS.orderLegacy = legacyBody.id as string
    // legacy → 0 Course vrstic + brez courseId
    expect(await db.course.count({ where: { orderId: IDS.orderLegacy } })).toBe(0)
    const legacyItems = await db.orderItem.findMany({ where: { orderId: IDS.orderLegacy } })
    expect(legacyItems.every(i => i.courseId === null)).toBe(true)

    const res = await kitchenGet(authedReq('http://local/api/kitchen'))
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const orders = body.orders as Array<Record<string, unknown>>

    const orderA = orders.find(o => o.id === IDS.orderA) as Record<string, unknown> | undefined
    expect(orderA).toBeTruthy()
    const aItems = orderA!.orderItems as Array<Record<string, unknown>>
    // flattened course fields (kanon 8)
    const c1Item = aItems.find(i => i.courseId === course1) as Record<string, unknown>
    expect(c1Item.courseNumber).toBe(1)
    expect(c1Item.courseName).toBe('Predjed')
    expect(c1Item.courseStatus).toBe('ready')
    const c2Item = aItems.find(i => i.courseId === course2) as Record<string, unknown>
    expect(c2Item.courseNumber).toBe(2)
    expect(c2Item.courseName).toBe('Juha')
    expect(c2Item.courseStatus).toBe('fired')

    const legacyOrder = orders.find(o => o.id === IDS.orderLegacy) as Record<string, unknown> | undefined
    expect(legacyOrder).toBeTruthy()
    const lItems = legacyOrder!.orderItems as Array<Record<string, unknown>>
    // NULL-varno: legacy itemi brez course → null flattened fields
    expect(lItems.every(i => i.courseNumber === null && i.courseName === null && i.courseStatus === null)).toBe(true)
  })

  it('(8) replay varnost: ponoven fire all na vse-fired → 200 { firedCourseIds: [] }', async () => {
    const res = await fireAll(IDS.orderA)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.firedCourseIds).toEqual([])

    // course state ni izgubljen (refresh/retry kanon 6): tok 1 je ready,
    // tok 2/3 fired — replay vsega tega NE spreminja
    const c1 = await db.course.findUnique({ where: { id: course1 } })
    expect(c1!.status).toBe('ready')
    expect(c1!.firedAt).not.toBeNull()
    const c2 = await db.course.findUnique({ where: { id: course2 } })
    expect(c2!.status).toBe('fired')
    expect(c2!.firedAt).not.toBeNull()
  })
})
