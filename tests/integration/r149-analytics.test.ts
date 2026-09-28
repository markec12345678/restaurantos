// @vitest-environment node
// ============================================
// R149 / EPIC #115 #36 — INTEGRACIJA: ADVANCED ANALYTICS
// GET /api/analytics/overview (R149-b route + _helpers)
// ============================================
// Prava PGlite (IT DB, PGLITE_DATA_DIR=/tmp/pglite-data-it iz
// vitest.config.integration.ts; fileParallelism: false). ZERO migration.
// Dev server teče na /tmp/pglite-data (ločena instanca) — te datoteke se
// ne dotika.
//
// Kontrakt (R149-a/b, kot IMPLEMENTIRANO):
//   • rl 'analytics' PRED authom (AUTHENTICATED_LIMIT 120/min — ta datoteka
//     porabi ~30 klicev), requireAuth permission 'view_reports' (manager
//     preide, waiter 403), MODEL A resolveTenantLocationIdOrThrow (REALEN):
//     regular/manager brez sejske lokacije → 403 NO_LOCATION_MESSAGE;
//     seja z lokacijo avtoritativna (?locationId IGNORIRAN — IDOR pin);
//     super-admin brez ?locationId = GLOBAL, z ?locationId = cross-branch;
//     neobstoječa lokacija → 200 prazne sekcije (zero-oracle R146-b dev 2),
//   • params: start/end obvezna, granularity day|week|month (neznana → 400),
//     okno ≤ 90 dni, start ≥ 2020-01-01, start ≤ end (točna SL sporočila),
//   • agregacije: kpis/series/hourly iz EN order.findMany (paidAt LJ okno),
//     topItems/categoryBreakdown iz orderItem.groupBy (voided:false;
//     revenue = _sum.price × _sum.quantity — ENOTNA cena × količine,
//     dashboard _helpers-analytics precedens), paymentMix iz payment.groupBy
//     (status 'completed', check.order v oknu — Payment ledger §28),
//     orderTypeMix/staffPerformance iz order.groupBy; vsi sorti
//     deterministični z ID tie-breakerjem; pctChange: prev ≤ 0 → null.
//
// SEED STRATEGIJA (r146/r147/r148 kanon): RUN_ID-namespaced lokaciji A/B,
//   2 zaposlena per lokacija (A2 ima ime '' — pin strežniškega passthrougha),
//   katalog (menu/category/menuItem), naročila paid-window prek
//   Order→Check→Payment verige (r146 FK shape) + 1 refunded Payment (pin
//   izključitve iz paymentMix) + 1 voided OrderItem (pin izključitve).
//
// DATUMSKO OKNO — zasebno, FEBRUAR 2031 (CET = UTC+1 celotno; DST šele
//   30. 3. 2031) → ročna matematika LJ↔UTC je deterministična:
//     start 2031-02-07, end 2031-02-13 (7 dni; windowDays 7)
//     LJ okno   = [2031-02-06T23:00Z, 2031-02-13T23:00Z)
//     prev okno = [2031-01-30T23:00Z, 2031-02-06T23:00Z)  (2031-01-31..02-06)
//   Nihče drug v IT DB ne seeda paid naročil s paidAt v 2031 (r146: paidAt
//   null; r141/r145: 2026/now) → exact-count oracle. beforeAll ŠE pred-čisti
//   morebitne lastne ostanke (resilient do partial runs — r146 kanon).
//
// MEJNI NAROČILI (LJ kanon P2-08):
//   O_A1 paidAt = 2031-02-06T23:30Z = LJ 2031-02-07 00:30 →
//     PRVI LJ dan okna (UTC datum je še "prejšnji" — UTC-matematika bi jo
//     dala v serijo 2031-02-06, ki v oknu sploh ne obstaja) + urna celica 00.
//   O_A2 paidAt = 2031-02-07T22:30Z = LJ 23:30 → urna celica 23 (UTC getHours
//     bi dal celico 22 — server-local ura je PREPOVEDANA, P2-08).
//
// Pričakovane vrednosti so ROČNO IZRAČUNANE KONSTANTE (glej tabelo v seedu) —
// NIKOLI re-run agregacijske logike (brez tavtologij).
//
// Zagon: bunx vitest run tests/integration/r149-analytics.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

// Kanon r146/r147/r148: realen auth-middleware (importOriginal spread), samo
// requireAuth nadomesti z ročno konstruirano PIN sejo; realen hasPermission
// za opts.permission gate (403 kanon 1:1). resolveTenantLocationIdOrThrow
// ostane REALEN (ruta ga bere iz '@/lib/tenant-scope' — ni mockan).
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  const { hasPermission } = await import('@/lib/auth-middleware/permissions')
  return {
    ...actual,
    requireAuth: async (
      _req: Request,
      opts?: { permission?: string | string[] },
    ): Promise<{ session: unknown; error: Response | null }> => {
      if (!authRef.current) {
        return {
          session: null,
          error: new Response(
            JSON.stringify({ error: 'Avtentikacija je obvezna. Pošljite Authorization: Bearer <token>' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          ),
        }
      }
      const session = {
        token: 'integration-test-token',
        employeeId: authRef.current.employeeId,
        role: authRef.current.role,
        permissions: authRef.current.permissions,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3_600_000,
        absoluteExpiry: Date.now() + 86_400_000,
        locationId: authRef.current.locationId,
      }
      const required = opts?.permission
        ? (Array.isArray(opts.permission) ? opts.permission : [opts.permission])
        : []
      if (required.length > 0 && !hasPermission(session as never, required as never)) {
        return {
          session: null,
          error: new Response(
            JSON.stringify({ error: 'Nimate dovoljenja za to operacijo.' }),
            { status: 403, headers: { 'content-type': 'application/json' } },
          ),
        }
      }
      return { session, error: null }
    },
  }
})

import { db } from '@/lib/db'
import { GET as overviewGET } from '@/app/api/analytics/overview/route'
import { NO_LOCATION_MESSAGE } from '@/lib/tenant-scope'

