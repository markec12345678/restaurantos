// @vitest-environment node
// ============================================
// R141 / EPIC #115 P2-28 — INTEGRACIJA: MANAGER DAILY BRIEFING
// ============================================
// GET /api/reports/briefing (R141-b strežnik) na pravi bazi (PGlite,
// izoliran PGLITE_DATA_DIR=/tmp/pglite-data-it). Kontrakt R141-a:
//   • requireAuth view_reports + resolveTenantLocationIdOrThrow (fail-closed):
//       – brez seje → 401; regular user brez lokacije → 403
//       – lokacijska seja je AVTORITATIVNA (?locationId IGNORIRAN)
//       – super-admin brez ?locationId → null scope (globalni pogled),
//         zReportStatus/dailyCloseStatus null — NIKOLI izmišljen 'none'
//   • date: format YYYY-MM-DD + mesec 01-12/dan 01-31 → sicer 400 (PRED
//     scope resolverjem); semantika (30.2.) ostane na ljubljanaDayBounds
//   • LJ poslovni dan (P2-08/R126 kanon) — THE ključna integracijska
//     lastnost: nočna plačila morajo pasti v PRAVI LJ dan tudi čez DST prehod
//   • per-sekcijski .catch → nevtralni fallback; Cache-Control no-store
//   • prazen dan → nevtralne ničle / prazna polja (ne 500, ne NaN)
//   • issues: mnenja new/in_review; legacy (pred 0021) semantika — na
//     skladni bazi je status NOT NULL DEFAULT 'new' (backfill), zato legacy
//     NULL vrstica FIZIČNO ne more obstajati (test to pina z 23502); legacy
//     resolved (responded=true, backfill 'new') izključi responded:false
//
// ✅ SERVER BUG NAJDEN (R141-d) IN POPRAVLJEN (R141-final, glavni agent):
//   src/app/api/reports/briefing/_helpers.ts — fetchIssuesSection je v
//   `oldest` agregatu nosil OR-vejo { status: null, responded: false } BREZ
//   lastnega catch-a. Prisma klient zavrže null filter na NOT NULL stolpcu
//   ŽE pri validaciji poizvedbe (PrismaClientValidationError "Argument
//   `status` is missing") → Promise.all rejecta → route .catch → CELOTA
//   issues sekcija je padla na NEUTRAL_ISSUES (unresolvedFeedback vedno
//   {0,0,null}, pendingApprovals vedno 0/0) tudi ko nerešena mnenja
//   OBSTAJAJO. Unit trap-DB testi tega ne vidijo (mock ne validira).
//   POPIAVEK: mrtva legacy brancha odstranjena; nerešeni set = status in
//   ('new','in_review') + responded:false (legacy resolved izključen).
//
// SEED STRATEGIJA: 3 DEDIKIRANE lokacije (A = glavna s podatki, B = tuja,
// C = prazna) z unikatnimi RUN_ID markerji → natančne trditve brez
// interferenc fixture podatkov (HQ/FIL2 ostanejo nedotaknjeni). Seja je
// ročno konstruirana PIN seja (r137/r140 kanon — requireAuth nadomeščen,
// resolveTenantLocationIdOrThrow ostane REALEN). Čiščenje v afterAll po FK
// redu, SAMO lastne RUN_ID vrstice; AuditLog se NE piše (read-only GET).
//
// ČASOVNE MEJE (izračunano z ljubljanaDayBounds algoritmom, DST-varno):
//   LJ dan 2026-09-24 (CEST +2): [2026-09-23T22:00:00.000Z, 2026-09-24T22:00:00.000Z)
//   LJ dan 2026-09-25 (CEST +2): [2026-09-24T22:00:00.000Z, 2026-09-25T22:00:00.000Z)
//   LJ dan 2026-03-29 (23-URNI dan — DST prehod 29.3.2026 02:00 CET → 03:00 CEST):
//       [2026-03-28T23:00:00.000Z (00:00 CET), 2026-03-29T22:00:00.000Z (00:00 CEST naslednjega dne))
//   LJ dan 2026-03-30 (CEST +2): [2026-03-29T22:00:00.000Z, 2026-03-30T22:00:00.000Z)
//
// Rate limit: route handler je klican DIREKTNO (middleware se v vitestu ne
// izvede); AUTHENTICATED_LIMIT 120/min in ~17 klicev te datoteke je varnih.
//
// Zagon: bunx vitest run tests/integration/r141-briefing.test.ts \
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

// ISTI vzorec kot r137/r140: realen auth-middleware (importOriginal spread —
// resolveTenantLocationIdOrThrow ostane REALEN, tenant scope je testiran v
// praksi na pravi bazi), samo requireAuth nadomesti z ročno PIN sejo.
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
import { GET as briefingGET } from '@/app/api/reports/briefing/route'

