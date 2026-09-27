// @vitest-environment node
// ============================================
// R145 / EPIC #115 #32 — INTEGRACIJA: TIPS / TIP POOL
// (payout state machine + audit trail + scope/zero-oracle + hash chain)
// ============================================
// Prava PGlite (IT DB, PGLITE_DATA_DIR=/tmp/pglite-data-it iz
// vitest.config.integration.ts; fileParallelism: false). R145 je ZERO
// migration → IT DB ne rabi migracij.
//
// Kontrakt (R145-a + R145-b, kot IMPLEMENTIRANO):
//   POST /api/tip-pool (manage_employees, requireLocationScope gate):
//     generate za dan → pool status 'pending' + distribucije prek
//     createTipDistributionWithChain + audit TIP_POOL_GENERATED V TX
//     (details {date, distributionMethod, totalTips, cashTips, cardTips,
//     employeeCount, locationId} — NIKOLI per-employee imena/telefoni/emaili);
//     obstoječ pool 'paid' za ta dan → 400 'Tip pool za ta dan je že izplačan'.
//   PUT /api/tip-pool (redistribucija): scope → 404 zero-oracle; paid → 400;
//     deleteMany + chain-recreate (status 'pending') + pool 'distributed' +
//     audit 'tip_pool_distributed' V TX (entityType 'tip_pool', BREZ entityId
//     — pin dejanske oblike), Serializable + P2034 → 409.
//   POST /api/tip-pool/[id]/payout (NOVO R145-b): state machine — payout
//     dovoljen IZKLJUČNO iz 'distributed' (pending → 400 'Distribucija še ni
//     shranjena'; approved → 400 dormant; paid → 409 'Tip pool je že izplačan');
//     zero-oracle: nonexistent ≡ out-of-scope → OBE 404 { error: 'Tipski
//     bazen ni najden' } (notInScopeResponse); chain-safe payout: deleteMany +
//     createTipDistributionWithChain(status 'paid') + paidAt-only updateMany
//     (paidAt NI del hash payloada → chain-varen; status JE del payloada →
//     updateMany status-flip bi pustil star hash — zato recreate, nikoli flip);
//     pool 'paid' + audit TIP_POOL_PAID V TX (details {tipPoolId, date,
//     totalTips, distributionCount, paidBy} — counters/amounts SAMO);
//     odgovor = poln pool + DODATNO payoutSummary { distributionCount,
//     totalPaid } (aditivno, ne lomi UI kontrakta). Cache-Control na payoutu NI
//     implementiran (samo GET ima no-store) — Dokumentirano, ne pinano.
//
// MODEL A (R143/R144 lekcija — OBVEZNE ročne seje):
//   (1) admin Z lokacijo A (role 'admin' → hasPermission vedno true);
//   (2) super-admin BREZ lokacije (role 'super_admin', null locationId) —
//       resolveTenantLocationIdOrThrow → scope null → cross-lokacijski nadzor
//       ( payout tujega poola USPE — pinano); ⚠ hasPermission NIMA
//       special-case-a za 'super_admin' → permissions array MORA nositi
//       'manage_employees' (r144 vzorec: ekspliciten seznam);
//   (3) take_orders (403 tarča — realen hasPermission na meji).
//
// SEED STRATEGIJA (r142/r143/r144 kanon): 2 dedikirani lokaciji (A/B) z
//   RUN_ID markerji; zaposlena 2 (unikaten email + pin); StaffShift ×2 na dan
//   generacije; Order→Check→Payment ×3 (tips 100 = cash 40 + card 60) direktno
//   prek Prisme. TipPool NIMA unique constrainta na (date, locationId) — dedup
//   je samo findFirst v POST handlerju → datumi so VSAKERUN ID-shiftani
//   (DAY_OFF iz RUN_ID) za obrambo pred ostanki strmoglavljenih runov, lokacije
//   pa so vseeno RUN_ID-dedikirane. TipDistribution vrstice nastajajo IZKLJUČNO
//   prek createTipDistributionWithChain (hash veriga EU 852/2004 — nikoli
//   createMany). Pool statusi: pending / distributed / approved (dormant) /
//   paid / tuja lokacija B / super-admin tarča na B.
//
// HASH CHAIN VERIFIKACIJA (pomembno!): verifyTipDistributionChainIntegrity je
//   PRE-AFTER pokvarjen (R145-b najdba: recompute uporablja amount.toString()
//   namesto toFixed(2) IN entry.createdAt namesto creation-time now() —
//   dateIso komponenta payloada se NE shrani → EXACT recompute iz DB polj ni
//   možen). Zato testi ne uporabljajo tega helperja, ampak pinajo CHAIN
//   MEHANIKO direktno: previousHash→chainHash vezava (par + deterministični
//   lokalni rep prek "nereferencirane vrstice" — ne orderBy createdAt, ki je
//   pri enako-milisekundnih zapisih nedoločen), 64-hex format, vezava čez
//   delete+recreate mejo (row0.previousHash == EXACT rep pred payoutom) in
//   dokaz recreate-mehanike (stari id-ji izginijo, novi imajo status 'paid').
//   Veriga je GLOBALNA čez vse poole (helper bere zadnjo vrstico cele tabele)
//   → testi zgradijo deterministično verigo skozi celoten run:
//   seed → t-payout(poolDist) → t-generate → t-PUT(poolPending) → t-payout
//   (poolSuper) — vsak korak veže row0.previousHash na EXACT rep prejšnjega.
//
// AUDIT ČIŠČENJE (r144-d pravilo): ta datoteka piše 4 AuditLog vrstice
//   (TIP_POOL_GENERATED ×1, tip_pool_distributed ×1, TIP_POOL_PAID ×2) v
//   produkcijsko AuditLog hash verigo. afterAll briše SAMO svoje
//   (userId = emp-RUN_ID ALI entityId ∈ moji pool id-ji) KOT PRVE, nato
//   EMPIRIČNO verificira chain kontinuiteto (rep po čiščenju == rep pred
//   zagonom) + 0 ostankov po vseh tabelah. Datoteka teče ZADNJA po abecedi
//   (r145 > r144 > r143 > r142; fileParallelism: false) → veriga se vrne v
//   stanje pred zagonom.
//
// RATE LIMIT BUDŽET: bucket 'tip-pool' (AUTHENTICATED_LIMIT 120/min/IP) je
//   SKUPEN za GET/POST/PUT/payout od R145-b — ta datoteka porabi ~18 klicev
//   (7 payout + 3 POST + 2 PUT + 3 GET + 2×401/403 + 1 regeneracija) — varno
//   pod mejo. 429 pot NI testirana v integraciji (unit r145-b kanon).
//
// Zagon: bunx vitest run tests/integration/r145-tips.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