const RUN_ID = `r149-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const EMP_ID = `${RUN_ID}-admin`
const nm = (s: string): string => `${s} ${RUN_ID}` // RUN_ID-namespaced prikazna imena

// ---------- Okno (zasebno, Februar 2031 — CET = UTC+1, glej header) ----------
const START = '2031-02-07'
const END = '2031-02-13'
const PREV_START = '2031-01-31'
const PREV_END = '2031-02-06'
const EMPTY_DAY = '2031-03-05' // dan brez RUN_ID paid naročil (prazno okno)

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  locNone: `${RUN_ID}-loc-none`,
  empA1: `${RUN_ID}-emp-a1`,
  empA2: `${RUN_ID}-emp-a2`,
  empB1: `${RUN_ID}-emp-b1`,
  empB2: `${RUN_ID}-emp-b2`,
  empNoLoc: `${RUN_ID}-emp-noloc`,
  menuA: `${RUN_ID}-menu-a`,
  menuB: `${RUN_ID}-menu-b`,
  catFoodA: `${RUN_ID}-cat-food-a`,
  catDrinkA: `${RUN_ID}-cat-drink-a`,
  catB: `${RUN_ID}-cat-b`,
  miA1: `${RUN_ID}-mi-a1`,
  miA2: `${RUN_ID}-mi-a2`,
  miA3: `${RUN_ID}-mi-a3`,
  miB1: `${RUN_ID}-mi-b1`,
  miB2: `${RUN_ID}-mi-b2`,
}

const MY_EMP_IDS = [EMP_ID, IDS.empA1, IDS.empA2, IDS.empB1, IDS.empB2, IDS.empNoLoc]

// UTC paidAt instancia (vsi v CET pasu → LJ = UTC + 1h)
const at = (iso: string): Date => new Date(iso)

// ---------- Response helperji ----------
async function asOverview(res: Response): Promise<Overview> {
  expect(res.status).toBe(200)
  return (await res.json()) as Overview
}

function overviewGet(query: string): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return overviewGET(new Request(`http://localhost/api/analytics/overview?${query}`))
}

function setSession(role: string, locationId: string | null, permissions: string[], employeeId = EMP_ID): void {
  authRef.current = { employeeId, role, locationId, permissions }
}

// ---------- Tipi odgovora (R149-b shape, 1:1) ----------
type Comparison = { current: number; previous: number; deltaPct: number | null }
type Overview = {
  window: { start: string; end: string; granularity: string; prevStart: string; prevEnd: string }
  kpis: { revenue: number; tax: number; tips: number; discounts: number; orders: number; avgOrderValue: number }
  series: { bucket: string; start: string; end: string; revenue: number; orders: number; avgOrderValue: number }[]
  comparison: { revenue: Comparison; orders: Comparison; avgOrderValue: Comparison }
  topItems: { menuItemId: string; name: string; quantity: number; revenue: number }[]
  categoryBreakdown: { category: string; quantity: number; revenue: number }[]
  hourlyProfile: { hour: number; label: string; revenue: number; orders: number }[]
  paymentMix: { type: string; amount: number; tips: number; count: number }[]
  orderTypeMix: { type: string; revenue: number; orders: number }[]
  staffPerformance: { employeeId: string; name: string; revenue: number; orders: number }[]
  meta: { rowCap: number; windowDays: number }
}

const QS = `start=${START}&end=${END}`

// ---------- FK-urejeno čiščenje vseh RUN_ID vrstic (r146 kanon; isto v
// beforeAll PRE-ČIŠČENJU — odpornost na partial runs — in afterAll) ----------
async function cleanupRunId(): Promise<void> {
  await db.auditLog.deleteMany({ where: { userId: { contains: RUN_ID } } }).catch(() => {})
  await db.payment.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.check.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.orderItem.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.category.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.employee.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { contains: RUN_ID } } }).catch(() => {})
}

let auditTailBefore: string | null = null
let orderSeq = 149_000

/** Order→Check→Payment veriga (r146 FK shape) + orderItems. */
async function seedOrder(opts: {
  id: string
  locationId: string
  paidAt: string // ISO UTC
  type: 'dine-in' | 'takeout' | 'delivery'
  employeeId: string | null
  total: number
  tax: number
  tip: number
  discount: number
  items: { menuItemId: string; name: string; quantity: number; price: number; voided?: boolean }[]
  payments: { id: string; amount: number; tipAmount: number; type: 'cash' | 'card'; status?: 'completed' | 'refunded' }[]
}): Promise<void> {
  const paidAt = at(opts.paidAt)
  const chkId = `${opts.id}-chk`
  await db.order.create({
    data: {
      id: opts.id,
      orderNumber: ++orderSeq,
      locationId: opts.locationId,
      type: opts.type,
      status: 'completed',
      paymentStatus: 'paid',
      employeeId: opts.employeeId,
      subtotal: opts.total + opts.discount,
      tax: opts.tax,
      discount: opts.discount,
      tip: opts.tip,
      total: opts.total,
      paidAt,
      createdAt: paidAt,
    },
  })
  await db.check.create({
    data: { id: chkId, checkNumber: 1, orderId: opts.id, total: opts.total, tip: opts.tip, paymentStatus: 'paid', paymentMethod: opts.payments[0]?.type ?? '' },
  })
  for (const it of opts.items) {
    await db.orderItem.create({
      data: {
        id: `${opts.id}-oi-${it.menuItemId.slice(-6)}`,
        orderId: opts.id,
        checkId: chkId,
        menuItemId: it.menuItemId,
        quantity: it.quantity,
        price: it.price, // ENOTNA neto cena (OrderItem.price semantika — post-handler)
        vatRate: 22,
        vatAmount: 0,
        menuItemName: it.name,
        voided: it.voided ?? false,
      },
    })
  }
  for (const p of opts.payments) {
    await db.payment.create({
      data: {
        id: p.id,
        checkId: chkId,
        amount: p.amount,
        tipAmount: p.tipAmount,
        refundAmount: p.status === 'refunded' ? p.amount : 0,
        type: p.type,
        status: p.status ?? 'completed',
        cardType: p.type === 'card' ? 'visa' : '',
        createdAt: paidAt,
      },
    })
  }
}