const RUN_ID = `r141-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
// orderNumber je unikaten po (locationId, orderNumber) — 9-mestna baza iz
// časa zagona (r137/r140 vzorec, varno nad Counter števcem).
const ORDER_BASE = Number(`${Date.now()}`.slice(-9))

// ---------- Fiksni UTC trenutki (LJ poslovni dnevi — glej header) ----------
// (a) 23:30 LJ 29.3.2026 — po DST prehodu je odmik CEST +2 → 21:30Z
const DST_A_PAID_AT = new Date('2026-03-29T21:30:00.000Z')
// (b) 00:30 LJ 30.3.2026 — CEST +2 → 22:30Z (29.3.) = LJ POSLOVNI DAN 30.3.
const DST_B_PAID_AT = new Date('2026-03-29T22:30:00.000Z')
// Včeraj (za ?date=2026-09-25) = LJ dan 2026-09-24 = [22:00Z 23.9., 22:00Z 24.9.)
const Y1_PAID_AT = new Date('2026-09-24T10:00:00.000Z') // 12:00 LJ
const Y2_PAID_AT = new Date('2026-09-24T18:00:00.000Z') // 20:00 LJ
// Današnji dan (LJ 2026-09-25) — ZUNAJ včerajšnjega okna
const Y3_PAID_AT = new Date('2026-09-25T08:00:00.000Z') // 10:00 LJ
// Tuja lokacija (B) — včerajšnje okno (za scope-izolacijo + globalni pogled)
const FB_B_PAID_AT = new Date('2026-09-24T12:00:00.000Z')
// Odpadki včeraj (11:00 LJ)
const WASTE_AT = new Date('2026-09-24T09:00:00.000Z')
// Reversal čas za izključeni odpadek
const WASTE_REVERSED_AT = new Date('2026-09-24T15:00:00.000Z')

// Rezervacije — LJ dan 2026-09-25 = [22:00Z 24.9., 22:00Z 25.9.) (CEST +2)
const RES_SEATED_AT = new Date('2026-09-25T11:00:00.000Z') // 13:00 LJ
const RES_CANCELLED_AT = new Date('2026-09-25T12:00:00.000Z')
const RES_NO_SHOW_AT = new Date('2026-09-25T13:00:00.000Z')
const RES_CONF1_AT = new Date('2026-09-25T17:00:00.000Z') // 19:00 LJ
const RES_CONF2_AT = new Date('2026-09-25T18:00:00.000Z')
const RES_FOREIGN_AT = new Date('2026-09-25T19:00:00.000Z')

// Datum zahtevkov: včeraj = 2026-09-24, danes = 2026-09-25 (LJ)
const DATE_MAIN = '2026-09-25'

// Odstotna sprememba 11 vs 30 (pctChange kanon: 1 decimala) — za DST test
const PCT_11_VS_30 = -63.3

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  locC: `${RUN_ID}-loc-c`,
  tableA: `${RUN_ID}-t1`,
  menu: `${RUN_ID}-menu`,
  category: `${RUN_ID}-cat`,
  menuItem: `${RUN_ID}-mi`,
  invFlour: `${RUN_ID}-inv-low`, // nizka zaloga (low)
  invZero: `${RUN_ID}-inv-crit`, // kritična zaloga (0)
  invWasteSrc: `${RUN_ID}-inv-wsrc`, // vir odpadkov (zdrava zaloga)
  oDstA: `${RUN_ID}-o-dst-a`,
  oDstB: `${RUN_ID}-o-dst-b`,
  oY1: `${RUN_ID}-o-y1`,
  oY2: `${RUN_ID}-o-y2`,
  oYP: `${RUN_ID}-o-yp`, // NEplačano (pending) — izključeno iz yesterday
  oY3: `${RUN_ID}-o-y3`, // plačano DANES — izključeno iz yesterday
  oForeignB: `${RUN_ID}-o-fb`, // tuja lokacija B — včeraj
  oi1: `${RUN_ID}-oi1`,
  oi2: `${RUN_ID}-oi2`,
  oi3: `${RUN_ID}-oi3`, // voided — izključen iz topItems
  oi4: `${RUN_ID}-oi4`,
  wSpoiled: `${RUN_ID}-w1`,
  wExpired: `${RUN_ID}-w2`,
  wReversed: `${RUN_ID}-w3`, // reversiran — izključen
  fbNew: `${RUN_ID}-fb1`,
  fbInReview: `${RUN_ID}-fb2`,
  fbResolved: `${RUN_ID}-fb3`,
  fbOld: `${RUN_ID}-fb4`, // najstarejše nerešeno → issues.oldest
  guestVip: `${RUN_ID}-vip`,
  resSeated: `${RUN_ID}-r1`,
  resConf1: `${RUN_ID}-r2`,
  resConf2: `${RUN_ID}-r3`,
  resCancelled: `${RUN_ID}-r4`,
  resNoShow: `${RUN_ID}-r5`,
  resForeignB: `${RUN_ID}-r6`,
  zReport: `${RUN_ID}-zr`,
}

const NULL_PROBE_ID = `${RUN_ID}-null-probe`

// Markerji (PII-vrednosti seedov se NIKOLI ne smejo pojaviti v odgovoru)
const VIP_PHONE = `+38641${Date.now() % 1000000}`
const FB_OLD_CREATED_AT = new Date(Date.now() - 3 * 86_400_000)

const LOC_IDS = [IDS.locA, IDS.locB, IDS.locC]
const MY_ORDER_IDS = [IDS.oDstA, IDS.oDstB, IDS.oY1, IDS.oY2, IDS.oYP, IDS.oY3, IDS.oForeignB]

// Globalni baseline (pred seedom) — globalni scope je PRAZEN filter, zato
// prišteva tudi MOREBITNE tuje plačane naročilne v včerajšnjem oknu (fixture
// vrstice drugih runov). Globalni test pričakuje baseline + moje sejanje.
let baselineGlobalRevenue = 0
let baselineGlobalCount = 0

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function briefingGet(query = ''): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return briefingGET(new Request(`http://localhost/api/reports/briefing${query}`))
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