// ISTI vzorec kot r143/r144 (najnovejši kanon): realen auth-middleware
// (importOriginal spread — resolveTenantLocationId/tenantScopeToWhere ostanejo
// REALENI), samo requireAuth nadomesti z ročno konstruirano PIN sejo; mock
// UPORABI realen hasPermission (iz auth-middleware/permissions) za
// opts.permission gate, da je 403 kanon 1:1 z realnim middleware telesom.
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
import { GET as tipPoolGET, POST as tipPoolPOST, PUT as tipPoolPUT } from '@/app/api/tip-pool/route'
import { POST as tipPayoutPOST } from '@/app/api/tip-pool/[id]/payout/route'
import { createTipDistributionWithChain } from '@/lib/tip-distribution-chain'

const RUN_ID = `r145-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const EMP_ID = `emp-${RUN_ID}`

// ---------- Datumi: RUN_ID-shiftani dnevi (TipPool NIMA unique(date,loc) —
// obramba pred ostanki strmoglavljenih runov; lokacije so vseeno RUN_ID-dedikirane)
const rawOff = parseInt(RUN_ID.slice(-6), 36)
const DAY_OFF = (Number.isNaN(rawOff) ? 42 : rawOff) % 500
const dayOf = (i: number): Date => new Date(2030, 2, 1 + DAY_OFF + i) // lokalna polnoč
const localNoon = (i: number): Date => new Date(2030, 2, 1 + DAY_OFF + i, 12, 0, 0)
const pad2 = (n: number): string => String(n).padStart(2, '0')
// ?date= param z T12:00:00 (lokalni čas) — route dela new Date(param) →
// lokalne komponente → lokalna polnoč istega dne NEODVISNO od TZ peskovnika
const dateParam = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T12:00:00`

// Dan-generacije = 5; pooli: dist=1, pending=2, paid=3, B=4, super=6, approved=7, prazen dan=9

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  emp1: `${RUN_ID}-emp-1`,
  emp2: `${RUN_ID}-emp-2`,
  shift1: `${RUN_ID}-shift-1`,
  shift2: `${RUN_ID}-shift-2`,
  ord1: `${RUN_ID}-ord-1`,
  chk1: `${RUN_ID}-chk-1`,
  pay1: `${RUN_ID}-pay-1`,
  pay2: `${RUN_ID}-pay-2`,
  pay3: `${RUN_ID}-pay-3`,
  poolDist: `${RUN_ID}-pool-dist`,
  poolPending: `${RUN_ID}-pool-pending`,
  poolPaid: `${RUN_ID}-pool-paid`,
  poolApproved: `${RUN_ID}-pool-approved`,
  poolB: `${RUN_ID}-pool-b`,
  poolSuper: `${RUN_ID}-pool-super`,
  // neobstoječ id (zero-oracle)
  missing: `${RUN_ID}-pool-ne-obstaja`,
}

const LOC_IDS = [IDS.locA, IDS.locB]
const EMP_IDS = [IDS.emp1, IDS.emp2]
const SHIFT_IDS = [IDS.shift1, IDS.shift2]
const ORDER_IDS = [IDS.ord1]
const PAY_IDS = [IDS.pay1, IDS.pay2, IDS.pay3]

const EMP1_NAME = `Delavec Prvi ${RUN_ID}`
const EMP2_NAME = `Delavec Drugi ${RUN_ID}`
const TUJEC1_NAME = `Tujec Prvi ${RUN_ID}`
const TUJEC2_NAME = `Tujec Drugi ${RUN_ID}`
// PII markerji, ki NIKOLI ne smejo uhajati v audit details (names/email/phone)
const PII_TOKENS = ['Delavec Prvi', 'Delavec Drugi', 'Tujec Prvi', 'Tujec Drugi', '@', '061-']

const LOC_A_NAME = `R145 Glavna ${RUN_ID}`
const LOC_B_NAME = `R145 Filiala ${RUN_ID}`

// ---------- Response shape kontrakti (EXACT implemented shape) ----------
// GET/POST/PUT/payout vračajo POLNE vrstice (whitelist je bil DEFERRED — R145-b
// deviation 6); GET je BARE ARRAY (UI TipManager bere data[0]).
const POOL_KEYS = ['cardTips', 'createdAt', 'cashTips', 'distributionMethod', 'distributions', 'date', 'id', 'locationId', 'shiftId', 'status', 'totalTips', 'updatedAt'].sort()
const DIST_KEYS = ['amount', 'chainHash', 'createdAt', 'employeeId', 'employeeName', 'hoursWorked', 'id', 'paidAt', 'points', 'previousHash', 'status', 'tipPoolId'].sort()
const PAYOUT_KEYS = [...POOL_KEYS, 'payoutSummary'].sort()

// ---------- Čiščenje: zbrani id-ji + veriga repov (deterministična potovalna knjiga) ----------
const SEED_DIST_IDS: Record<'poolDist' | 'poolPending' | 'poolB' | 'poolSuper', string[]> = {
  poolDist: [],
  poolPending: [],
  poolB: [],
  poolSuper: [],
}
const generatedPoolIds: string[] = []
let auditTailBefore: string | null = null // AuditLog rep PRED zagonom (chain kontinuiteta)
let seedTailHash: string | null = null // globalni TipDistribution rep po seedom
let poolDistTailHash: string | null = null // rep po payoutu poolDist (t1)
let generatedTailHash: string | null = null // rep po generaciji (t8)
let poolPendingTailHash: string | null = null // rep po PUT redistribuciji (t9)

// ---------- Pomožniki ----------
async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

