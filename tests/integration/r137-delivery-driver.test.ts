// @vitest-environment node
// ============================================
// R137 / EPIC #115 P1-13 — INTEGRACIJA: DELIVERY/DRIVER WORKFLOW
// ============================================
// Kontrakt P1-13 (R137-b strežnik + R137-c voznikov UI) na pravi bazi
// (PGlite, izoliran PGLITE_DATA_DIR=/tmp/pglite-data-it):
//   (a) GET /api/delivery/assignments → { mine, ready, timestamp }:
//       ready[] = dostavna naročila (type 'delivery', odprt order status)
//       BREZ voznika, scoped na session lokacijo (fail-closed); mine[] =
//       moja aktivna dostavna opravila po driverEmployeeId (identiteta IZ
//       SEJE — ?driverName= filter NE obstaja več). SELECT WHITELIST:
//       naslov/telefon prejemnika (voznikov poklic) + Check.total (COD
//       znesek); Order.customerName/customerEmail/notes NE uhajajo
//       (ključi IN vrednosti).
//   (b) SELF-CLAIM: POST /api/delivery-tracking { deliveryInfoId } (BREZ
//       driverName) → 201 create / 200 že mojo; driverEmployeeId IZ SEJE
//       (nikoli od klienta), driverName = snapshot Employee.name, status
//       'assigned'; drug voznik na zasedeni dostavi → 409
//       DRIVER_ALREADY_ASSIGNED.
//   (c) Status prehodi voznika (CAS + status-transitions.ts enoten kanon):
//       assigned → picked_up → on_the_way → delivered; 'delivered' z
//       { podNotes, cashCollected } izvede COD close-out: DeliveryInfo
//       'delivered' + actualTime, Order.status 'completed',
//       Order.paymentStatus 'paid', Check.paymentStatus 'paid', audit
//       'delivery_delivered' znotraj tx.
//   (d) CAS regresija guard: delivered → picked_up → 400 (terminalno
//       stanje, DB nespremenjena — ni last-writer-wins regresije).
//   (e) Fail-closed: brez auth → 401; tuj tenant (session loc-2 na dostavi
//       lokacije locKioskA) → 404 notInScope (zero-oracle) na OBEH poteh
//       (assign + status), zero pisnih učinkov.
//
// DB PRIPRAVA (fixture R92 MODEL A — test-admin PIN 1111, lokaciji
// 'locKioskA' (prej loc-1, preimenovana, code 'HQ') in 'loc-2' (code
// 'FIL2')):
//     rm -rf /tmp/pglite-data-it
//     PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/init-pglite.mjs
//     PGLITE_DATA_DIR=/tmp/pglite-data-it NEXTAUTH_SECRET=<dev> \
//       node scripts/seed-e2e-pglite.mjs
//     PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/topup-kiosk-e2e.mjs
// Test je KLJUB temu self-sufficient: beforeAll idempotentno poskrbi
// (find/upsert), da fixture vrstice obstajajo — pravilno teče tudi na
// sveže initani bazi BREZ fixture seeda. Fixture vrstice (test-admin,
// lokaciji) afterAll NE briše (ostanejo v seed stanju); briše SAMO svoje
// RUN_ID vrstice po FK redu. AuditLog vrstic NE briše (hash veriga mora
// ostati neprekinjena — r127 restore round-trip jo bere).
//
// Rate limit: route handlerji so klicani DIREKTNO (Next middleware se v
// vitestu ne izvede) — staff limit 300/min ne pride v poštev; ~12 klicev
// te datoteke je varnih tudi ob živem middleware-u. GPS v testih NI
// poslan (ni potreben za kontrakt; GPS pot pokriva unit r112).
//
// Zagon: bunx vitest run tests/integration/r137-delivery-driver.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

// ISTI vzor kot r135-kiosk-order.test.ts: realen auth-middleware
// (importOriginal spread — resolveTenantLocationIdOrThrow ostane REALEN,
// tenant scope je testiran v praksi na DB), samo requireAuth nadomesti
// z ročno konstruirano PIN sejo.
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
import { POST as deliveryTrackingPOST } from '@/app/api/delivery-tracking/route'
import { GET as assignmentsGET } from '@/app/api/delivery/assignments/route'