beforeAll(async () => {
  // 0) Globalni baseline včerajšnjega okna (PRED lastnim seedom)
  const base = await db.order.aggregate({
    where: { paymentStatus: 'paid', paidAt: { gte: new Date('2026-09-23T22:00:00.000Z'), lt: new Date('2026-09-24T22:00:00.000Z') } },
    _sum: { total: true },
    _count: true,
  })
  baselineGlobalRevenue = round2(Number(base._sum.total ?? 0))
  baselineGlobalCount = base._count

  // 1) Tri dedikirane lokacije (code/premisesId unikaten po RUN_ID)
  await db.location.create({
    data: { id: IDS.locA, code: `${RUN_ID}-A`, name: `R141 Glavna ${RUN_ID}`, premisesId: `${RUN_ID}-pA`, isActive: true },
  })
  await db.location.create({
    data: { id: IDS.locB, code: `${RUN_ID}-B`, name: `R141 Filiala ${RUN_ID}`, premisesId: `${RUN_ID}-pB`, isActive: true },
  })
  await db.location.create({
    data: { id: IDS.locC, code: `${RUN_ID}-C`, name: `R141 Prazna ${RUN_ID}`, premisesId: `${RUN_ID}-pC`, isActive: true },
  })

  // 2) Miza na A (rezervacija z mizo)
  await db.table.create({ data: { id: IDS.tableA, number: 12, locationId: IDS.locA } })

  // 3) Katalog (menu → category → menuItem) za OrderItem FK (menuItemId NOT NULL)
  await db.menu.create({ data: { id: IDS.menu, name: `R141 Meni ${RUN_ID}`, locationId: IDS.locA, isActive: true } })
  await db.category.create({ data: { id: IDS.category, name: `R141 Kategorija ${RUN_ID}`, menuId: IDS.menu } })
  await db.menuItem.create({ data: { id: IDS.menuItem, name: `R141 Test artikel ${RUN_ID}`, price: 10, categoryId: IDS.category, vatRate: 22, isAvailable: true } })

  // 4) Zalogovni artikli: low (4 ≤ 20), critical (0 ≤ 5), vir odpadkov (50, zdrav)
  await db.inventoryItem.create({
    data: { id: IDS.invFlour, name: `R141 Moka ${RUN_ID}`, unit: 'kg', quantity: 4, minQuantity: 20, costPerUnit: 2, locationId: IDS.locA },
  })
  await db.inventoryItem.create({
    data: { id: IDS.invZero, name: `R141 Trska ${RUN_ID}`, unit: 'kg', quantity: 0, minQuantity: 5, costPerUnit: 8, locationId: IDS.locA },
  })
  await db.inventoryItem.create({
    data: { id: IDS.invWasteSrc, name: `R141 Sladkor ${RUN_ID}`, unit: 'kg', quantity: 50, minQuantity: 5, costPerUnit: 5, locationId: IDS.locA },
  })

  // 5) Naročila — DST par (ključni LJ test), včerajšnji par, negativni primeri,
  //    tuja lokacija B
  await db.order.create({
    data: { id: IDS.oDstA, orderNumber: ORDER_BASE, type: 'dine-in', status: 'completed', paymentStatus: 'paid', paidAt: DST_A_PAID_AT, locationId: IDS.locA, total: 30, tip: 2 },
  })
  await db.order.create({
    data: { id: IDS.oDstB, orderNumber: ORDER_BASE + 1, type: 'dine-in', status: 'completed', paymentStatus: 'paid', paidAt: DST_B_PAID_AT, locationId: IDS.locA, total: 11, tip: 1 },
  })
  await db.order.create({
    data: { id: IDS.oY1, orderNumber: ORDER_BASE + 2, type: 'dine-in', status: 'completed', paymentStatus: 'paid', paidAt: Y1_PAID_AT, locationId: IDS.locA, total: 30, tip: 3 },
  })
  await db.order.create({
    data: { id: IDS.oY2, orderNumber: ORDER_BASE + 3, type: 'dine-in', status: 'completed', paymentStatus: 'paid', paidAt: Y2_PAID_AT, locationId: IDS.locA, total: 20, tip: 2 },
  })
  await db.order.create({
    data: { id: IDS.oYP, orderNumber: ORDER_BASE + 4, type: 'dine-in', status: 'pending', paymentStatus: 'pending', locationId: IDS.locA, total: 999 },
  })
  await db.order.create({
    data: { id: IDS.oY3, orderNumber: ORDER_BASE + 5, type: 'dine-in', status: 'completed', paymentStatus: 'paid', paidAt: Y3_PAID_AT, locationId: IDS.locA, total: 77 },
  })
  await db.order.create({
    data: { id: IDS.oForeignB, orderNumber: ORDER_BASE + 6, type: 'dine-in', status: 'completed', paymentStatus: 'paid', paidAt: FB_B_PAID_AT, locationId: IDS.locB, total: 41, tip: 1 },
  })

  // 6) OrderItems (menuItemId FK → moj menuItem; menuItemName = snapshot)
  await db.orderItem.create({ data: { id: IDS.oi1, orderId: IDS.oY1, menuItemId: IDS.menuItem, menuItemName: 'R141 Pica margherita', quantity: 2, price: 10, status: 'served' } })
  await db.orderItem.create({ data: { id: IDS.oi2, orderId: IDS.oY1, menuItemId: IDS.menuItem, menuItemName: 'R141 Solata', quantity: 1, price: 10, status: 'served' } })
  await db.orderItem.create({ data: { id: IDS.oi3, orderId: IDS.oY1, menuItemId: IDS.menuItem, menuItemName: 'R141 Void artikel', quantity: 1, price: 5, voided: true, status: 'served' } })
  await db.orderItem.create({ data: { id: IDS.oi4, orderId: IDS.oY2, menuItemId: IDS.menuItem, menuItemName: 'R141 Pica margherita', quantity: 1, price: 10, status: 'served' } })

  // 7) Odpadki včeraj: 2 veljavna (SPOILED 10 + EXPIRED 5) + 1 reversiran (99 → izključen)
  await db.wasteRecord.create({
    data: { id: IDS.wSpoiled, locationId: IDS.locA, inventoryItemId: IDS.invWasteSrc, quantity: 2, unit: 'kg', reason: 'SPOILED', costPerUnit: 5, totalCost: 10, createdAt: WASTE_AT },
  })
  await db.wasteRecord.create({
    data: { id: IDS.wExpired, locationId: IDS.locA, inventoryItemId: IDS.invWasteSrc, quantity: 1, unit: 'kg', reason: 'EXPIRED', costPerUnit: 5, totalCost: 5, createdAt: WASTE_AT },
  })
  await db.wasteRecord.create({
    data: { id: IDS.wReversed, locationId: IDS.locA, inventoryItemId: IDS.invWasteSrc, quantity: 1, unit: 'kg', reason: 'BROKEN', costPerUnit: 99, totalCost: 99, createdAt: WASTE_AT, reversedAt: WASTE_REVERSED_AT },
  })

  // 8) Mnenja: new + in_review + resolved + staro nerešeno (oldest)
  await db.guestFeedback.create({
    data: { id: IDS.fbNew, locationId: IDS.locA, guestName: `R141 Gost ${RUN_ID}`, overallRating: 5, comment: `R141 mnenje new ${RUN_ID}`, tags: '[]', source: 'pos', status: 'new' },
  })
  await db.guestFeedback.create({
    data: { id: IDS.fbInReview, locationId: IDS.locA, guestName: `R141 Gost ${RUN_ID}`, overallRating: 3, comment: `R141 mnenje in_review ${RUN_ID}`, tags: '[]', source: 'pos', status: 'in_review' },
  })
  await db.guestFeedback.create({
    data: { id: IDS.fbResolved, locationId: IDS.locA, guestName: `R141 Gost ${RUN_ID}`, overallRating: 4, comment: `R141 mnenje resolved ${RUN_ID}`, tags: '[]', source: 'pos', status: 'resolved' },
  })
  await db.guestFeedback.create({
    data: { id: IDS.fbOld, locationId: IDS.locA, guestName: `R141 Gost ${RUN_ID}`, overallRating: 2, comment: `R141 mnenje oldest ${RUN_ID}`, tags: '[]', source: 'pos', status: 'new', createdAt: FB_OLD_CREATED_AT },
  })

  // 9) Rezervacije — LJ dan 2026-09-25 na A (+ tuja na B za scope dokaz)
  await db.reservation.create({
    data: { id: IDS.resSeated, customerName: `R141 Seated ${RUN_ID}`, dateTime: RES_SEATED_AT, partySize: 3, status: 'seated', locationId: IDS.locA },
  })
  await db.reservation.create({
    data: {
      id: IDS.resConf1, customerName: `R141 Praznovanje ${RUN_ID}`, dateTime: RES_CONF1_AT, partySize: 4, status: 'confirmed',
      notes: `R141 rojstni dan ${RUN_ID}`, specialRequests: 'Otroški stol', tableId: IDS.tableA, locationId: IDS.locA,
    },
  })
  await db.reservation.create({
    data: { id: IDS.resConf2, customerName: `R141 VIP ${RUN_ID}`, customerPhone: VIP_PHONE, dateTime: RES_CONF2_AT, partySize: 2, status: 'confirmed', locationId: IDS.locA },
  })
  await db.reservation.create({
    data: { id: IDS.resCancelled, customerName: `R141 Odpoved ${RUN_ID}`, dateTime: RES_CANCELLED_AT, partySize: 5, status: 'cancelled', locationId: IDS.locA },
  })
  await db.reservation.create({
    data: { id: IDS.resNoShow, customerName: `R141 Ni prišel ${RUN_ID}`, dateTime: RES_NO_SHOW_AT, partySize: 6, status: 'no_show', locationId: IDS.locA },
  })
  await db.reservation.create({
    data: { id: IDS.resForeignB, customerName: `R141 Tujec ${RUN_ID}`, dateTime: RES_FOREIGN_AT, partySize: 8, status: 'confirmed', locationId: IDS.locB },
  })

  // 10) VIP gost (soft-join prek customerPhone → Guest.phone; isVip boolean v odgovoru)
  await db.guest.create({
    data: { id: IDS.guestVip, lastName: `R141 Vip ${RUN_ID}`, phone: VIP_PHONE, isVip: true, locationId: IDS.locA },
  })

  // 11) ZReport za včeraj (reportDate = LJ day-start 2026-09-24 = 22:00Z 23.9.)
  await db.zReport.create({
    data: { id: IDS.zReport, reportDate: new Date('2026-09-23T22:00:00.000Z'), openedAt: new Date('2026-09-23T22:00:00.000Z'), locationId: IDS.locA, status: 'finalized' },
  })
}, 30_000)