async function asJsonArray(res: Response): Promise<Array<Record<string, unknown>>> {
  return (await res.json()) as Array<Record<string, unknown>>
}

function tipGet(query = ''): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return tipPoolGET(new Request(`http://localhost/api/tip-pool${query}`))
}

function tipPost(body: unknown): Promise<Response> {
  return tipPoolPOST(
    new Request('http://localhost/api/tip-pool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function tipPut(body: unknown): Promise<Response> {
  return tipPoolPUT(
    new NextRequest('http://localhost/api/tip-pool', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function payoutPost(id: string): Promise<Response> {
  // POST /api/tip-pool/[id]/payout — BREZ bodyja (UI kontrakt R145-c)
  return tipPayoutPOST(new Request(`http://localhost/api/tip-pool/${id}/payout`, { method: 'POST' }), {
    params: Promise.resolve({ id }), // Next 16: params je Promise
  })
}

function setSession(role: string, locationId: string | null, permissions: string[]) {
  authRef.current = { employeeId: EMP_ID, role, locationId, permissions }
}

interface MyAuditRow extends Record<string, unknown> {
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  locationId: string | null
  details: string
  detailsParsed: Record<string, unknown>
}

/** Forenzični bralec mojih audit vrstic (details je JSON string v DB → parse).
 *  Vse moje vrstice nosijo userId = EMP_ID (session.employeeId). */
async function myAuditRows(entityId?: string): Promise<MyAuditRow[]> {
  const rows = await db.auditLog.findMany({
    where: entityId ? { entityId, userId: EMP_ID } : { userId: EMP_ID },
  })
  return rows.map((r) => ({ ...r, detailsParsed: JSON.parse(r.details) as Record<string, unknown> }))
}

/** Forenzični bralec po akciji (put-handlerjev 'tip_pool_distributed' NIMA
 *  entityId → query po userId + action). */
async function myAuditRowsByAction(action: string): Promise<MyAuditRow[]> {
  const rows = await db.auditLog.findMany({ where: { userId: EMP_ID, action } })
  return rows.map((r) => ({ ...r, detailsParsed: JSON.parse(r.details) as Record<string, unknown> }))
}

interface ChainRowLite {
  id: string
  chainHash: string
  previousHash: string
}

/** Determinističen lokalni rep verige poola: vrstica, na katero NOBENA druga
 *  vrstica istega poola ne referencira prek previousHash. Za 2-vrstične poole
 *  enoznačno — namerno BREZ orderBy createdAt (enako-milisekundni zapisi so
 *  nedoločno urejeni). */
function localTailHash(rows: ChainRowLite[]): string {
  const referenced = new Set(rows.map((r) => r.previousHash))
  const tails = rows.filter((r) => !referenced.has(r.chainHash))
  expect(tails).toHaveLength(1)
  const tail = tails[0]
  if (!tail) throw new Error('localTailHash: rep verige ni najden')
  return tail.chainHash
}

/** Poišče par (prva, druga) vrstic: prva se veže na expectedPrev, druga na prvo
 *  — vezava čez delete+recreate mejo brez zanašanja na createdAt ordering. */
function linkedPair(
  rows: ChainRowLite[],
  expectedPrev: string | null,
): { first: ChainRowLite; second: ChainRowLite } {
  const first = rows.find((r) => r.previousHash === expectedPrev)
  expect(first).toBeTruthy()
  if (!first) throw new Error('linkedPair: prva vrstica (vez na prejšnji rep) ni najdena')
  const second = rows.find((r) => r.id !== first.id && r.previousHash === first.chainHash)
  expect(second).toBeTruthy()
  if (!second) throw new Error('linkedPair: druga vrstica (vez na prvo) ni najdena')
  return { first, second }
}

beforeAll(async () => {
  // 0) AuditLog rep PRED zagonom (seedom NE piše auditov — čist baseline za
  //    chain-kontinuiteto preverjanje v afterAll, r144-d pravilo)
  const tailRow = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  auditTailBefore = tailRow?.chainHash ?? null

  // 1) Dve dedikirani lokaciji (A = delavnica, B = tuja)
  await db.location.create({ data: { id: IDS.locA, code: `${RUN_ID}-A`, name: LOC_A_NAME, premisesId: `${RUN_ID}-pA`, isActive: true } })
  await db.location.create({ data: { id: IDS.locB, code: `${RUN_ID}-B`, name: LOC_B_NAME, premisesId: `${RUN_ID}-pB`, isActive: true } })

  // 2) Zaposlena 2 (unikaten email + pin — @unique omejiti)
  await db.employee.create({ data: { id: IDS.emp1, name: EMP1_NAME, email: `r145-${RUN_ID}-1@test.local`, pin: `pin-${RUN_ID}-1`, role: 'staff', locationId: IDS.locA } })
  await db.employee.create({ data: { id: IDS.emp2, name: EMP2_NAME, email: `r145-${RUN_ID}-2@test.local`, pin: `pin-${RUN_ID}-2`, role: 'staff', locationId: IDS.locA } })

  // 3) Izmene za dan generacije (completed, 8h, lokacija A)
  await db.staffShift.create({ data: { id: IDS.shift1, employeeId: IDS.emp1, shiftDate: localNoon(5), startTime: '09:00', endTime: '17:00', locationId: IDS.locA, status: 'completed', role: 'server' } })
  await db.staffShift.create({ data: { id: IDS.shift2, employeeId: IDS.emp2, shiftDate: localNoon(5), startTime: '09:00', endTime: '17:00', locationId: IDS.locA, status: 'completed', role: 'server' } })

  // 4) Plačila z napitninami za dan generacije: 100 skupaj = 40 cash + 60 card
  await db.order.create({ data: { id: IDS.ord1, orderNumber: 1, locationId: IDS.locA, status: 'completed', paymentStatus: 'paid' } })
  await db.check.create({ data: { id: IDS.chk1, orderId: IDS.ord1, checkNumber: 1, total: 300, paymentStatus: 'paid' } })
  await db.payment.create({ data: { id: IDS.pay1, checkId: IDS.chk1, amount: 100, tipAmount: 40, type: 'cash', status: 'completed', createdAt: localNoon(5) } })
  await db.payment.create({ data: { id: IDS.pay2, checkId: IDS.chk1, amount: 100, tipAmount: 35, type: 'card', status: 'completed', createdAt: localNoon(5) } })
  await db.payment.create({ data: { id: IDS.pay3, checkId: IDS.chk1, amount: 100, tipAmount: 25, type: 'card', status: 'completed', createdAt: localNoon(5) } })

  // 5) Pooli v VSEH state machine stanjih + distribucije IZKLJUČNO prek chain
  //    helperja (hash veriga od prve vrstice; globalna veriga = seed vrstni red)
  await db.tipPool.create({ data: { id: IDS.poolDist, date: dayOf(1), locationId: IDS.locA, status: 'distributed', distributionMethod: 'equal', totalTips: 100, cashTips: 40, cardTips: 60 } })
  SEED_DIST_IDS.poolDist.push(
    ...(await createTipDistributionWithChain([
      { tipPoolId: IDS.poolDist, employeeId: IDS.emp1, employeeName: EMP1_NAME, hoursWorked: 8, points: 1, amount: 60, status: 'pending' },
      { tipPoolId: IDS.poolDist, employeeId: IDS.emp2, employeeName: EMP2_NAME, hoursWorked: 8, points: 1, amount: 40, status: 'pending' },
    ])),
  )

  await db.tipPool.create({ data: { id: IDS.poolPending, date: dayOf(2), locationId: IDS.locA, status: 'pending', distributionMethod: 'equal', totalTips: 100, cashTips: 40, cardTips: 60 } })
  SEED_DIST_IDS.poolPending.push(
    ...(await createTipDistributionWithChain([
      { tipPoolId: IDS.poolPending, employeeId: IDS.emp1, employeeName: EMP1_NAME, hoursWorked: 8, points: 1, amount: 50, status: 'pending' },
      { tipPoolId: IDS.poolPending, employeeId: IDS.emp2, employeeName: EMP2_NAME, hoursWorked: 8, points: 1, amount: 50, status: 'pending' },
    ])),
  )

  await db.tipPool.create({ data: { id: IDS.poolPaid, date: dayOf(3), locationId: IDS.locA, status: 'paid', distributionMethod: 'equal', totalTips: 80, cashTips: 30, cardTips: 50 } })
  // brez distribucij — 409 guard se zgodi PRED tx (deterministično prazno stanje)

  await db.tipPool.create({ data: { id: IDS.poolB, date: dayOf(4), locationId: IDS.locB, status: 'distributed', distributionMethod: 'equal', totalTips: 70, cashTips: 30, cardTips: 40 } })
  SEED_DIST_IDS.poolB.push(
    ...(await createTipDistributionWithChain([
      { tipPoolId: IDS.poolB, employeeId: IDS.emp1, employeeName: TUJEC1_NAME, hoursWorked: 8, points: 1, amount: 30, status: 'pending' },
      { tipPoolId: IDS.poolB, employeeId: IDS.emp2, employeeName: TUJEC2_NAME, hoursWorked: 8, points: 1, amount: 40, status: 'pending' },
    ])),
  )

  await db.tipPool.create({ data: { id: IDS.poolSuper, date: dayOf(6), locationId: IDS.locB, status: 'distributed', distributionMethod: 'equal', totalTips: 90, cashTips: 50, cardTips: 40 } })
  SEED_DIST_IDS.poolSuper.push(
    ...(await createTipDistributionWithChain([
      { tipPoolId: IDS.poolSuper, employeeId: IDS.emp1, employeeName: TUJEC1_NAME, hoursWorked: 8, points: 1, amount: 50, status: 'pending' },
      { tipPoolId: IDS.poolSuper, employeeId: IDS.emp2, employeeName: TUJEC2_NAME, hoursWorked: 8, points: 1, amount: 40, status: 'pending' },
    ])),
  )

  await db.tipPool.create({ data: { id: IDS.poolApproved, date: dayOf(7), locationId: IDS.locA, status: 'approved', distributionMethod: 'equal', totalTips: 66, cashTips: 26, cardTips: 40 } })
  // brez distribucij — 'approved' je DORMANT (nič v codebase ne piše tega statusa;
  // 400 guard se zgodi PRED tx)

  // 6) Globalni TipDistribution rep po seedom = chainHash ZADNJE seeded vrstice
  //    (deterministično — createTipDistributionWithChain vezže vsako novo vrstico
  //    na trenutni rep cele tabele; t1 je prvi pisec v tem runu)
  const lastSeeded = await db.tipDistribution.findUnique({ where: { id: SEED_DIST_IDS.poolSuper[1] ?? '' } })
  seedTailHash = lastSeeded?.chainHash ?? null
  expect(seedTailHash).toBeTruthy()
}, 60_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  setSession('admin', IDS.locA, ['admin'])
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (r142-d/r144-d pravilo):
  //   1) AUDIT vrstice PRVE (4 vrstice v produkcijski AuditLog hash verigi —
  //      brišem po userId/entityId; datoteka teče ZADNJA po abecedi +
  //      fileParallelism false → veriga se vrne v stanje pred zagonom),
  //   2) TipDistribution (FK Cascade na TipPool — eksplicitno belt&braces),
  //   3) TipPool (id-in + RUN_ID-generated),
  //   4) Payment → Check → Order (Payment.check Restrict → plačila prej),
  //   5) StaffShift (Employee FK Restrict → izmene prej), Employee,
  //   6) lokacije.
  // Nato EMPIRIČNA verifikacija: AuditLog chain kontinuiteta (rep po čiščenju ==
  // rep pred zagonom) + 0 ostankov po vseh tabelah (r144-d read-only probe
  // vzorec, tokrat IN afterAll).
  const generatedIds = [IDS.poolDist, IDS.poolPending, IDS.poolPaid, IDS.poolApproved, IDS.poolB, IDS.poolSuper, ...generatedPoolIds]
  const auditEntityIds = [...generatedIds, ...Object.values(SEED_DIST_IDS).flat()]
  const auditWhere = { OR: [{ userId: EMP_ID }, { entityId: { in: auditEntityIds } }] }

  await db.auditLog.deleteMany({ where: auditWhere }).catch(() => {})
  await db.tipDistribution.deleteMany({ where: { tipPoolId: { in: generatedIds } } }).catch(() => {})
  await db.tipPool.deleteMany({ where: { id: { in: generatedIds } } }).catch(() => {})
  await db.payment.deleteMany({ where: { id: { in: PAY_IDS } } }).catch(() => {})
  await db.check.deleteMany({ where: { orderId: { in: ORDER_IDS } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: ORDER_IDS } } }).catch(() => {})
  await db.staffShift.deleteMany({ where: { id: { in: SHIFT_IDS } } }).catch(() => {})
  await db.employee.deleteMany({ where: { OR: [{ id: { in: EMP_IDS } }, { email: { contains: RUN_ID } }] } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})

  // --- EMPIRIČNA VERIFIKACIJA ČIŠČENJA ---
  // AuditLog hash veriga: rep PO čiščenju == rep PRED zagonom (moje 4 vrstice
  // so edine, ki jih je ta run dodal; datoteka je zadnja po abecedi)
  const tailAfter = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  expect(tailAfter?.chainHash ?? null).toBe(auditTailBefore)
  // 0 ostankov po vseh mojih RUN_ID markerjih
  expect(await db.auditLog.count({ where: auditWhere })).toBe(0)
  expect(await db.tipDistribution.count({ where: { tipPoolId: { in: generatedIds } } })).toBe(0)
  expect(await db.tipPool.count({ where: { id: { in: generatedIds } } })).toBe(0)
  expect(await db.payment.count({ where: { id: { in: PAY_IDS } } })).toBe(0)
  expect(await db.check.count({ where: { orderId: { in: ORDER_IDS } } })).toBe(0)
  expect(await db.order.count({ where: { id: { in: ORDER_IDS } } })).toBe(0)
  expect(await db.staffShift.count({ where: { id: { in: SHIFT_IDS } } })).toBe(0)
  expect(await db.employee.count({ where: { email: { contains: RUN_ID } } })).toBe(0)
  expect(await db.location.count({ where: { id: { in: LOC_IDS } } })).toBe(0)
  await db.$disconnect().catch(() => {})
}, 60_000)

// ============================================
// 1) PAYOUT STATE MACHINE — samo 'distributed' gre naprej (R145-b)
// ============================================
describe('R145 #32: payout state machine na pravi PGlite', () => {
  it('payout na distributed poolu → 200: pool paid, vse distribucije paid + paidAt, payoutSummary { distributionCount 2, totalPaid 100 } točno proti seeded zneskom; stari id-ji IZGINJO (recreate mehanika)', async () => {
    const t0 = Date.now()
    // rep verige PRED payoutom = seed rep (t1 je prvi pisec TipDistribution v runu)
    expect(seedTailHash).toBeTruthy()

    const res = await payoutPost(IDS.poolDist)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.id).toBe(IDS.poolDist)
    expect(body.status).toBe('paid')
    expect(Object.keys(body).sort()).toEqual(PAYOUT_KEYS) // poln pool + aditivni povzetek
    expect(body.payoutSummary).toEqual({ distributionCount: 2, totalPaid: 100 })

    const dists = body.distributions as Array<Record<string, unknown>>
    expect(dists).toHaveLength(2)
    for (const d of dists) {
      expect(Object.keys(d).sort()).toEqual(DIST_KEYS)
      expect(d.status).toBe('paid')
      expect(typeof d.paidAt).toBe('string')
      expect(d.tipPoolId).toBe(IDS.poolDist)
      const paidAtMs = new Date(d.paidAt as string).getTime()
      expect(paidAtMs).toBeGreaterThanOrEqual(t0 - 1000)
      expect(paidAtMs).toBeLessThanOrEqual(Date.now() + 1000)
    }
    expect(dists.map((d) => d.amount as number).sort((a, b) => a - b)).toEqual([40, 60])
    expect(new Set(dists.map((d) => d.employeeName))).toEqual(new Set([EMP1_NAME, EMP2_NAME]))

    // DB: pool paid; stari id-ji gone (deleteMany + recreate — nikoli status flip)
    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolDist } })
    expect(dbPool?.status).toBe('paid')
    for (const oldId of SEED_DIST_IDS.poolDist) {
      expect(await db.tipDistribution.findUnique({ where: { id: oldId } })).toBeNull()
    }
    const dbRows = await db.tipDistribution.findMany({ where: { tipPoolId: IDS.poolDist } })
    expect(new Set(dbRows.map((r) => r.id))).not.toEqual(new Set(SEED_DIST_IDS.poolDist))

    // determinističen lokalni rep po payoutu (za vezavo naslednjega pisca, t8)
    poolDistTailHash = localTailHash(dbRows)
  })

  it('payout na pending poolu → 400 { error: "Distribucija še ni shranjena" } EXACT; pool + distribucije nedotaknjene', async () => {
    const res = await payoutPost(IDS.poolPending)
    expect(res.status).toBe(400)
    expect(await asJson(res)).toEqual({ error: 'Distribucija še ni shranjena' })

    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolPending } })
    expect(dbPool?.status).toBe('pending')
    expect(await db.tipDistribution.count({ where: { tipPoolId: IDS.poolPending } })).toBe(2)
  })

  it('payout na approved poolu → ISTI 400 (dormant status: nič v codebase ne piše approved; ena konstanta za razširitev, ko se approve kdaj uvede)', async () => {
    const res = await payoutPost(IDS.poolApproved)
    expect(res.status).toBe(400)
    expect(await asJson(res)).toEqual({ error: 'Distribucija še ni shranjena' })

    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolApproved } })
    expect(dbPool?.status).toBe('approved')
  })

  it('payout na že paid poolu → 409 { error: "Tip pool je že izplačan" } EXACT idempotenčni guard; pool ostane nespremenjen', async () => {
    const res = await payoutPost(IDS.poolPaid)
    expect(res.status).toBe(409)
    expect(await asJson(res)).toEqual({ error: 'Tip pool je že izplačan' })

    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolPaid } })
    expect(dbPool?.status).toBe('paid')
    expect(await db.tipDistribution.count({ where: { tipPoolId: IDS.poolPaid } })).toBe(0)
  })

  it('payout DVAKRAT (race semantika): drugi klic → 409 EXACT isti guard; distribucije ostanejo točno 2 paid', async () => {
    const res = await payoutPost(IDS.poolDist) // prvi klic je že uspel v t1
    expect(res.status).toBe(409)
    expect(await asJson(res)).toEqual({ error: 'Tip pool je že izplačan' })

    expect(await db.tipDistribution.count({ where: { tipPoolId: IDS.poolDist, status: 'paid' } })).toBe(2)
    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolDist } })
    expect(dbPool?.status).toBe('paid')
  })

  it('401 brez seje + take_orders seja → 403 { error: "Nimate dovoljenja za to operacijo." } (realen hasPermission manage_employees kanon) — zero pisnih sledi', async () => {
    authRef.current = null
    const res401 = await payoutPost(IDS.poolDist)
    expect(res401.status).toBe(401)
    expect(typeof (await asJson(res401)).error).toBe('string')

    setSession('take_orders', IDS.locA, ['take_orders'])
    const res403 = await payoutPost(IDS.poolDist)
    expect(res403.status).toBe(403)
    expect(await asJson(res403)).toEqual({ error: 'Nimate dovoljenja za to operacijo.' })

    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolDist } })
    expect(dbPool?.status).toBe('paid') // 401/403 ne pišejo
  })

  it('POST regeneracija za dan že izplačanega poola → 400 { error: "Tip pool za ta dan je že izplačan" } EXACT (route pre-check pred fetchDayPayments)', async () => {
    const res = await tipPost({ date: dateParam(dayOf(1)), distributionMethod: 'equal' })
    expect(res.status).toBe(400)
    expect(await asJson(res)).toEqual({ error: 'Tip pool za ta dan je že izplačan' })
  })
})