const RUN_ID = `r137-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
// orderNumber je unikaten po (locationId, orderNumber) — 9-mestna baza iz
// časa zagona je precej nad števcem Counter in unikatna med runi.
const ORDER_BASE = Number(`${Date.now()}`.slice(-9))

const IDS = {
  di1: `${RUN_ID}-di1`,
  di2: `${RUN_ID}-di2`,
  diForeign: `${RUN_ID}-dif`,
  o1: `${RUN_ID}-o1`,
  o2: `${RUN_ID}-o2`,
  oForeign: `${RUN_ID}-of`,
  ck1: `${RUN_ID}-ck1`,
  ck2: `${RUN_ID}-ck2`,
  ckForeign: `${RUN_ID}-ckf`,
  voznik2: `${RUN_ID}-voz2`,
}

// PII vrednosti seedane na naročilih — NIKOLI se smejo pojaviti v odgovoru
// (assignments select je whitelist; preverjene vrednosti IN ključi)
const PII_NAME = 'PII Gost R137'
const PII_EMAIL = 'pii-r137@test.si'
const PII_NOTES = 'brez čebule (PII)'

// Fixture id-ji (e2e seed R92 MODEL A). Lokacije se resolva po UNIKATNI
// kodi ('HQ'/'FIL2'), ker je bil id 'loc-1' preimenovan v 'locKioskA'
// (topup-kiosk-e2e.mjs) — deluje v obeh stanjih (z rename in brez).
const ADMIN = { id: 'test-admin', name: 'Test Admin', email: 'admin@e2e.test' }
const LOC: { delivery: string; foreign: string } = { delivery: '', foreign: '' }

type DeliveryInfoView = {
  id: string
  address: string
  recipientName: string
  recipientPhone: string
  status: string
  order: {
    id: string
    orderNumber: number
    status: string
    paymentStatus: string
    type: string
    locationId: string
    checks: Array<{ total: unknown; paymentStatus: string }>
  }
}

type AssignmentsBody = {
  mine: Array<{
    deliveryInfoId: string
    status: string
    driverName: string
    podNotes: string | null
    deliveryInfo: DeliveryInfoView
  }>
  ready: DeliveryInfoView[]
  timestamp: string
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function trackingPost(body: Record<string, unknown>): Promise<Response> {
  return deliveryTrackingPOST(new Request('http://x/api/delivery-tracking', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

function assignmentsGet(): Promise<Response> {
  return assignmentsGET(new Request('http://x/api/delivery/assignments'))
}

// Idempotentna garantija fixture lokacije (po unikatni kodi — id je bil
// nekoč loc-1, sedaj locKioskA; vrne DEJANSKI id vrstice).
async function ensureLocation(code: string, preferredId: string, name: string): Promise<string> {
  const byCode = await db.location.findUnique({ where: { code } })
  if (byCode) return byCode.id
  await db.location.create({
    data: { id: preferredId, code, name, premisesId: `${RUN_ID}-prem-${code}`, isActive: true },
  }).catch(() => {})
  const created = await db.location.findUnique({ where: { code } })
  if (!created) throw new Error(`R137 seed: lokacija ${code} ni na voljo`)
  return created.id
}

// Idempotentna garantija fixture zaposlenega test-admin (PIN 1111 v seedu;
// za TE teste je dovolj sama vrstica — prijava je mockana, self-claim bere
// ime/telefon iz Employee zapisa).
async function ensureTestAdmin(): Promise<void> {
  await db.employee.upsert({
    where: { email: ADMIN.email },
    update: {},
    create: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'admin', status: 'active' },
  })
}

// Dostavno naročilo z DeliveryInfo + Check (COD, neplačano). FK smer:
// Order.deliveryInfoId @unique → DeliveryInfo (FK živi na Order strani),
// zato nastane DeliveryInfo PRV, nato Order, nato Check.
async function seedDelivery(opts: {
  diId: string; oId: string; ckId: string; address: string
  orderNumber: number; idemKey: string; locationId: string
}): Promise<void> {
  await db.deliveryInfo.create({
    data: {
      id: opts.diId,
      address: opts.address,
      city: 'Ljubljana',
      postCode: '1000',
      recipientName: 'Janez Testni',
      recipientPhone: '040111222',
      deliveryInstructions: 'Zvonec pri vhodu',
      status: 'ready',
      deliveryFee: 2.5,
    },
  })
  await db.order.create({
    data: {
      id: opts.oId,
      orderNumber: opts.orderNumber,
      type: 'delivery',
      status: 'ready',
      paymentStatus: 'unpaid',
      paymentMethod: 'cash', // COD — plačilo ob prevzemu
      locationId: opts.locationId,
      deliveryInfoId: opts.diId,
      idempotencyKey: opts.idemKey,
      subtotal: 10,
      tax: 1.5,
      // Check total vključuje deliveryFee 2.5: 10 + 1.5 + 2.5 = 14
      total: 14,
      // PII markerji — ne smejo uhajati iz assignments whitelist odgovora
      customerName: PII_NAME,
      customerEmail: PII_EMAIL,
      notes: PII_NOTES,
    },
  })
  await db.check.create({
    data: {
      id: opts.ckId,
      orderId: opts.oId,
      checkNumber: 1,
      subtotal: 10,
      tax: 1.5,
      total: 14,
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
    },
  })
}

beforeAll(async () => {
  // 1) Fixture lokaciji (tenant scope potrebuje obe) + test-admin
  LOC.delivery = await ensureLocation('HQ', 'locKioskA', 'Test Restavracija')
  LOC.foreign = await ensureLocation('FIL2', 'loc-2', 'Test Filiala')
  await ensureTestAdmin()

  // 2) Drugi voznik za 409 guard (RUN_ID unikat; pin unikaten — @unique)
  await db.employee.create({
    data: {
      id: IDS.voznik2,
      name: 'Drugi Voznik',
      email: `${RUN_ID}@r137-test.local`,
      role: 'staff',
      status: 'active',
      pin: `${RUN_ID}-pin`,
      locationId: LOC.delivery,
    },
  })

  // 3) Dve dostavni naročili na dostavni lokaciji (ready, brez trackinga)
  await seedDelivery({ diId: IDS.di1, oId: IDS.o1, ckId: IDS.ck1, address: 'Test cesta 1', orderNumber: ORDER_BASE, idemKey: `${RUN_ID}-idem-1`, locationId: LOC.delivery })
  await seedDelivery({ diId: IDS.di2, oId: IDS.o2, ckId: IDS.ck2, address: 'Test cesta 2', orderNumber: ORDER_BASE + 1, idemKey: `${RUN_ID}-idem-2`, locationId: LOC.delivery })
  // + tujetenant dostava na loc-2 — ne sme biti vidna lokacijski seji HQ
  await seedDelivery({ diId: IDS.diForeign, oId: IDS.oForeign, ckId: IDS.ckForeign, address: 'Tuja cesta 3', orderNumber: ORDER_BASE + 2, idemKey: `${RUN_ID}-idem-f`, locationId: LOC.foreign })
})

beforeEach(() => {
  // Privzeta seja: test-admin na dostavni lokaciji (posamezni testi jo
  // lahko zamenjajo/odstranijo)
  authRef.current = { employeeId: ADMIN.id, role: 'admin', locationId: LOC.delivery, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO svoje RUN_ID vrstice. Payment → Check je
  // Restrict (defenzivno najprej), Order → DeliveryInfo kaskadira (order
  // izrecno prej). Fixture vrstice (test-admin, lokaciji) ostanejo; AuditLog
  // se NE briše (neprekinjena hash veriga — r127 restore round-trip jo bere).
  await db.deliveryTracking.deleteMany({ where: { deliveryInfoId: { in: [IDS.di1, IDS.di2, IDS.diForeign] } } }).catch(() => {})
  await db.payment.deleteMany({ where: { checkId: { in: [IDS.ck1, IDS.ck2, IDS.ckForeign] } } }).catch(() => {})
  await db.check.deleteMany({ where: { id: { in: [IDS.ck1, IDS.ck2, IDS.ckForeign] } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: [IDS.o1, IDS.o2, IDS.oForeign] } } }).catch(() => {})
  await db.deliveryInfo.deleteMany({ where: { id: { in: [IDS.di1, IDS.di2, IDS.diForeign] } } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: IDS.voznik2 } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R137 P1-13: delivery/driver workflow (prava PGlite)', () => {
  it('GET /api/delivery/assignments: ready[] vsebuje obe dostavi (brez voznika), mine[] prazna, tuj tenant ni viden, PII whitelist', async () => {
    const res = await assignmentsGet()
    expect(res.status).toBe(200)
    const body = await asJson(res) as unknown as AssignmentsBody

    // mine[]: test-admin še nima prevzetih dostav
    expect(body.mine).toHaveLength(0)

    // ready[]: OBE dostavni naročili (brez voznika), tujetenant (loc-2) NI
    const readyIds = body.ready.map(r => r.id)
    expect(readyIds).toContain(IDS.di1)
    expect(readyIds).toContain(IDS.di2)
    expect(readyIds).not.toContain(IDS.diForeign)

    const readyByDi1 = body.ready.find(r => r.id === IDS.di1)!
    expect(readyByDi1.address).toBe('Test cesta 1')
    expect(readyByDi1.recipientPhone).toBe('040111222')
    expect(readyByDi1.order.orderNumber).toBe(ORDER_BASE)
    expect(readyByDi1.order.type).toBe('delivery')
    expect(readyByDi1.order.paymentStatus).toBe('unpaid')
    // COD znesek: Check.total = 14 (10 + 1.5 DDV + 2.5 dostavnina), take 1
    expect(readyByDi1.order.checks).toHaveLength(1)
    expect(Number(readyByDi1.order.checks[0].total)).toBe(14)
    expect(readyByDi1.order.checks[0].paymentStatus).toBe('unpaid')
    // ready vrstice so FLAT deliveryInfo (brez tracking ovojnice — brez voznika)
    expect(readyByDi1).not.toHaveProperty('driverName')
    expect(readyByDi1).not.toHaveProperty('assignedAt')

    // WHITELIST v praksi: seedane PII VREDNOSTI ne uhajajo …
    const raw = JSON.stringify(body)
    expect(raw).not.toContain(PII_NAME)
    expect(raw).not.toContain(PII_EMAIL)
    expect(raw).not.toContain('brez čebule')
    // … in KLJUČI tudi ne. (Ključa 'notes' namerno NE preverjamo — legitimen
    // voznikov podNotes ga substring-uje; 'total' je namerno whitelistjen
    // kot COD znesek.)
    expect(raw).not.toContain('customerName')
    expect(raw).not.toContain('customerEmail')
    expect(raw).not.toContain('customerPhone')

    // timestamp prisoten in ISO-parseable
    expect(typeof body.timestamp).toBe('string')
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false)
  })

  it('POST self-claim { deliveryInfoId } brez driverName: 201 — driverEmployeeId iz seje, driverName snapshot iz Employee, status assigned', async () => {
    const res = await trackingPost({ deliveryInfoId: IDS.di1 })
    expect(res.status).toBe(201)
    const body = await asJson(res) as {
      deliveryInfoId: string; driverName: string; driverPhone: string
      status: string; driverEmployeeId: string | null; assignedAt: string | null
    }
    expect(body.deliveryInfoId).toBe(IDS.di1)
    // Identiteta voznika pride iz Employee zapisa seje (NIKOLI od klienta)
    expect(body.driverEmployeeId).toBe(ADMIN.id)
    expect(body.driverName).toBe(ADMIN.name) // 'Test Admin' — snapshot imena
    expect(body.status).toBe('assigned')
    expect(body.assignedAt).not.toBeNull()

    // DB: vezava voznika + žigosana lokacija (izpeljava order.locationId)
    const t = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t).not.toBeNull()
    expect(t!.driverEmployeeId).toBe(ADMIN.id)
    expect(t!.driverName).toBe(ADMIN.name)
    expect(t!.status).toBe('assigned')
    expect(t!.assignedAt).not.toBeNull()
    expect(t!.locationId).toBe(LOC.delivery)
    // DeliveryInfo snapshot kurirja (create veja posodobi courier polji)
    const info = await db.deliveryInfo.findUnique({ where: { id: IDS.di1 } })
    expect(info!.courierName).toBe(ADMIN.name)

    // Audit trail: driver_assigned z driverEmployeeId v details
    const audit = await db.auditLog.findFirst({
      where: { action: 'driver_assigned', details: { contains: ADMIN.id } },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
  })

  it('Ponovni self-claim iste osebe: 200 idempotentno (update, brez duplikata) — mine[] zdaj vsebuje dostavo', async () => {
    const res = await trackingPost({ deliveryInfoId: IDS.di1 })
    expect(res.status).toBe(200)
    // Idempotenca: samo EN tracking zapis (update, ne drugi create)
    const count = await db.deliveryTracking.count({ where: { deliveryInfoId: IDS.di1 } })
    expect(count).toBe(1)
    const t = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t!.driverEmployeeId).toBe(ADMIN.id)
    expect(t!.status).toBe('assigned')

    // GET assignments: mine[] vsebuje di1, ready[] je ne več
    const res2 = await assignmentsGet()
    expect(res2.status).toBe(200)
    const body2 = await asJson(res2) as unknown as AssignmentsBody
    expect(body2.mine).toHaveLength(1)
    const mine0 = body2.mine[0]
    expect(mine0.deliveryInfoId).toBe(IDS.di1)
    expect(mine0.status).toBe('assigned')
    expect(mine0.driverName).toBe(ADMIN.name)
    expect(mine0.podNotes).toBeNull()
    expect(mine0.deliveryInfo.order.orderNumber).toBe(ORDER_BASE)
    const readyIds = body2.ready.map(r => r.id)
    expect(readyIds).not.toContain(IDS.di1)
    expect(readyIds).toContain(IDS.di2)
  })

  it('Drugi voznik na zasedeni dostavi → 409 DRIVER_ALREADY_ASSIGNED (guard, dokler dostava ni terminalna)', async () => {
    // Seja voznika #2 (isti tenant — loc-2 seja bi padla na 404 scope prej)
    authRef.current = { employeeId: IDS.voznik2, role: 'admin', locationId: LOC.delivery, permissions: ['take_orders'] }
    const res = await trackingPost({ deliveryInfoId: IDS.di1 })
    expect(res.status).toBe(409)
    const body = await asJson(res)
    expect(String(body.error)).toContain('dodeljenega voznika')
    // DB nespremenjena: voznik ostane test-admin
    const t = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t!.driverEmployeeId).toBe(ADMIN.id)
    expect(t!.driverName).toBe(ADMIN.name)
  })

  it('Status prehodi voznika: picked_up → on_the_way → delivered s POD + COD close-out (Order completed+paid, Check paid)', async () => {
    // 1) picked_up — časovnica
    const r1 = await trackingPost({ deliveryInfoId: IDS.di1, status: 'picked_up' })
    expect(r1.status).toBe(200)
    const t1 = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t1!.status).toBe('picked_up')
    expect(t1!.pickedUpAt).not.toBeNull()

    // 2) on_the_way — časovnica + preslikava na DeliveryInfo (on_the_way → picked_up)
    const r2 = await trackingPost({ deliveryInfoId: IDS.di1, status: 'on_the_way' })
    expect(r2.status).toBe(200)
    const t2 = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t2!.status).toBe('on_the_way')
    expect(t2!.onTheWayAt).not.toBeNull()
    const info2 = await db.deliveryInfo.findUnique({ where: { id: IDS.di1 } })
    expect(info2!.status).toBe('picked_up')

    // 3) delivered s POD opombo + pobrana gotovina → COD close-out
    const r3 = await trackingPost({
      deliveryInfoId: IDS.di1,
      status: 'delivered',
      podNotes: 'Vroče dostavljeno',
      cashCollected: true,
    })
    expect(r3.status).toBe(200)
    const t3 = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t3!.status).toBe('delivered')
    expect(t3!.podNotes).toBe('Vroče dostavljeno')
    expect(t3!.deliveredAt).not.toBeNull()

    // DeliveryInfo: 'delivered' + actualTime
    const info3 = await db.deliveryInfo.findUnique({ where: { id: IDS.di1 } })
    expect(info3!.status).toBe('delivered')
    expect(info3!.actualTime).not.toBeNull()

    // CLOSE-OUT: Order completed + paid, Check paid (COD)
    const order = await db.order.findUnique({ where: { id: IDS.o1 } })
    expect(order!.status).toBe('completed')
    expect(order!.paymentStatus).toBe('paid')
    const check = await db.check.findFirst({ where: { orderId: IDS.o1 } })
    expect(check!.paymentStatus).toBe('paid')

    // Audit 'delivery_delivered' z POD forenziko (zapisan znotraj tx)
    const audit = await db.auditLog.findFirst({
      where: { action: 'delivery_delivered', entityId: IDS.di1 },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    const details = JSON.parse(audit!.details) as { podNotes?: string | null; cashCollected?: boolean; orderId?: string | null }
    expect(details.podNotes).toBe('Vroče dostavljeno')
    expect(details.cashCollected).toBe(true)
    expect(details.orderId).toBe(IDS.o1)
  })

  it('CAS regresija guard: delivered → picked_up → 400, DB ostane terminalno delivered', async () => {
    const res = await trackingPost({ deliveryInfoId: IDS.di1, status: 'picked_up' })
    expect(res.status).toBe(400)
    const body = await asJson(res)
    expect(String(body.error)).toContain('Neveljaven prehod statusa dostave')
    expect(String(body.error)).toContain('delivered')
    const t = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t!.status).toBe('delivered')
    // Close-out ni bil povrnjen: Order ostane completed + paid
    const order = await db.order.findUnique({ where: { id: IDS.o1 } })
    expect(order!.status).toBe('completed')
    expect(order!.paymentStatus).toBe('paid')
  })

  it('Fail-closed: brez auth → 401; tuj tenant (loc-2 seja) → 404 notInScope na obeh poteh, zero pisnih učinkov', async () => {
    // (a) Brez auth — requireAuth vrne 401, pred katerimkoli DB učinkom
    authRef.current = null
    const r401 = await trackingPost({ deliveryInfoId: IDS.di1, status: 'picked_up' })
    expect(r401.status).toBe(401)
    const b401 = await asJson(r401)
    expect(b401).toHaveProperty('error')

    // (b) Tuj tenant ASSIGN: session loc-2 na dostavi lokacije HQ → 404
    //     'Dostava ni najden' (zero-oracle) + NI nastala tracking vrstica
    authRef.current = { employeeId: ADMIN.id, role: 'admin', locationId: LOC.foreign, permissions: ['take_orders'] }
    const rScope = await trackingPost({ deliveryInfoId: IDS.di2 })
    expect(rScope.status).toBe(404)
    const bScope = await asJson(rScope)
    expect(String(bScope.error)).toContain('Dostava ni najden')
    expect(await db.deliveryTracking.count({ where: { deliveryInfoId: IDS.di2 } })).toBe(0)

    // (c) Tuj tenant STATUS: obstoječ tracking (žigosan HQ) iz loc-2 seje →
    //     404 'Sledenje ni najden' + status nespremenjen
    const rScope2 = await trackingPost({ deliveryInfoId: IDS.di1, status: 'picked_up' })
    expect(rScope2.status).toBe(404)
    const bScope2 = await asJson(rScope2)
    expect(String(bScope2.error)).toContain('Sledenje ni najden')
    const t = await db.deliveryTracking.findUnique({ where: { deliveryInfoId: IDS.di1 } })
    expect(t!.status).toBe('delivered')
  })
})