beforeEach(() => {
  // Privzeta seja: upravitelj na glavni lokaciji A (posamezni testi jo
  // zamenjajo/odstranijo)
  authRef.current = { employeeId: `emp-${RUN_ID}`, role: 'manager', locationId: IDS.locA, permissions: ['view_reports'] }
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (lokacije A/B/C so
  // dedikirane → deleteMany po locationId je varen). Fixture vrstice
  // (HQ/FIL2, test-admin) ostanejo. AuditLog se NE piše (read-only GET).
  await db.orderItem.deleteMany({ where: { orderId: { in: MY_ORDER_IDS } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: MY_ORDER_IDS } } }).catch(() => {})
  await db.wasteRecord.deleteMany({ where: { id: { in: [IDS.wSpoiled, IDS.wExpired, IDS.wReversed] } } }).catch(() => {})
  await db.guestFeedback.deleteMany({
    where: { OR: [{ id: { in: [IDS.fbNew, IDS.fbInReview, IDS.fbResolved, IDS.fbOld, NULL_PROBE_ID] } }, { comment: { contains: RUN_ID } }] },
  }).catch(() => {})
  await db.reservation.deleteMany({ where: { locationId: { in: LOC_IDS } } }).catch(() => {})
  await db.guest.deleteMany({ where: { id: IDS.guestVip } }).catch(() => {})
  await db.zReport.deleteMany({ where: { id: IDS.zReport } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: { in: [IDS.invFlour, IDS.invZero, IDS.invWasteSrc] } } }).catch(() => {})
  await db.table.deleteMany({ where: { id: IDS.tableA } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: IDS.menuItem } }).catch(() => {})
  await db.category.deleteMany({ where: { id: IDS.category } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: IDS.menu } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})
  await db.$disconnect().catch(() => {})
}, 30_000)