// ============================================
// 2) AUDIT TRAIL — TIP_POOL_GENERATED / tip_pool_distributed / TIP_POOL_PAID
// ============================================
describe('R145 #32: audit trail na pravi PGlite (in-tx kanon)', () => {
  it('POST generacija za dan s plačili+izmenami → 201 + pool pending + TIP_POOL_GENERATED z EXACT details (counters/amounts) + PII sweep (nikoli imena/email/telefon)', async () => {
    const res = await tipPost({ date: dateParam(dayOf(5)), distributionMethod: 'equal' })
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const newId = body.id as string
    expect(typeof newId).toBe('string')
    generatedPoolIds.push(newId)

    // Round-trip: 100 tips = 40 cash + 60 card; equal split 50/50 (zaokroževalna
    // razlika 0); status pending; lokacija ŽIGOSANA iz seje (admin A)
    expect(body.status).toBe('pending')
    expect(body.distributionMethod).toBe('equal')
    expect(body.totalTips).toBe(100)
    expect(body.cashTips).toBe(40)
    expect(body.cardTips).toBe(60)
    expect(body.locationId).toBe(IDS.locA)
    expect(body.date).toBe(dayOf(5).toISOString())
    expect(typeof body.totalTips).toBe('number') // deepToNumbers kanon
    const dists = body.distributions as Array<Record<string, unknown>>
    expect(dists).toHaveLength(2)
    for (const d of dists) {
      expect(Object.keys(d).sort()).toEqual(DIST_KEYS)
      expect(d.amount).toBe(50)
      expect(d.hoursWorked).toBe(8)
      expect(d.points).toBe(1)
      expect(d.status).toBe('pending')
      expect(String(d.chainHash)).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(new Set(dists.map((d) => d.employeeName))).toEqual(new Set([EMP1_NAME, EMP2_NAME]))

    // AuditLog: TOČNO 1 TIP_POOL_GENERATED, EXACT details (counters/amounts SAMO)
    const rows = await myAuditRows(newId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('TIP_POOL_GENERATED')
    expect(rows[0]?.entityType).toBe('TipPool')
    expect(rows[0]?.userId).toBe(EMP_ID)
    expect(rows[0]?.locationId).toBe(IDS.locA) // R81: ekspliciten locationId zmaga
    expect(rows[0]?.detailsParsed).toEqual({
      date: dayOf(5).toISOString(),
      distributionMethod: 'equal',
      totalTips: 100,
      cashTips: 40,
      cardTips: 60,
      employeeCount: 2,
      locationId: IDS.locA,
    })
    // PII kanon: NIKOLI per-employee imena / email / telefon v details
    const raw = String(rows[0]?.details)
    for (const token of PII_TOKENS) expect(raw).not.toContain(token)

    // determinističen lokalni rep po generaciji (za vezavo t9)
    generatedTailHash = localTailHash(dists as unknown as ChainRowLite[])
  })

  it('PUT redistribucija pending poola → 200 + pool distributed + rows recreated (stari gone) + tip_pool_distributed audit (entityType tip_pool, BREZ entityId — pin dejanske oblike) + vezava na rep po generaciji', async () => {
    const res = await tipPut({
      tipPoolId: IDS.poolPending,
      distributions: [
        { employeeId: IDS.emp1, employeeName: EMP1_NAME, hoursWorked: 8, points: 1, amount: 70 },
        { employeeId: IDS.emp2, employeeName: EMP2_NAME, hoursWorked: 8, points: 1, amount: 30 },
      ],
    })
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.id).toBe(IDS.poolPending)
    expect(body.status).toBe('distributed')
    const dists = body.distributions as Array<Record<string, unknown>>
    expect(dists).toHaveLength(2)
    expect(dists.map((d) => d.amount as number).sort((a, b) => a - b)).toEqual([30, 70])
    for (const d of dists) expect(d.status).toBe('pending')

    // recreate mehanika: seeded vrstice poolPending so GONE
    for (const oldId of SEED_DIST_IDS.poolPending) {
      expect(await db.tipDistribution.findUnique({ where: { id: oldId } })).toBeNull()
    }
    const dbRows = await db.tipDistribution.findMany({ where: { tipPoolId: IDS.poolPending } })
    const { first, second } = linkedPair(dbRows, generatedTailHash)
    expect(new Set([first.id, second.id])).toEqual(new Set(dbRows.map((r) => r.id)))
    poolPendingTailHash = localTailHash(dbRows)

    // Audit 'tip_pool_distributed' (put-handler kanon — lowercase, entityType
    // 'tip_pool', details.totalTips je Decimal → JSON string; userId EMP_ID,
    // locationId avtomatisko izpeljan → null (EMP_ID ni Employee v DB — R81
    // auto-derive fail-safe))
    const rows = await myAuditRowsByAction('tip_pool_distributed')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.entityType).toBe('tip_pool')
    expect(rows[0]?.entityId).toBeNull()
    expect(rows[0]?.userId).toBe(EMP_ID)
    expect(rows[0]?.locationId).toBeNull()
    expect(Number(rows[0]?.detailsParsed.totalTips)).toBe(100)
    expect(rows[0]?.detailsParsed.employeeCount).toBe(2)
    const rawMsg = String(rows[0]?.detailsParsed.message)
    expect(rawMsg).toContain('Napitnine razdeljene')
    expect(rawMsg).toContain('2 zaposlenih')
  })

  it('payout → TIP_POOL_PAID z EXACT details {tipPoolId, date, totalTips 100, distributionCount 2, paidBy} + PII sweep čez VSE moje audit vrstice (3×: GENERATED + distributed + PAID)', async () => {
    const rows = await myAuditRows(IDS.poolDist)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('TIP_POOL_PAID')
    expect(rows[0]?.entityType).toBe('TipPool')
    expect(rows[0]?.userId).toBe(EMP_ID)
    expect(rows[0]?.locationId).toBe(IDS.locA)
    expect(rows[0]?.detailsParsed).toEqual({
      tipPoolId: IDS.poolDist,
      date: dayOf(1).toISOString(),
      totalTips: 100,
      distributionCount: 2,
      paidBy: EMP_ID,
    })
    // PII kanon: NIKOLI per-employee detail v payout auditu
    const raw = String(rows[0]?.details)
    for (const token of PII_TOKENS) expect(raw).not.toContain(token)

    // FORENZIČNI SWEEP: točno 3 moje vrstice z expected action multiset,
    // details brez PII markerjev
    const allMine = await myAuditRows()
    expect(allMine).toHaveLength(3)
    expect(allMine.map((r) => r.action).sort()).toEqual(['TIP_POOL_GENERATED', 'TIP_POOL_PAID', 'tip_pool_distributed'])
    for (const r of allMine) {
      for (const token of PII_TOKENS) expect(r.details).not.toContain(token)
    }
  })

  it('failed poti → ZERO novih audit vrstic: PUT na paid poolu → 400 (put-handler guard, drugačen od payout 409) + POST generacija za prazen dan → 400 (Ni zaposlenih); TODO: pravi mid-tx rollback (audit nato tx fail) ni poceni vsiljiv v integraciji brez concurency injekcije — in-tx vrstni red je pinan v unit r145-b trap-DB', async () => {
    const before = await myAuditRows()

    const resPut = await tipPut({
      tipPoolId: IDS.poolPaid,
      distributions: [{ employeeId: IDS.emp1, employeeName: EMP1_NAME, hoursWorked: 8, points: 1, amount: 10 }],
    })
    expect(resPut.status).toBe(400)
    expect(await asJson(resPut)).toEqual({ error: 'Tip pool je že izplačan' })

    const resPost = await tipPost({ date: dateParam(dayOf(9)), distributionMethod: 'equal' })
    expect(resPost.status).toBe(400)
    expect(await asJson(resPost)).toEqual({ error: 'Ni zaposlenih, ki so delali ta dan' })

    const after = await myAuditRows()
    expect(after).toHaveLength(before.length)
    expect(await myAuditRows(IDS.poolPaid)).toHaveLength(0)
  })
})