beforeAll(async () => {
  // 0) AuditLog rep PRED zagonom (chain kontinuiteta v afterAll — r144-d pravilo)
  const tailRow = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  auditTailBefore = tailRow?.chainHash ?? null

  // 0b) PRE-ČIŠČENJE lastnih morebitnih ostankov (partial-run odpornost)
  await cleanupRunId()

  // 1) Lokaciji A/B (zadnji v afterAll — Order.location Restrict)
  await db.location.create({ data: { id: IDS.locA, code: `${RUN_ID}-A`, name: nm('R149 Glavna'), premisesId: `${RUN_ID}-pA`, isActive: true } })
  await db.location.create({ data: { id: IDS.locB, code: `${RUN_ID}-B`, name: nm('R149 Filiala'), premisesId: `${RUN_ID}-pB`, isActive: true } })

  // 2) Zaposleni: admin (seja), 2 per lokacijo (A2 z IMENOM '' — pin passthrougha),
  //    manager brez lokacije (MODEL A fail-closed 403 test)
  await db.employee.create({ data: { id: EMP_ID, name: nm('Test Admin'), email: `r149-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-0`, role: 'admin', locationId: IDS.locA } })
  await db.employee.create({ data: { id: IDS.empA1, name: nm('Natakar A1'), email: `r149a1-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-1`, role: 'staff', locationId: IDS.locA } })
  await db.employee.create({ data: { id: IDS.empA2, name: '', email: `r149a2-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-2`, role: 'staff', locationId: IDS.locA } })
  await db.employee.create({ data: { id: IDS.empB1, name: nm('Natakar B1'), email: `r149b1-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-3`, role: 'staff', locationId: IDS.locB } })
  await db.employee.create({ data: { id: IDS.empB2, name: nm('Vodja B2'), email: `r149b2-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-4`, role: 'staff', locationId: IDS.locB } })
  await db.employee.create({ data: { id: IDS.empNoLoc, name: nm('Vodja brez lokacije'), email: `r149nl-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-5`, role: 'manager', locationId: null } })

  // 3) Katalog (MODEL A: menu/category po lokaciji)
  await db.menu.create({ data: { id: IDS.menuA, name: nm('R149 Meni A'), locationId: IDS.locA } })
  await db.menu.create({ data: { id: IDS.menuB, name: nm('R149 Meni B'), locationId: IDS.locB } })
  await db.category.create({ data: { id: IDS.catFoodA, name: nm('R149 Jed A'), menuId: IDS.menuA } })
  await db.category.create({ data: { id: IDS.catDrinkA, name: nm('R149 Pijača A'), menuId: IDS.menuA } })
  await db.category.create({ data: { id: IDS.catB, name: nm('R149 Jed B'), menuId: IDS.menuB } })
  await db.menuItem.create({ data: { id: IDS.miA1, name: nm('R149 Pizza'), price: 10, categoryId: IDS.catFoodA } })
  await db.menuItem.create({ data: { id: IDS.miA2, name: nm('R149 Sok'), price: 4, categoryId: IDS.catDrinkA } })
  await db.menuItem.create({ data: { id: IDS.miA3, name: nm('R149 Zrezek'), price: 12, categoryId: IDS.catFoodA } })
  await db.menuItem.create({ data: { id: IDS.miB1, name: nm('R149 Burger'), price: 8, categoryId: IDS.catB } })
  await db.menuItem.create({ data: { id: IDS.miB2, name: nm('R149 Sladoled'), price: 3.5, categoryId: IDS.catB } })

  // 4) NAROČILA — trenutno okno (LJ 2031-02-07..02-13).
  //    ROČNA TABELA pričakovanih vrednosti (konstante v asercijah):
  //    ┌ id    lok  LJ dan       UTC paidAt            tip  emp    total tax  tip$ disc
  //    ├ O_A1  A   02-07 00:30   02-06T23:30Z (MEJA!)  din  A1     24    4    2    0
  //    ├ O_A2  A   02-07 23:30   02-07T22:30Z (URA23)   tak  A2''   12    2    0    1
  //    ├ O_A3  A   02-08 12:30   02-08T11:30Z           del  A1     30    5    3    0
  //    ├ O_A4  A   02-09 11:00   02-09T10:00Z           din  NULL   8    1.3   0    0
  //    ├ O_A5  A   02-09 13:00   02-09T12:00Z           din  A1     15   2.5   1    0   (+VOIDED item)
  //    ├ O_B1  B   02-08 10:00   02-08T09:00Z           tak  B1     16   2.6   0    0
  //    ├ O_B2  B   02-09 15:00   02-09T14:00Z           del  B2    13.5  2.4   2   0.5
  //    ├ O_B3  B   02-09 16:30   02-09T15:30Z           din  B1    11.5  1.9   0    0
  //    ├ O_B4  B   02-13 11:30   02-13T10:30Z           tak  B2     14   2.3   0    0   (+refunded pay)
  //    prejšnje okno:
  //    ├ P_A1  A   02-04 11:00   02-04T10:00Z           din  A1     20   3.3   1    0
  //    ├ P_B1  B   02-05 12:00   02-05T11:00Z           tak  B1      8   1.3   0    0
  //    └ KPI: A = 89/5/avg 17.8 (tax 14.8, tips 6, disc 1) · B = 55/4/13.75 (9.2/2/0.5)
  //      GLOBAL = 144/9/16 (24/8/1.5) == A + B · prev GLOBAL = 28/2/14
  //    topItems (qty desc, revenue desc, id asc — revenue = Σenotna cena × Σkoličina):
  //      A: miA1 (rows 2@10+3@10 → 20×5=100, qty 5), miA2 (rows 1@4+2@4 → 8×3=24, qty 3),
  //         miA3 (rows 1@12+1@12 → 24×2=48, qty 2)  ·  B: miB2 (rows 4+1+4 @3.5 → 10.5×9=94.5, qty 9),
  //         miB1 (rows 2@8+1@8 → 16×3=48, qty 3)
  //    paymentMix (samo completed): A cash 47/3 tips/3×, card 42/3/2× ·
  //      B card 27.5/2/2× , cash 27.5/0/2× (ZNESEK TIE → type asc: card PRVI) ·
  //      GLOBAL cash 74.5/3/5×, card 69.5/5/4×
  await seedOrder({
    id: `${RUN_ID}-ord-a1`, locationId: IDS.locA, paidAt: '2031-02-06T23:30:00.000Z', type: 'dine-in', employeeId: IDS.empA1,
    total: 24, tax: 4, tip: 2, discount: 0,
    items: [{ menuItemId: IDS.miA1, name: nm('R149 Pizza'), quantity: 2, price: 10 }, { menuItemId: IDS.miA2, name: nm('R149 Sok'), quantity: 1, price: 4 }],
    payments: [{ id: `${RUN_ID}-pay-a1`, amount: 24, tipAmount: 2, type: 'cash' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-a2`, locationId: IDS.locA, paidAt: '2031-02-07T22:30:00.000Z', type: 'takeout', employeeId: IDS.empA2,
    total: 12, tax: 2, tip: 0, discount: 1,
    items: [{ menuItemId: IDS.miA3, name: nm('R149 Zrezek'), quantity: 1, price: 12 }],
    payments: [{ id: `${RUN_ID}-pay-a2`, amount: 12, tipAmount: 0, type: 'card' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-a3`, locationId: IDS.locA, paidAt: '2031-02-08T11:30:00.000Z', type: 'delivery', employeeId: IDS.empA1,
    total: 30, tax: 5, tip: 3, discount: 0,
    items: [{ menuItemId: IDS.miA1, name: nm('R149 Pizza'), quantity: 3, price: 10 }],
    payments: [{ id: `${RUN_ID}-pay-a3`, amount: 30, tipAmount: 3, type: 'card' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-a4`, locationId: IDS.locA, paidAt: '2031-02-09T10:00:00.000Z', type: 'dine-in', employeeId: null,
    total: 8, tax: 1.3, tip: 0, discount: 0,
    items: [{ menuItemId: IDS.miA2, name: nm('R149 Sok'), quantity: 2, price: 4 }],
    payments: [{ id: `${RUN_ID}-pay-a4`, amount: 8, tipAmount: 0, type: 'cash' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-a5`, locationId: IDS.locA, paidAt: '2031-02-09T12:00:00.000Z', type: 'dine-in', employeeId: IDS.empA1,
    total: 15, tax: 2.5, tip: 1, discount: 0,
    items: [
      { menuItemId: IDS.miA3, name: nm('R149 Zrezek'), quantity: 1, price: 12 },
      { menuItemId: IDS.miA2, name: nm('R149 Sok'), quantity: 1, price: 4, voided: true }, // pin izključitve
    ],
    payments: [{ id: `${RUN_ID}-pay-a5`, amount: 15, tipAmount: 1, type: 'cash' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-b1`, locationId: IDS.locB, paidAt: '2031-02-08T09:00:00.000Z', type: 'takeout', employeeId: IDS.empB1,
    total: 16, tax: 2.6, tip: 0, discount: 0,
    items: [{ menuItemId: IDS.miB1, name: nm('R149 Burger'), quantity: 2, price: 8 }],
    payments: [{ id: `${RUN_ID}-pay-b1`, amount: 16, tipAmount: 0, type: 'cash' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-b2`, locationId: IDS.locB, paidAt: '2031-02-09T14:00:00.000Z', type: 'delivery', employeeId: IDS.empB2,
    total: 13.5, tax: 2.4, tip: 2, discount: 0.5,
    items: [{ menuItemId: IDS.miB2, name: nm('R149 Sladoled'), quantity: 4, price: 3.5 }],
    payments: [{ id: `${RUN_ID}-pay-b2`, amount: 13.5, tipAmount: 2, type: 'card' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-b3`, locationId: IDS.locB, paidAt: '2031-02-09T15:30:00.000Z', type: 'dine-in', employeeId: IDS.empB1,
    total: 11.5, tax: 1.9, tip: 0, discount: 0,
    items: [
      { menuItemId: IDS.miB1, name: nm('R149 Burger'), quantity: 1, price: 8 },
      { menuItemId: IDS.miB2, name: nm('R149 Sladoled'), quantity: 1, price: 3.5 },
    ],
    payments: [{ id: `${RUN_ID}-pay-b3`, amount: 11.5, tipAmount: 0, type: 'cash' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-b4`, locationId: IDS.locB, paidAt: '2031-02-13T10:30:00.000Z', type: 'takeout', employeeId: IDS.empB2,
    total: 14, tax: 2.3, tip: 0, discount: 0,
    items: [{ menuItemId: IDS.miB2, name: nm('R149 Sladoled'), quantity: 4, price: 3.5 }],
    payments: [
      { id: `${RUN_ID}-pay-b4`, amount: 14, tipAmount: 0, type: 'card' },
      { id: `${RUN_ID}-pay-b4r`, amount: 14, tipAmount: 0, type: 'card', status: 'refunded' }, // pin: NE v paymentMix
    ],
  })
  // 5) Prejšnje okno (2031-02-04 / 02-05)
  await seedOrder({
    id: `${RUN_ID}-ord-pa1`, locationId: IDS.locA, paidAt: '2031-02-04T10:00:00.000Z', type: 'dine-in', employeeId: IDS.empA1,
    total: 20, tax: 3.3, tip: 1, discount: 0,
    items: [{ menuItemId: IDS.miA1, name: nm('R149 Pizza'), quantity: 2, price: 10 }],
    payments: [{ id: `${RUN_ID}-pay-pa1`, amount: 20, tipAmount: 1, type: 'cash' }],
  })
  await seedOrder({
    id: `${RUN_ID}-ord-pb1`, locationId: IDS.locB, paidAt: '2031-02-05T11:00:00.000Z', type: 'takeout', employeeId: IDS.empB1,
    total: 8, tax: 1.3, tip: 0, discount: 0,
    items: [{ menuItemId: IDS.miB1, name: nm('R149 Burger'), quantity: 1, price: 8 }],
    payments: [{ id: `${RUN_ID}-pay-pb1`, amount: 8, tipAmount: 0, type: 'card' }],
  })
}, 60_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  setSession('admin', IDS.locA, ['admin'])
})

afterAll(async () => {
  // FK-urejeno čiščenje (r146 kanon) + EMPIRIČNA verifikacija
  await cleanupRunId()

  const tailAfter = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  expect(tailAfter?.chainHash ?? null).toBe(auditTailBefore) // suite NE piše audita (cheap-read kanon)
  expect(await db.auditLog.count({ where: { userId: { contains: RUN_ID } } })).toBe(0)
  expect(await db.payment.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.check.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.orderItem.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.order.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.menuItem.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.category.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.menu.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.employee.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  expect(await db.location.count({ where: { id: { contains: RUN_ID } } })).toBe(0)
  await db.$disconnect().catch(() => {})
}, 60_000)

// ============================================
// 1) MODEL A — locA: per-metrični pin (ročne konstante)
// ============================================
describe('R149 #36: MODEL A locA — vse metrike proti ročnim konstantam', () => {
  it('1. admin seja na A: kpis (89/5/17.8, tax 14.8, tips 6, disc 1) + day serija (7 vedrov, [0]=36/2/18, [1]=30, [2]=23/2/11.5, prazna konstanta) + topItems (qty desc: A1 5×/100, A2 3×/24, A3 2×/48) + kategoriji + paymentMix (cash 47/3/3, card 42/3/2) + orderTypeMix + staff (A1 69/3, A2 "" 12/1)', async () => {
    const p = await asOverview(await overviewGet(QS))

    expect(p.window).toEqual({ start: START, end: END, granularity: 'day', prevStart: PREV_START, prevEnd: PREV_END })
    expect(p.meta).toEqual({ rowCap: 50_000, windowDays: 7 })
    expect(p.kpis).toEqual({ revenue: 89, tax: 14.8, tips: 6, discounts: 1, orders: 5, avgOrderValue: 17.8 })

    // Serija: 7 fiksnihi dnevnikov; LJ večerja vedra (start = LJ polnoč = UTC 23:00 prejšnjega dne)
    expect(p.series).toHaveLength(7)
    expect(p.series[0]).toEqual({ bucket: '2031-02-07', start: '2031-02-06T23:00:00.000Z', end: '2031-02-07T23:00:00.000Z', revenue: 36, orders: 2, avgOrderValue: 18 })
    expect(p.series[1]).toEqual({ bucket: '2031-02-08', start: '2031-02-07T23:00:00.000Z', end: '2031-02-08T23:00:00.000Z', revenue: 30, orders: 1, avgOrderValue: 30 })
    expect(p.series[2]).toEqual({ bucket: '2031-02-09', start: '2031-02-08T23:00:00.000Z', end: '2031-02-09T23:00:00.000Z', revenue: 23, orders: 2, avgOrderValue: 11.5 })
    expect(p.series[3]).toEqual({ bucket: '2031-02-10', start: '2031-02-09T23:00:00.000Z', end: '2031-02-10T23:00:00.000Z', revenue: 0, orders: 0, avgOrderValue: 0 })
    for (const i of [4, 5, 6]) {
      expect(p.series[i].revenue).toBe(0)
      expect(p.series[i].orders).toBe(0)
    }

    // topItems: qty desc primarno → miA1 (5) pred miA2 (3) pred miA3 (2); revenue = Σenotna cena × Σqty
    expect(p.topItems).toEqual([
      { menuItemId: IDS.miA1, name: nm('R149 Pizza'), quantity: 5, revenue: 100 },
      { menuItemId: IDS.miA2, name: nm('R149 Sok'), quantity: 3, revenue: 24 },
      { menuItemId: IDS.miA3, name: nm('R149 Zrezek'), quantity: 2, revenue: 48 },
    ])

    // categoryBreakdown: 'R149 Jed A' = 100 + 48 = 148 (qty 7); 'R149 Pijača A' = 24 (qty 3); revenue desc
    expect(p.categoryBreakdown).toEqual([
      { category: nm('R149 Jed A'), quantity: 7, revenue: 148 },
      { category: nm('R149 Pijača A'), quantity: 3, revenue: 24 },
    ])

    // paymentMix (Payment ledger §28): cash 24+8+15=47 (tips 2+0+1=3, 3×), card 12+30=42 (tips 3, 2×)
    expect(p.paymentMix).toEqual([
      { type: 'cash', amount: 47, tips: 3, count: 3 },
      { type: 'card', amount: 42, tips: 3, count: 2 },
    ])

    // orderTypeMix: dine-in 24+8+15=47/3, delivery 30/1, takeout 12/1 (revenue desc)
    expect(p.orderTypeMix).toEqual([
      { type: 'dine-in', revenue: 47, orders: 3 },
      { type: 'delivery', revenue: 30, orders: 1 },
      { type: 'takeout', revenue: 12, orders: 1 },
    ])

    // staffPerformance: imena s strežnika (ENO polje 'name'); A2 ima IME '' —
    // strežnik ga NE prepiše v '(neimenovan)' (to dela UI); brez employeeId naročilo (O_A4) izključeno
    expect(p.staffPerformance).toEqual([
      { employeeId: IDS.empA1, name: nm('Natakar A1'), revenue: 69, orders: 3 },
      { employeeId: IDS.empA2, name: '', revenue: 12, orders: 1 },
    ])

    // interni konsistenčni oraklji (vse metrike iz istega plačanega okna)
    expect(p.series.reduce((a, b) => a + b.revenue, 0)).toBe(89)
    expect(p.hourlyProfile).toHaveLength(24)
    expect(p.hourlyProfile.map((h) => h.hour)).toEqual([...Array(24).keys()]) // fiksno 0–23
    expect(p.hourlyProfile.reduce((a, b) => a + b.revenue, 0)).toBe(89)
    expect(p.hourlyProfile.reduce((a, b) => a + b.orders, 0)).toBe(5)
  })
})

// ============================================
// 2) MODEL A — locB: tie-breaker pini
// ============================================
describe('R149 #36: MODEL A locB — tie-breakerji (znesek tie → type/id asc)', () => {
  it('2. admin seja na B: kpis (55/4/13.75) + topItems (miB2 9×/94.5 PRVI po qty, miB1 3×/48) + kategorija 142.5/12 + paymentMix ZNESKOVNI TIE 27.5/27.5 → type asc (card PRVI) + staff TIE 27.5/2 vs 27.5/2 → employeeId asc (b1 pred b2)', async () => {
    setSession('admin', IDS.locB, ['admin'])
    const p = await asOverview(await overviewGet(QS))

    expect(p.kpis).toEqual({ revenue: 55, tax: 9.2, tips: 2, discounts: 0.5, orders: 4, avgOrderValue: 13.75 })
    expect(p.series).toHaveLength(7)
    expect(p.series[1]).toEqual({ bucket: '2031-02-08', start: '2031-02-07T23:00:00.000Z', end: '2031-02-08T23:00:00.000Z', revenue: 16, orders: 1, avgOrderValue: 16 })
    expect(p.series[2].revenue).toBe(25) // 13.5 + 11.5
    expect(p.series[2].avgOrderValue).toBe(12.5)
    expect(p.series[6]).toEqual({ bucket: '2031-02-13', start: '2031-02-12T23:00:00.000Z', end: '2031-02-13T23:00:00.000Z', revenue: 14, orders: 1, avgOrderValue: 14 })

    expect(p.topItems).toEqual([
      { menuItemId: IDS.miB2, name: nm('R149 Sladoled'), quantity: 9, revenue: 94.5 },
      { menuItemId: IDS.miB1, name: nm('R149 Burger'), quantity: 3, revenue: 48 },
    ])
    expect(p.categoryBreakdown).toEqual([{ category: nm('R149 Jed B'), quantity: 12, revenue: 142.5 }])

    // TIE po amount (27.5 = 27.5) → sekundarni sort type asc → 'card' < 'cash'
    expect(p.paymentMix).toEqual([
      { type: 'card', amount: 27.5, tips: 2, count: 2 },
      { type: 'cash', amount: 27.5, tips: 0, count: 2 },
    ])

    expect(p.orderTypeMix).toEqual([
      { type: 'takeout', revenue: 30, orders: 2 },
      { type: 'delivery', revenue: 13.5, orders: 1 },
      { type: 'dine-in', revenue: 11.5, orders: 1 },
    ])

    // TIE po revenue IN orders → tie-breaker employeeId asc → emp-b1 pred emp-b2
    expect(p.staffPerformance).toEqual([
      { employeeId: IDS.empB1, name: nm('Natakar B1'), revenue: 27.5, orders: 2 },
      { employeeId: IDS.empB2, name: nm('Vodja B2'), revenue: 27.5, orders: 2 },
    ])

    // urni profil locB: LJ 10:00 → celica 10 = 16/1; 11:30 → 11 = 14/1; 15:00 → 15 = 13.5/1; 16:30 → 16 = 11.5/1
    expect(p.hourlyProfile[10]).toEqual({ hour: 10, label: '10:00', revenue: 16, orders: 1 })
    expect(p.hourlyProfile[11]).toEqual({ hour: 11, label: '11:00', revenue: 14, orders: 1 })
    expect(p.hourlyProfile[15]).toEqual({ hour: 15, label: '15:00', revenue: 13.5, orders: 1 })
    expect(p.hourlyProfile[16]).toEqual({ hour: 16, label: '16:00', revenue: 11.5, orders: 1 })
    expect(p.hourlyProfile.reduce((a, b) => a + b.revenue, 0)).toBe(55)
  })
})

// ============================================
// 3) LEAK per metrika — locA odgovor NIKOLI ne vsebuje B vrstic
// ============================================
describe('R149 #36: scope LEAK per metrika (locA nikoli B)', () => {
  it('3. locA body: NI locB id-ja/imena artikla/kategorije/zaposlenega; topItems/category/staff id-ji samo -a*; vsote po metriki == locA konstante (89/81/5 plačil)', async () => {
    const res = await overviewGet(QS)
    expect(res.status).toBe(200)
    const p = (await res.json()) as Overview
    const bodyStr = JSON.stringify(p)

    // PII/leak markerji: nič iz lokacije B ne sme uhajati
    expect(bodyStr).not.toContain(IDS.locB)
    expect(bodyStr).not.toContain(IDS.miB1)
    expect(bodyStr).not.toContain(IDS.miB2)
    expect(bodyStr).not.toContain(nm('R149 Burger'))
    expect(bodyStr).not.toContain(nm('R149 Sladoled'))
    expect(bodyStr).not.toContain(IDS.empB1)
    expect(bodyStr).not.toContain(IDS.empB2)
    expect(bodyStr).not.toContain(nm('R149 Jed B'))

    // strukturirani LEAK oraklji per metrika
    for (const t of p.topItems) expect(t.menuItemId.startsWith(`${RUN_ID}-mi-a`)).toBe(true)
    expect(p.categoryBreakdown).toHaveLength(2) // samo A kategoriji
    for (const s of p.staffPerformance) expect(s.employeeId.startsWith(`${RUN_ID}-emp-a`)).toBe(true)
    expect(p.staffPerformance.reduce((a, s) => a + s.revenue, 0)).toBe(81) // 69 + 12 (brez B)
    expect(p.paymentMix.reduce((a, m) => a + m.count, 0)).toBe(5) // 3 cash + 2 card (B refunded payment tudi ne)
    expect(p.paymentMix.reduce((a, m) => a + m.amount, 0)).toBe(89) // 47 + 42 == kpis.revenue (Payment ledger pariteta)
    expect(p.orderTypeMix.reduce((a, m) => a + m.revenue, 0)).toBe(89)
    expect(p.kpis.revenue).toBe(89) // ≠ global 144 — KPI-nivojski LEAK dokaz
  })
})

// ============================================
// 4) Global == A + B (živi odgovori, en test — tri seje)
// ============================================
describe('R149 #36: global == locA + locB (živi odgovori)', () => {
  it('4. super-admin global: revenue 144 == A(89) + B(55), orders 9 == 5+4, topItems merge z tie-breakerjem (b2, a1, b1, a2, a3), kategorije 3 (148/142.5/24), urna celica 11 = 8+14 = 22, staff 4 vnosi [A1, B1, B2, A2]', async () => {
    setSession('admin', IDS.locA, ['admin'])
    const pA = await asOverview(await overviewGet(QS))
    setSession('admin', IDS.locB, ['admin'])
    const pB = await asOverview(await overviewGet(QS))
    setSession('super_admin', null, ['admin', 'view_reports'])
    const pG = await asOverview(await overviewGet(QS))

    expect(pG.kpis.revenue).toBe(pA.kpis.revenue + pB.kpis.revenue)
    expect(pG.kpis.revenue).toBe(144)
    expect(pG.kpis.orders).toBe(pA.kpis.orders + pB.kpis.orders)
    expect(pG.kpis.orders).toBe(9)
    expect(pG.kpis.avgOrderValue).toBe(16)
    expect(pG.kpis.tax).toBe(24)
    expect(pG.kpis.tips).toBe(8)
    expect(pG.kpis.discounts).toBe(1.5)

    // merge top items po qty desc + revenue desc + id asc tie-breaker
    expect(pG.topItems.map((t) => t.menuItemId)).toEqual([IDS.miB2, IDS.miA1, IDS.miB1, IDS.miA2, IDS.miA3])

    expect(pG.categoryBreakdown).toEqual([
      { category: nm('R149 Jed A'), quantity: 7, revenue: 148 },
      { category: nm('R149 Jed B'), quantity: 12, revenue: 142.5 },
      { category: nm('R149 Pijača A'), quantity: 3, revenue: 24 },
    ])

    // paymentMix global: cash 74.5/3 tips/5×, card 69.5/5/4× (refunded izključen)
    expect(pG.paymentMix).toEqual([
      { type: 'cash', amount: 74.5, tips: 3, count: 5 },
      { type: 'card', amount: 69.5, tips: 5, count: 4 },
    ])
    expect(pG.paymentMix.reduce((a, m) => a + m.count, 0)).toBe(pA.paymentMix.reduce((a, m) => a + m.count, 0) + pB.paymentMix.reduce((a, m) => a + m.count, 0))

    // urni profil merge: celica 11 = O_A4 (8, LJ 11:00) + O_B4 (14, LJ 11:30)
    expect(pG.hourlyProfile[11]).toEqual({ hour: 11, label: '11:00', revenue: 22, orders: 2 })
    expect(pG.hourlyProfile.reduce((a, b) => a + b.revenue, 0)).toBe(144)

    // staff global: revenue desc → A1 69, B1/B2 tie 27.5 (id asc), A2 12 z imenom ''
    expect(pG.staffPerformance).toEqual([
      { employeeId: IDS.empA1, name: nm('Natakar A1'), revenue: 69, orders: 3 },
      { employeeId: IDS.empB1, name: nm('Natakar B1'), revenue: 27.5, orders: 2 },
      { employeeId: IDS.empB2, name: nm('Vodja B2'), revenue: 27.5, orders: 2 },
      { employeeId: IDS.empA2, name: '', revenue: 12, orders: 1 },
    ])
    expect(pG.series[0].revenue).toBe(36) // samo A
    expect(pG.series[1].revenue).toBe(46) // A 30 + B 16
    expect(pG.series[2].revenue).toBe(48) // A 23 + B 25
    expect(pG.series[6].revenue).toBe(14) // samo B (O_B4)
  })
})

// ============================================
// 5) Cross-branch + zero-oracle + ignoriran ?locationId (IDOR)
// ============================================
describe('R149 #36: cross-branch, zero-oracle, query-ignore', () => {
  it('5. super-admin ?locationId=A → cross-branch == scoped odgovor (89/5)', async () => {
    setSession('super_admin', null, ['admin', 'view_reports'])
    const p = await asOverview(await overviewGet(`${QS}&locationId=${encodeURIComponent(IDS.locA)}`))
    expect(p.kpis).toEqual({ revenue: 89, tax: 14.8, tips: 6, discounts: 1, orders: 5, avgOrderValue: 17.8 })
    expect(p.topItems[0]?.menuItemId).toBe(IDS.miA1)
  })

  it('6. zero-oracle: neobstoječa ?locationId → 200, vse sekcije prazne/nič (brez 404 asimetrije — R146-b dev 2)', async () => {
    setSession('super_admin', null, ['admin', 'view_reports'])
    const p = await asOverview(await overviewGet(`${QS}&locationId=${encodeURIComponent(IDS.locNone)}`))
    expect(p.kpis).toEqual({ revenue: 0, tax: 0, tips: 0, discounts: 0, orders: 0, avgOrderValue: 0 })
    expect(p.series).toHaveLength(7)
    expect(p.series.every((b) => b.revenue === 0 && b.orders === 0)).toBe(true)
    expect(p.hourlyProfile).toHaveLength(24)
    expect(p.hourlyProfile.every((h) => h.revenue === 0 && h.orders === 0)).toBe(true)
    expect(p.topItems).toEqual([])
    expect(p.categoryBreakdown).toEqual([])
    expect(p.paymentMix).toEqual([])
    expect(p.orderTypeMix).toEqual([])
    expect(p.staffPerformance).toEqual([])
    expect(p.comparison.revenue.deltaPct).toBeNull() // prev 0 → null (zero-guard)
  })

  it('7. IDOR pin: manager seja na A + ?locationId=B → query IGNORIRAN (seja avtoritativna) → locA številke, nič B markerjev (manager preide view_reports gate)', async () => {
    setSession('manager', IDS.locA, [])
    const res = await overviewGet(`${QS}&locationId=${encodeURIComponent(IDS.locB)}`)
    expect(res.status).toBe(200)
    const p = (await res.json()) as Overview
    expect(p.kpis).toEqual({ revenue: 89, tax: 14.8, tips: 6, discounts: 1, orders: 5, avgOrderValue: 17.8 })
    const bodyStr = JSON.stringify(p)
    expect(bodyStr).not.toContain(IDS.locB)
    expect(bodyStr).not.toContain(IDS.miB1)
    expect(bodyStr).not.toContain(IDS.empB1)
  })
})

// ============================================
// 6) Comparison — prejšnje okno proti ročnim konstantam + zero-guard
// ============================================
describe('R149 #36: comparison (prev okno, deltaPct, zero-guard)', () => {
  it('8. locA: prev (20/1/20) == ročno; deltaPct {345, 400, −11} == Math.round(((cur−prev)/prev)*1000)/10; locB {587.5, 300, 71.9}', async () => {
    setSession('admin', IDS.locA, ['admin'])
    const pA = await asOverview(await overviewGet(QS))
    expect(pA.comparison.revenue).toEqual({ current: 89, previous: 20, deltaPct: 345 })
    expect(pA.comparison.orders).toEqual({ current: 5, previous: 1, deltaPct: 400 })
    expect(pA.comparison.avgOrderValue).toEqual({ current: 17.8, previous: 20, deltaPct: -11 })

    setSession('admin', IDS.locB, ['admin'])
    const pB = await asOverview(await overviewGet(QS))
    expect(pB.comparison.revenue).toEqual({ current: 55, previous: 8, deltaPct: 587.5 })
    expect(pB.comparison.orders).toEqual({ current: 4, previous: 1, deltaPct: 300 })
    expect(pB.comparison.avgOrderValue).toEqual({ current: 13.75, previous: 8, deltaPct: 71.9 })
  })

  it('9. global: prev 28/2/14 == ročno; deltaPct {414.3, 350, 14.3}', async () => {
    setSession('super_admin', null, ['admin', 'view_reports'])
    const p = await asOverview(await overviewGet(QS))
    expect(p.comparison.revenue).toEqual({ current: 144, previous: 28, deltaPct: 414.3 })
    expect(p.comparison.orders).toEqual({ current: 9, previous: 2, deltaPct: 350 })
    expect(p.comparison.avgOrderValue).toEqual({ current: 16, previous: 14, deltaPct: 14.3 })
  })
})

// ============================================
// 7) Granularnost, LJ meja, determinizem, headerji, ROW_CAP pin
// ============================================
describe('R149 #36: granularnost week + LJ urna meja + determinizem + headers', () => {
  it('10. granularity=week (locA): 2 ISO vedri 2031-W06 (89/5/17.8) / W07 — Feb 7 2031 je petek W06 (pon 03-02); W08 (pon 17-02) je ŽE za koncem okna → enumerator ustavi na ponedeljku ≤ end', async () => {
    const p = await asOverview(await overviewGet(`${QS}&granularity=week`))
    expect(p.window.granularity).toBe('week')
    expect(p.series).toHaveLength(2)
    expect(p.series[0]).toEqual({ bucket: '2031-W06', start: '2031-02-02T23:00:00.000Z', end: '2031-02-09T23:00:00.000Z', revenue: 89, orders: 5, avgOrderValue: 17.8 })
    expect(p.series[1].bucket).toBe('2031-W07')
    expect(p.series[1].revenue).toBe(0)
    expect(p.kpis).toEqual({ revenue: 89, tax: 14.8, tips: 6, discounts: 1, orders: 5, avgOrderValue: 17.8 }) // KPI neodvisni od granularnosti
  })

  it('11. LJ urna/dnevna meja: O_A1 (paidAt 2031-02-06T23:30Z) = LJ 02-07 00:30 → serija[0] (36 vključuje 24) + urna celica 00 = 24/1; O_A2 (02-07T22:30Z) = LJ 23:30 → celica 23 = 12/1, celica 22 == 0 (server-local getHours bi dal 22!)', async () => {
    const p = await asOverview(await overviewGet(QS))
    expect(p.series[0].bucket).toBe('2031-02-07')
    expect(p.series[0].revenue).toBe(36) // brez LJ dan-bucketinga bi O_A1 (UTC 02-06) padla ven → 12
    expect(p.hourlyProfile[0]).toEqual({ hour: 0, label: '00:00', revenue: 24, orders: 1 })
    expect(p.hourlyProfile[23]).toEqual({ hour: 23, label: '23:00', revenue: 12, orders: 1 })
    expect(p.hourlyProfile[22]).toEqual({ hour: 22, label: '22:00', revenue: 0, orders: 0 })
    expect(p.hourlyProfile[12]).toEqual({ hour: 12, label: '12:00', revenue: 30, orders: 1 }) // O_A3 LJ 12:30
  })

  it('12. determinizem: dva zaporedna GETa → JSON.stringify byte-identičen, BREZ generatedAt; Cache-Control no-store na 200', async () => {
    const res1 = await overviewGet(QS)
    const res2 = await overviewGet(QS)
    expect(res1.status).toBe(200)
    expect(res1.headers.get('cache-control')).toBe('no-store')
    const s1 = JSON.stringify(await res1.json())
    const s2 = JSON.stringify(await res2.json())
    expect(s1).toBe(s2) // brez timestampov — byte-stabilno (R149-a kanon)
    expect(s1).not.toContain('generatedAt')
  })

  it('13. ROW_CAP passthrough pin (kodna inspekcija — živi 400 zahteva 50k naročil, unit-pokrito; r146 cap-pin precedens)', async () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'analytics', 'overview', 'route.ts'), 'utf8')
    expect(src).toContain('Okno zajema preveč naročil')
    expect(src).toContain('Zožite obdobje.')
    const helpers = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'analytics', 'overview', '_helpers.ts'), 'utf8')
    expect(helpers).toContain('ANALYTICS_ROW_CAP = 50_000')
  })
})

// ============================================
// 8) Prazno okno + auth kanon + 400 sporočila + zero-audit
// ============================================
describe('R149 #36: prazno okno, auth kanon, 400s, zero-audit', () => {
  it('14. prazno okno (start=end 2031-03-05, brez RUN_ID paid naročil): 200, kpis vse 0, serija 1 prazno vedro, hourly 24×0, deltaPct null ×3 (deljenje z 0 — NI NaN), sekcije []', async () => {
    const p = await asOverview(await overviewGet(`start=${EMPTY_DAY}&end=${EMPTY_DAY}`))
    expect(p.kpis).toEqual({ revenue: 0, tax: 0, tips: 0, discounts: 0, orders: 0, avgOrderValue: 0 })
    expect(p.window).toEqual({ start: EMPTY_DAY, end: EMPTY_DAY, granularity: 'day', prevStart: '2031-03-04', prevEnd: '2031-03-04' })
    expect(p.meta.windowDays).toBe(1)
    expect(p.series).toHaveLength(1)
    expect(p.series[0].bucket).toBe(EMPTY_DAY)
    expect(p.series[0].revenue).toBe(0)
    expect(p.hourlyProfile).toHaveLength(24)
    expect(p.hourlyProfile.every((h) => h.revenue === 0 && h.orders === 0)).toBe(true)
    expect(p.comparison.revenue).toEqual({ current: 0, previous: 0, deltaPct: null })
    expect(p.comparison.orders).toEqual({ current: 0, previous: 0, deltaPct: null })
    expect(p.comparison.avgOrderValue).toEqual({ current: 0, previous: 0, deltaPct: null })
    expect(p.topItems).toEqual([])
    expect(p.categoryBreakdown).toEqual([])
    expect(p.paymentMix).toEqual([])
    expect(p.orderTypeMix).toEqual([])
    expect(p.staffPerformance).toEqual([])
  })

  it('15. auth kanon: brez seje → 401; waiter (brez permissionov) → 403 gate; manager BREZ lokacije → 403 fail-closed NO_LOCATION_MESSAGE', async () => {
    authRef.current = null
    const res401 = await overviewGet(QS)
    expect(res401.status).toBe(401)
    expect(((await res401.json()) as { error: string }).error).toContain('Avtentikacija je obvezna')

    setSession('waiter', IDS.locA, [])
    const res403perm = await overviewGet(QS)
    expect(res403perm.status).toBe(403)
    expect(((await res403perm.json()) as { error: string }).error).toBe('Nimate dovoljenja za to operacijo.')

    setSession('manager', null, [], IDS.empNoLoc)
    const res403noloc = await overviewGet(QS)
    expect(res403noloc.status).toBe(403)
    expect(((await res403noloc.json()) as { error: string }).error).toBe(NO_LOCATION_MESSAGE)
  })

  it('16. 400 parametri: manjkajoč start/end, neznana granularnost, okno 91 dni, start pred 2020, start > end — TOČNA sporočila + no-store tudi na 400', async () => {
    setSession('admin', IDS.locA, ['admin'])
    const cases: Array<[string, string]> = [
      ['end=' + END, 'Začetni datum je obvezen.'],
      ['start=' + START, 'Končni datum je obvezen.'],
      [`${QS}&granularity=bogus`, 'Neznana granularnost. Dovoljene: day, week, month'],
      ['start=2030-12-01&end=2031-03-01', 'Obdobje ne sme preseči 90 dni. Uporabite manjše obdobje.'],
      ['start=2019-12-31&end=2019-12-31', 'Začetni datum ne more biti pred 2020'],
      ['start=2031-02-13&end=2031-02-07', 'Začetni datum mora biti pred končnim'],
    ]
    let checkedNoStore = false
    for (const [qs, message] of cases) {
      const res = await overviewGet(qs)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe(message)
      if (!checkedNoStore) {
        expect(res.headers.get('cache-control')).toBe('no-store')
        checkedNoStore = true
      }
    }
    // 90 dni je ŠE dovoljeno (meja inkluizivna)
    expect((await overviewGet('start=2030-12-01&end=2031-02-28')).status).toBe(200)
  })

  it('17. zero-audit: cheap-read kanon — NIČ novih AuditLog vrstic za RUN_ID akterja (tudi cross-branch klic iz test 5 ne piše audita)', async () => {
    expect(await db.auditLog.count({ where: { userId: { contains: RUN_ID } } })).toBe(0)
    expect(await db.auditLog.count({ where: { entityType: 'AnalyticsOverview' } })).toBe(0)
  })
})