describe('R141 P2-28: GET /api/reports/briefing (prava PGlite)', () => {
  it('401 fail-closed brez seje; 403 fail-closed za regular usera brez dodeljene lokacije (realen resolver)', async () => {
    // (a) brez seje → requireAuth 401
    authRef.current = null
    const res401 = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res401.status).toBe(401)
    const json401 = await asJson(res401)
    expect(typeof json401.error).toBe('string')

    // (b) regular user (manager NI tenant-admin) brez lokacije → resolver
    //     fail-closed 403 (regular_user_without_location)
    authRef.current = { employeeId: `emp-${RUN_ID}`, role: 'manager', locationId: null, permissions: ['view_reports'] }
    const res403 = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res403.status).toBe(403)
    const json403 = await asJson(res403)
    expect(json403.error).toBe('Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.')
  })

  it('LJ poslovni dan čez DST prehod (P2-08 — THE ključni test): 23:30 LJ 29.3. je VČERAJ, 00:30 LJ 30.3. je DANES; obratno za date=2026-03-31', async () => {
    // Meje (DST prehod 29.3.2026 02:00 CET → 03:00 CEST, 23-urni dan):
    //   včeraj (LJ 2026-03-29) = [2026-03-28T23:00:00Z (00:00 CET), 2026-03-29T22:00:00Z (00:00 CEST naslednjega dne))
    //   (a) 23:30 LJ 29.3. = 21:30Z (CEST +2) → ZNOTRAJ včeraj
    //   (b) 00:30 LJ 30.3. = 22:30Z 29.3. → LJ dan 30.3. = ZUNAJ včeraj
    // UTC meje bi VRILE obe naročili v "včeraj" (UTC dan 29.3. vsebuje 21:30Z
    // IN 22:30Z) → revenue bi bil 41; LJ meje pomenijo TOČNO 30.
    const res = await briefingGet('?date=2026-03-30')
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const yesterday = json.yesterday as Record<string, unknown>
    const sales = yesterday.sales as Record<string, unknown>
    expect(sales.revenue).toBe(30)
    expect(sales.ordersCount).toBe(1)
    expect(sales.avgTicket).toBe(30)
    expect(sales.tips).toBe(2)
    // predvčerajšnji dan (LJ 2026-03-28) je prazen → null (nikoli izmišljen %)
    expect(sales.revenueChangePct).toBeNull()

    // Obratno: date=2026-03-31 → včeraj = LJ dan 2026-03-30
    // [22:00Z 29.3., 22:00Z 30.3.) → (b) ZNOTRAJ, (a) ZUNAJ; pct = (11-30)/30 = -63.3 %
    const res2 = await briefingGet('?date=2026-03-31')
    expect(res2.status).toBe(200)
    const json2 = await asJson(res2)
    const sales2 = (json2.yesterday as Record<string, unknown>).sales as Record<string, unknown>
    expect(sales2.revenue).toBe(11)
    expect(sales2.ordersCount).toBe(1)
    expect(sales2.tips).toBe(1)
    expect(sales2.revenueChangePct).toBe(PCT_11_VS_30)
  })

  it('Yesterday agregacija: revenue/ordersCount/avgTicket/tips/topItems (voided izključen, pravi vrstni red), ne-plačano in današnje izključeno, Z/DailyClose status po LJ day-start', async () => {
    // včeraj (LJ 2026-09-24) = [2026-09-23T22:00Z, 2026-09-24T22:00Z):
    // oY1 (total 30, tip 3) + oY2 (total 20, tip 2); oYP pending (999) in
    // oY3 (plačan DANES, 77) morata biti izključeni.
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const yesterday = json.yesterday as Record<string, unknown>
    const sales = yesterday.sales as Record<string, unknown>
    expect(sales.revenue).toBe(50)
    expect(sales.ordersCount).toBe(2)
    expect(sales.avgTicket).toBe(25)
    expect(sales.tips).toBe(5)
    // predvčerajšnji dan (LJ 2026-09-23) prazen na A → null
    expect(sales.revenueChangePct).toBeNull()

    // topItems: po SNAPSHOT imenu, voided izključen, sort po količini (tie po prihodku)
    expect(yesterday.topItems).toEqual([
      { name: 'R141 Pica margherita', quantity: 3, revenue: 30 },
      { name: 'R141 Solata', quantity: 1, revenue: 10 },
    ])

    // ZReport za včeraj obstaja (reportDate = LJ day-start 22:00Z 23.9.) → 'finalized';
    // DailyClose ni seedan → null (pošteno "ni zaključka", ne izmišljen 'none')
    expect(yesterday.zReportStatus).toBe('finalized')
    expect(yesterday.dailyCloseStatus).toBeNull()
  })

  it('Odpadki: reversiran zapis izključen, totalCost/topReasons (kanon razlogov, sort po strošku)', async () => {
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const waste = ((json.yesterday as Record<string, unknown>).waste) as Record<string, unknown>
    // SPOILED 10 + EXPIRED 5; BROKEN 99 ima reversedAt → IZKLJUČEN
    expect(waste.totalCost).toBe(15)
    expect(waste.topReasons).toEqual([
      { reason: 'SPOILED', cost: 10, count: 1 },
      { reason: 'EXPIRED', cost: 5, count: 1 },
    ])
  })

  it('Scope izolacija: lokacijska seja A + ?locationId=B → 200, locationId === A, B podatki NE uhajajo (session avtoritativna)', async () => {
    // Realen resolver: lokacijska seja (manager ali admin-z-lokacijo) je
    // avtoritativna — ?locationId se IGNORIRA (prepreči IDOR bypass), status
    // je 200 s scope-om seje, NE 403.
    const res = await briefingGet(`?date=${DATE_MAIN}&locationId=${IDS.locB}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.locationId).toBe(IDS.locA)
    // B ima v včerajšnjem oknu plačano naročilo (total 41) — NE sme prispevati
    const sales = ((json.yesterday as Record<string, unknown>).sales) as Record<string, unknown>
    expect(sales.revenue).toBe(50)
    expect(sales.ordersCount).toBe(2)
    // rezervacije: tudi B-jeva (8 oseb) NE sme šteti
    const summary = ((json.reservations as Record<string, unknown>).summary) as Record<string, unknown>
    expect(summary.confirmed).toBe(2)
    expect(summary.totalGuests).toBe(9)
  })

  it('Lokacijska seja ignorira ?locationId tudi za NEOBSTOJEČO lokacijo → podatki lokacije seje (nikoli prazen filter)', async () => {
    // Če bi resolver spoštoval ?locationId, bi neobstoječ filter vrnil PRAZNE
    // sekcije; kanon: seja je avtoritativna → podatki A so vidni.
    const res = await briefingGet(`?date=${DATE_MAIN}&locationId=${RUN_ID}-no-such-location`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.locationId).toBe(IDS.locA)
    const sales = ((json.yesterday as Record<string, unknown>).sales) as Record<string, unknown>
    expect(sales.revenue).toBe(50)
    expect(sales.ordersCount).toBe(2)
  })

  it('400 neveljaven datum: ?date=nonsense in ?date=2026-13-99 → 400 z sl sporočilom (PRED scope resolverjem)', async () => {
    const res1 = await briefingGet('?date=nonsense')
    expect(res1.status).toBe(400)
    expect((await asJson(res1)).error).toBe('Neveljaven datum (pričakovan YYYY-MM-DD).')

    const res2 = await briefingGet('?date=2026-13-99')
    expect(res2.status).toBe(400)
    expect((await asJson(res2)).error).toBe('Neveljaven datum (pričakovan YYYY-MM-DD).')
  })

  it('Rezervacije: summary (vsi statusi) + totalGuests (confirmed+seated) + upcoming (miza, notes, specialRequests, VIP soft-join) + tuja lokacija ne šteje', async () => {
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const reservations = json.reservations as Record<string, unknown>
    const summary = reservations.summary as Record<string, unknown>
    expect(summary).toEqual({ confirmed: 2, seated: 1, cancelled: 1, noShow: 1, totalGuests: 9 })

    // Upcoming: SAMO confirmed+seated, časovno naraščajoče (seated 13:00 LJ,
    // potem 19:00 LJ, 20:00 LJ); tuja rezervacija (B, 8 oseb) NE sme biti noter
    const upcoming = reservations.upcoming as Array<Record<string, unknown>>
    expect(upcoming.map((r) => r.id)).toEqual([IDS.resSeated, IDS.resConf1, IDS.resConf2])
    expect(upcoming.map((r) => r.status)).toEqual(['seated', 'confirmed', 'confirmed'])
    // miza + opombe + posebne zahteve so vidne
    expect(upcoming[1].tableNumber).toBe(12)
    expect(upcoming[1].notes).toBe(`R141 rojstni dan ${RUN_ID}`)
    expect(upcoming[1].specialRequests).toBe('Otroški stol')
    // VIP soft-join: ujemanje Guest.isVip prek telefona → SAMO boolean (brez PII)
    expect(upcoming[2].isVip).toBe(true)
    expect(upcoming[0].isVip).toBe(false)
    // PII: telefon NIKOLI ne uhaja v odgovor
    expect(JSON.stringify(upcoming)).not.toContain(VIP_PHONE)
  })

  it('Issues sekcija — ✅ POPRAVLJEN R141-b bug (najden v R141-d): unresolved števeci + oldest delujejo; DB invariant status NOT NULL (0021 → 23502) ostaja', async () => {
    // (1) DB invariant: legacy {status: null} semantika je na skladni bazi
    //     NEDOSEGLJIVA — 0021: status TEXT NOT NULL DEFAULT 'new' (backfill
    //     prek column default). Surovi INSERT z NULL statusom mora odpovedati
    //     s PG napako 23502 (not-null violation):
    let nullInsertError = ''
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "GuestFeedback" (id, "locationId", status, responded, "overallRating") VALUES ('${NULL_PROBE_ID}', NULL, NULL, false, 3)`,
      )
    } catch (error: unknown) {
      nullInsertError = String(error)
    }
    expect(nullInsertError).toMatch(/23502/)
    // odgovorna čiščba, če bi (na neskladni bazi) vseeno uspelo
    await db.guestFeedback.deleteMany({ where: { id: NULL_PROBE_ID } }).catch(() => {})

    // (2) ✅ PO POPRAVKU (R141-final): prej je `oldest` agregat nosil mrtvo
    //     OR-vejo { status: null, responded: false } BREZ lastnega catch-a →
    //     PrismaClientValidationError → cela sekcija na NEUTRAL_ISSUES.
    //     Popavek: brancha odstranjena, nerešeni set = status in
    //     ('new','in_review') + responded:false. A je dedikirana lokacija →
    //     edini vir so moja semena: fbNew + fbOld = 2 nerešena 'new',
    //     fbInReview = 1 'in_review', fbResolved ne šteje nikjer, oldest =
    //     najstarejši nerešeni createdAt (fbOld).
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const issues = json.issues as Record<string, unknown>
    const fb = issues.unresolvedFeedback as Record<string, unknown>
    expect(fb).toEqual({ new: 2, inReview: 1, oldest: FB_OLD_CREATED_AT.toISOString() })
    // pendingApprovals (isti Promise.all — sedaj deluje; lokacija A dedikirana → brez seedanih)
    expect(issues.pendingApprovals).toEqual({ dailyCloses: 0, stocktakes: 0 })
  })

  it('Globalni super-admin: 200 z locationId null, zReportStatus/dailyCloseStatus NULL (neizmišljeni) kljub obstoječemu ZReportu, revenue = A + B (prazen filter)', async () => {
    authRef.current = { employeeId: `emp-${RUN_ID}`, role: 'admin', locationId: null, permissions: ['view_reports'] }
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    // globalni scope je IZRECNO null (ne vsiljen A ali 'none')
    expect(json.locationId).toBeNull()
    const yesterday = json.yesterday as Record<string, unknown>
    // ZReport za včeraj OBSTAJA na lokaciji A, a per-(dan, lokacija) unikat
    // brez izrecne lokacije ne more odgovoriti → null (UI izriše "—")
    expect(yesterday.zReportStatus).toBeNull()
    expect(yesterday.dailyCloseStatus).toBeNull()
    // prazen filter: A (50, 2 naročili) + B (41, 1 naročilo) + morebitni tuji
    // baseline fixture naročil v istem oknu (izmerjen PRED seedom)
    const sales = yesterday.sales as Record<string, unknown>
    expect(sales.revenue).toBe(round2(baselineGlobalRevenue + 91))
    expect(sales.ordersCount).toBe(baselineGlobalCount + 3)
  })

  it('Cache-Control: no-store (osvežinski pregled, ni cache-friendly)', async () => {
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('Prazni dan (sveža lokacija C): 200, vse sekcije nevtralne ničle / prazna polja — brez 500, brez NaN, brez manjkajočih ključev', async () => {
    authRef.current = { employeeId: `emp-${RUN_ID}`, role: 'manager', locationId: IDS.locC, permissions: ['view_reports'] }
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.locationId).toBe(IDS.locC)

    const yesterday = json.yesterday as Record<string, unknown>
    expect(yesterday.sales).toEqual({ revenue: 0, ordersCount: 0, avgTicket: 0, tips: 0, revenueChangePct: null })
    expect(yesterday.topItems).toEqual([])
    expect(yesterday.waste).toEqual({ totalCost: 0, topReasons: [] })
    expect(yesterday.zReportStatus).toBeNull()
    expect(yesterday.dailyCloseStatus).toBeNull()

    const reservations = json.reservations as Record<string, unknown>
    expect(reservations.summary).toEqual({ confirmed: 0, seated: 0, cancelled: 0, noShow: 0, totalGuests: 0 })
    expect(reservations.upcoming).toEqual([])

    expect(json.staff).toEqual({ shifts: [], coverage: { scheduled: 0, confirmed: 0, byRole: {} }, pendingTimeOff: 0 })
    expect(json.inventory).toEqual({ lowStock: [], lowStockCount: 0, expiring: [], expiredCount: 0 })
    expect(json.purchasing).toEqual({ openPos: [], openCount: 0, arrivingToday: [] })
    expect(json.issues).toEqual({
      unresolvedFeedback: { new: 0, inReview: 0, oldest: null },
      pendingApprovals: { dailyCloses: 0, stocktakes: 0 },
      operational: { critical: 0, warning: 0 },
    })
    expect(json.kds).toEqual({ lateCount: 0, onTimeRate: 0, avgFiredToReadyMinutes: 0, activeTickets: 0 })

    // brez NaN / Infinity v celem telesu (JSON.stringify bi NaN zaključil kot null)
    expect(JSON.stringify(json)).not.toMatch(/NaN|Infinity/)
  })

  it('Kontraktni pin: top-level ključi TOČNO + reservations.summary ključi + interni števci inventory ne uhajajo', async () => {
    const res = await briefingGet(`?date=${DATE_MAIN}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(Object.keys(json).sort()).toEqual(
      ['date', 'generatedAt', 'inventory', 'issues', 'kds', 'locationId', 'purchasing', 'reservations', 'staff', 'yesterday'],
    )
    const reservations = json.reservations as Record<string, unknown>
    expect(Object.keys(reservations.summary as Record<string, unknown>).sort()).toEqual(
      ['cancelled', 'confirmed', 'noShow', 'seated', 'totalGuests'],
    )
    // odmev zahtevka: date = podani LJ poslovni dan, generatedAt = ISO žig
    expect(json.date).toBe(DATE_MAIN)
    expect(typeof json.generatedAt).toBe('string')
    expect(Number.isNaN(new Date(json.generatedAt as string).getTime())).toBe(false)

    // inventory: kontraktna polja + nizka zaloga A (critical prej, nato low)
    const inventory = json.inventory as Record<string, unknown>
    expect(Object.keys(inventory).sort()).toEqual(['expiredCount', 'expiring', 'lowStock', 'lowStockCount'])
    expect(inventory.lowStockCount).toBe(2)
    const lowStock = inventory.lowStock as Array<Record<string, unknown>>
    expect(lowStock.map((i) => i.status)).toEqual(['critical', 'low'])
    expect(lowStock[0]).toMatchObject({ name: `R141 Trska ${RUN_ID}`, quantity: 0, minQuantity: 5, unit: 'kg' })
    expect(lowStock[1]).toMatchObject({ name: `R141 Moka ${RUN_ID}`, quantity: 4, minQuantity: 20 })
    // issues.operational: kritična zaloga (1) + pretečene serije (0) — izpeljano
    // iz inventarne sekcije; _criticalCount/_expiringTotal se NE uhajajo
    const issues = json.issues as Record<string, unknown>
    expect(issues.operational).toEqual({ critical: 1, warning: 0 })
    expect(Object.keys(inventory)).not.toContain('_criticalCount')
    expect(Object.keys(inventory)).not.toContain('_expiringTotal')
  })
})