// ============================================
// 3) SCOPE & ZERO-ORACLE — MODEL A (R143/R144 lekcija)
// ============================================
describe('R145 #32: scope in zero-oracle na pravi PGlite', () => {
  it('payout tuja pool (locB) ≡ neobstoječ id → 404 z BYTE-IDENTIČNIM telesom { error: "Tipski bazen ni najden" } (R144-d lekcija); tuji pool + vrstice nedotaknjeni, zero audit sledi', async () => {
    setSession('admin', IDS.locA, ['admin'])

    const resForeign = await payoutPost(IDS.poolB)
    const resMissing = await payoutPost(IDS.missing)
    expect(resForeign.status).toBe(404)
    expect(resMissing.status).toBe(404)

    // BYTE-IDENTICAL: enako RAW telo (ne samo parsed JSON — 1-znakovni
    // ID-enumeration oracle iz R144-d)
    const foreignText = await resForeign.text()
    const missingText = await resMissing.text()
    expect(missingText).toBe(foreignText)
    expect(JSON.parse(foreignText)).toEqual({ error: 'Tipski bazen ni najden' })

    // forenzika: zero-oracle NIČ ne piše
    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolB } })
    expect(dbPool?.status).toBe('distributed')
    expect(await db.tipDistribution.count({ where: { tipPoolId: IDS.poolB } })).toBe(2)
    expect(await myAuditRows(IDS.poolB)).toHaveLength(0)
    expect(await myAuditRows(IDS.missing)).toHaveLength(0)
  })

  it('GET ?date scope: locA admin vidi SAMO svoje poole (tuji/ne-loc ne uhajajo), BARE array, EXACT polne vrstice shape, Cache-Control no-store', async () => {
    setSession('admin', IDS.locA, ['admin'])
    const res = await tipGet(`?date=${dateParam(dayOf(2))}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')

    const pools = await asJsonArray(res)
    expect(pools).toHaveLength(1)
    expect(pools[0]?.id).toBe(IDS.poolPending)
    expect(Object.keys(pools[0] as Record<string, unknown>).sort()).toEqual(POOL_KEYS)
    const dists = (pools[0]?.distributions ?? []) as Array<Record<string, unknown>>
    expect(dists.length).toBeGreaterThan(0)
    for (const d of dists) expect(Object.keys(d).sort()).toEqual(DIST_KEYS)

    const raw = JSON.stringify(pools)
    expect(raw).not.toContain(IDS.poolB)
    expect(raw).not.toContain(IDS.poolSuper)
    expect(raw).not.toContain(IDS.locB)
  })

  it('super-admin (MODEL A, brez lokacije) GET vidi cross-location poole: locB pool po ?date in locA pool — globalni pogled', async () => {
    setSession('super_admin', null, ['admin', 'view_reports', 'manage_employees', 'take_orders'])

    const resB = await tipGet(`?date=${dateParam(dayOf(4))}`)
    expect(resB.status).toBe(200)
    const poolsB = await asJsonArray(resB)
    expect(poolsB).toHaveLength(1)
    expect(poolsB[0]?.id).toBe(IDS.poolB)
    expect(poolsB[0]?.locationId).toBe(IDS.locB)

    const resA = await tipGet(`?date=${dateParam(dayOf(2))}`)
    expect(resA.status).toBe(200)
    const poolsA = await asJsonArray(resA)
    expect(poolsA).toHaveLength(1)
    expect(poolsA[0]?.id).toBe(IDS.poolPending)
  })

  it('MODEL A payout: super-admin BREZ sejske lokacije IZPLAČA pool na tuji lokaciji B (scope null → isWithinScope true — kontrakt super-admin vidi vse) → 200 + paid + TIP_POOL_PAID; vezava na rep po PUT redistribuciji', async () => {
    setSession('super_admin', null, ['admin', 'view_reports', 'manage_employees', 'take_orders'])

    const res = await payoutPost(IDS.poolSuper)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.id).toBe(IDS.poolSuper)
    expect(body.status).toBe('paid')
    expect(body.payoutSummary).toEqual({ distributionCount: 2, totalPaid: 90 })
    const dists = body.distributions as Array<Record<string, unknown>>
    expect(dists).toHaveLength(2)
    for (const d of dists) {
      expect(d.status).toBe('paid')
      expect(typeof d.paidAt).toBe('string')
    }

    const dbPool = await db.tipPool.findUnique({ where: { id: IDS.poolSuper } })
    expect(dbPool?.status).toBe('paid')

    // chain: recreate mehanika tudi na super-admin poti — vezava na EXACT rep
    // po zadnjem prejšnjem pisecu (t9 PUT na poolPending)
    const dbRows = await db.tipDistribution.findMany({ where: { tipPoolId: IDS.poolSuper } })
    const { first, second } = linkedPair(dbRows, poolPendingTailHash)
    expect(new Set([first.id, second.id])).toEqual(new Set(dbRows.map((r) => r.id)))
    expect(new Set(dbRows.map((r) => r.status))).toEqual(new Set(['paid']))

    // audit: TIP_POOL_PAID tudi za cross-location payout
    const rows = await myAuditRows(IDS.poolSuper)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('TIP_POOL_PAID')
    expect(rows[0]?.detailsParsed).toEqual({
      tipPoolId: IDS.poolSuper,
      date: dayOf(6).toISOString(),
      totalTips: 90,
      distributionCount: 2,
      paidBy: EMP_ID,
    })
  })
})

// ============================================
// 4) CHAIN INTEGRITY — chain-safe payout mehanika (EU 852/2004)
// ============================================
describe('R145 #32: hash chain integrity (chain-safe payout)', () => {
  it('vezava čez delete+recreate mejo: prva recreated vrstica poolDist se veže na EXACT globalni rep PRED payoutom (seed rep), parna vezava row0→row1, 64-hex format; ⚠ verifyTipDistributionChainIntegrity NI uporabljen (pre-after bug R145-b: recompute uporablja amount.toString() + entry.createdAt, dateIso se ne shrani → EXACT recompute iz DB polj ni možen — dokumentirana najdba, TODO za prihodnjo rundo)', async () => {
    const dbRows = await db.tipDistribution.findMany({ where: { tipPoolId: IDS.poolDist } })
    expect(dbRows).toHaveLength(2)

    // vezava čez mejo: row0.previousHash == rep pred payoutom (deterministično,
    // brez orderBy createdAt — t1 je bil edini pisec medCapturo in payoutom)
    const { first, second } = linkedPair(dbRows, seedTailHash)
    expect(new Set([first.id, second.id])).toEqual(new Set(dbRows.map((r) => r.id)))
    expect(first.previousHash).toBe(seedTailHash)
    expect(second.previousHash).toBe(first.chainHash)
    poolDistTailHash = localTailHash(dbRows)

    // hash format + self-link sanity
    for (const r of dbRows) {
      expect(r.chainHash).toMatch(/^[0-9a-f]{64}$/)
      expect(r.previousHash).toMatch(/^([0-9a-f]{64}|)$/)
      expect(r.chainHash).not.toBe(r.previousHash)
    }
  })

  it('distribucije izplačanega poola: točno distributionCount vrstic, VSE status paid + paidAt nastavljen, snapshot imena/zneskov/ur ohranjen (60/40, 8h, 1 točka), vsota == payoutSummary.totalPaid', async () => {
    const dbRows = await db.tipDistribution.findMany({ where: { tipPoolId: IDS.poolDist } })
    expect(dbRows).toHaveLength(2)

    const nameAmount = new Map<string, number>()
    for (const r of dbRows) {
      expect(r.status).toBe('paid')
      expect(r.paidAt).not.toBeNull()
      expect(r.tipPoolId).toBe(IDS.poolDist)
      expect(Number(r.hoursWorked)).toBe(8) // Decimal → number (DB vrstica, ne deepToNumbers)
      expect(Number(r.points)).toBe(1)
      nameAmount.set(r.employeeName, Number(r.amount))
    }
    // snapshot ohranjen: (ime, znesek) pari iz seeda preživijo recreate
    expect(nameAmount.get(EMP1_NAME)).toBe(60)
    expect(nameAmount.get(EMP2_NAME)).toBe(40)

    const total = dbRows.reduce((sum, r) => sum + Number(r.amount), 0)
    expect(total).toBe(100) // == payoutSummary.totalPaid iz t1
    expect(dbRows.every((r) => r.employeeId === IDS.emp1 || r.employeeId === IDS.emp2)).toBe(true)
  })
})
