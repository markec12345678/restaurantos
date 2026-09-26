// @vitest-environment node
// ============================================
// R144 / EPIC #115 #31 — INTEGRACIJA: GIFT CARDS (audit trail + liability + hardening)
// ============================================
// Audit trail (R144-b: POST GIFT_CARD_CREATED / PUT GIFT_CARD_ADJUSTED +
// GIFT_CARD_STATUS_CHANGED diff-only / DELETE GIFT_CARD_DELETED — vse details
// SAMO last4, poln cardNumber NIKOLI) + GET /api/gift-cards/liability (NOVO
// R144-b: pasivna obveznost) + GET /api/gift-cards hardening (GIFT_CARD_SELECT
// whitelist + no-store) + zero-oracle/P2002, na pravi bazi (PGlite, izoliran
// PGLITE_DATA_DIR=/tmp/pglite-data-it). R144 je ZERO migration → /tmp/
// pglite-data-it NE rabi migracij (migracije ustavljene na 0021).
//
// Kontrakt (R144-a + R144-b, kot IMPLEMENTIRANO):
//   POST /api/gift-cards (take_orders): $transaction { create + začetni 'load'
//     tx SAMO če balance > 0 (R69 greaterThan) + createAuditLog GIFT_CARD_CREATED
//     V TX (details {cardLast4, initialBalance, expiresAt, ownerName,
//     locationId} — NIKOLI poln cardNumber) }; 201 + polna vrstica + tx;
//     P2002 dup cardNumber → 409.
//   PUT /api/gift-cards/[id] (take_orders): scope → 404 zero-oracle
//     (notInScopeResponse('Darilna kartica') ≡ neobstoječ id); suspended 400;
//     load = pogojni updateMany (R103 G1 TOCTOU cap); diff-only audit V TX:
//     GIFT_CARD_ADJUSTED {delta, balanceBefore, balanceAfter, cardLast4} SAMO
//     ko appliedDelta ≠ null IN GIFT_CARD_STATUS_CHANGED {before, after,
//     cardLast4} SAMO ko status dejansko spremenjen; no-op PUT → ZERO auditov,
//     ZERO ledger, ZERO update; auto ledger 'load'/'redeem' z amount =
//     appliedDelta (redeem NEGATIVEN — pin dejanske semantike); combined
//     delta+status → OBE audit vrstici.
//   DELETE /api/gift-cards/[id] (ADMIN kanon): canDeleteGiftCard guard
//     (tx count > 0 ALI balance > 0 → 409 s predlogom suspendiranja); scoped
//     deleteMany → count 0 → 404; P2003 → 409; po uspešnem izbrisu
//     GIFT_CARD_DELETED {cardLast4, balanceAtDelete, txnCount} (audit obstaja
//     ⇔ izbris uspel).
//   GET /api/gift-cards (take_orders): GIFT_CARD_SELECT whitelist (id,
//     cardNumber, ownerName, balance, initialBalance, status, purchasedAt,
//     expiresAt, locationId, location{name,code} + transactions take 10) +
//     Cache-Control no-store; ?status/?cardNumber filtri (oba SCOPED);
//     card-level createdAt/updatedAt + payments NAMERNO izpuščeni (R144-b
//     konsumentski rg dokaz).
//   GET /api/gift-cards/liability (view_reports): totals {outstandingBalance =
//     Σ balance WHERE status IN (active, depleted) — suspended/expired SAMO kot
//     števci; activeCards, depletedCards, suspendedCards, expiredCards;
//     expiringSoon30d {cards, balance} = status active IN expiresAt ≤ now+30d
//     (zgornja meja SAMO — lazy-expiry 'active' kartice z expiresAt v
//     preteklosti so NAJURGENTNEJŠE in ŠTEJAJO, R144-b izbira)}, byLocation
//     (loc-admin: ENOJNA vrstica svoje lokacije, null-location NI v scope;
//     super-admin: vrstica per lokacijo s karticami + null bucket 'Brez
//     lokacije' DETERMINISTIČNO ZADNJI), generatedAt, no-store, deepToNumbers
//     (vse številke JS numbers).
//
// SEED STRATEGIJA (r141/r142/r143 kanon): 4 lokacije (3 dedikirane + null) z
//   RUN_ID markerji + RUN_ID cardNumberji (`GC-<RUN_ID>-…`) → parallel/previous
//   runi se Nikoli ne trčijo (cardNumber @unique). Super-admin/globalne trditve
//   = baseline (izmerjen PRED seedom) + delta → imune na fixture drift.
//
// Fixture tabela (vse kartice seedane direktno prek Prisme; locA številke so
//   ČISTE semena — vsa pisanja audit bloka gredo na locD, zato vrstni red
//   describe blokov ne vpliva na liability/hardening exact trditve):
//   locA — liability/scope fixture:
//     aA1  active    50/50            → outstanding 50, active
//     aA2  depleted   0/50            → outstanding  0, depleted števec
//     aA3  suspended 30/30            → IZVEN outstanding (samo števec)
//     aA4  expired   40/40            → IZVEN outstanding (samo števec)
//     aA5  active    25/25  exp +10d  → expiringSoon30d (25)
//     aA6  suspended  7/7   exp +5d   → NE v expiring (status filter!)
//     aA7  active     9/9   exp −1d   → expiring (lazy expiry, brez spodnje
//                                         meje — R144-b izbira) + outstanding
//     → locA row {outstanding 84, active 3, depleted 1, suspended 2, expired 1},
//       expiring {cards 2, balance 34}
//   locB — tuja lokacija: bB1 active 100/100 (zero-oracle tarča + scope)
//   null lokacija: nGc1 active 11/11 (samo super-admin; 'Brez lokacije' bucket)
//   locD — audit delavnica (vse mutacije tu):
//     aD1  active 50/100   → PUT +25 → 75  → GIFT_CARD_ADJUSTED (1 vrstica)
//     aD2  active 20/20    → PUT suspend   → GIFT_CARD_STATUS_CHANGED
//     aD3  active 10/30    → PUT {bal 5, susp} → OBE vrstici + redeem ledger (−5)
//     aD4  active 12/12    → PUT no-op     → ZERO vrstic
//     aD5  active  0/10 + 1 seed tx        → DELETE 409 (zgodovina)
//     aDdup active 0/0, cardNumber DUP     → POST dup → 409 P2002
//     aDnew  POST balance 25               → 201 + GIFT_CARD_CREATED + 1 load tx
//     aDdel  POST balance 0                → 201, BREZ začetnega tx (R69) →
//                                            DELETE 200 + GIFT_CARD_DELETED
//     → locD end-state {outstanding 112, active 5, depleted 0, suspended 2,
//       expired 0} — gre v super-admin globalno delta
//
// SEJE: ročno konstruirana PIN seja (r137/r140/r141/r142/r143 kanon) —
//   requireAuth nadomeščen z mockom, ki UPORABI REALEN hasPermission (403 kanon
//   'Nimate dovoljenja za to operacijo.' 1:1 z realnim middleware telesom);
//   resolveTenantLocationIdOrThrow ostane REALEN (tenant scope v praksi).
//   Vloge: admin (locA/locB/locD, full dostop), super_admin (null lokacija +
//   ['admin','view_reports','take_orders']), take_orders (403 tarča).
//
// AUDIT ČIŠČENJE (r142-d pravilo): ta datoteka piše 7 AuditLog vrstic
//   (GIFT_CARD_CREATED ×2, GIFT_CARD_ADJUSTED ×2, GIFT_CARD_STATUS_CHANGED ×2,
//   GIFT_CARD_DELETED ×1) v PRODUKCIJSKO hash verigo (previousHash/chainHash,
//   PCI DSS). afterAll briše SAMO svoje (userId = emp-RUN_ID ALI entityId ∈
//   moji card id-ji) KOT PRVE (pred FK otroki). Ker teče ZADNJA po abecedi
//   (r144 > r143 > r142 > …; vitest.config.integration.ts fileParallelism:
//   false), se hash veriga vrne v stanje PRED zagonom — prekinjena veriga za
//   kasnejše bralce ne obstaja (r127 restore round-trip bere samo vrstice do
//   trenutnega repa). Kombinirana regresija r142+r143+r144: vsaka datoteka
//   počisti svoje vrstice pred disconnectom — abecedni vrstni red drži.
//
// RATE LIMIT BUDŽET: bucketa 'gift-cards' in 'gift-cards-liability' (oba
//   AUTHENTICATED_LIMIT 120/min/IP, ločena števca). Ta datoteka porabi ~15
//   klicev na 'gift-cards' (2 POST + 4 PUT + 2 DELETE + 4 zero-oracle + 3 GET)
//   in ~8 na 'gift-cards-liability' (2×401 + 1×403 + locA + globalni + 1
//   usmerjen + no-store pini) — varno pod mejo tudi pri ponovljenih zagonih
//   (okno 1 min). 429 pot NI testirana v integraciji (unit r144-b/r136 kanon).
//
// Zagon: bunx vitest run tests/integration/r144-gift-cards.test.ts \
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

// ISTI vzorec kot r143 (najnovejši kanon): realen auth-middleware (importOriginal
// spread — resolveTenantLocationIdOrThrow ostane REALEN), samo requireAuth
// nadomesti z ročno konstruirano PIN sejo; mock UPORABI realen hasPermission
// (iz auth-middleware/permissions) za opts.permission gate, da je 403 kanon
// (view_reports na liability / admin na DELETE) testiran v praksi — enako telo
// kot realni middleware.
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
import { GET as giftCardsGET, POST as giftCardsPOST } from '@/app/api/gift-cards/route'
import { PUT as giftCardPUT, DELETE as giftCardDELETE } from '@/app/api/gift-cards/[id]/route'
import { GET as liabilityGET } from '@/app/api/gift-cards/liability/route'
import { toNum } from '@/lib/decimal'
import { GIFT_CARD_EXPIRING_SOON_DAYS } from '@/lib/gift-cards/constants'
import { GIFT_CARD_SELECT } from '@/app/api/gift-cards/_helpers/gift-card-select'

const RUN_ID = `r144-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const DAY_MS = 86_400_000
const EMP_ID = `emp-${RUN_ID}`

// ---------- Časovne pike za expiring fixture ----------
const SOON = new Date(Date.now() + 10 * DAY_MS) // znotraj 30-dnevnega okna
const SOON2 = new Date(Date.now() + 5 * DAY_MS) // znotraj okna, ampak SUSPENDED
const PAST = new Date(Date.now() - 1 * DAY_MS) // lazy expiry — 'active' z exp v preteklosti

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  locD: `${RUN_ID}-loc-d`,
  // locA — liability/scope fixture (čista semena)
  aA1: `${RUN_ID}-gc-a-act`,
  aA2: `${RUN_ID}-gc-a-dep`,
  aA3: `${RUN_ID}-gc-a-sus`,
  aA4: `${RUN_ID}-gc-a-exp`,
  aA5: `${RUN_ID}-gc-a-soon`,
  aA6: `${RUN_ID}-gc-a-ssus`,
  aA7: `${RUN_ID}-gc-a-past`,
  // locB — tuja lokacija
  bB1: `${RUN_ID}-gc-b-1`,
  // null lokacija — samo super-admin
  nGc1: `${RUN_ID}-gc-null-1`,
  // locD — audit delavnica
  aD1: `${RUN_ID}-gc-d-load`,
  aD2: `${RUN_ID}-gc-d-susp`,
  aD3: `${RUN_ID}-gc-d-both`,
  aD4: `${RUN_ID}-gc-d-noop`,
  aD5: `${RUN_ID}-gc-d-tx`,
  aDdup: `${RUN_ID}-gc-d-dup`,
  // neobstoječ id (zero-oracle)
  missing: `${RUN_ID}-gc-ne-obstaja`,
}

const LOC_IDS = [IDS.locA, IDS.locB, IDS.locD]

// POST-kreirane kartice (cuid znan šele po odgovoru) — za cleanup + forenziko
const createdCardIds: string[] = []

const LOC_A_NAME = `R144 Glavna ${RUN_ID}`
const LOC_B_NAME = `R144 Filiala ${RUN_ID}`
const LOC_D_NAME = `R144 Delavnica ${RUN_ID}`

/** RUN_ID-unikaten cardNumber (cardNumber @unique — parallel runi se ne trčijo). */
const cardNo = (suffix: string) => `GC-${RUN_ID}-${suffix}`
const CARD_NO_A1 = cardNo('A1')
const CARD_NO_L1 = cardNo('L1')
const CARD_NO_DUP = cardNo('DUP')
const CARD_NO_NEW = cardNo('NEW')
const CARD_NO_DEL = cardNo('DEL')
const CARD_NO_B1 = cardNo('B1')
const CARD_NO_NULL = cardNo('N1')

// ---------- Whitelist kontrakti (EXACT implemented shape) ----------
// GET /api/gift-cards vrstica = GIFT_CARD_SELECT (9 skalarnih + location) +
// transactions (take 10). card-level createdAt/updatedAt/payments IZPUŠČENI.
const GC_ROW_KEYS = [...Object.keys(GIFT_CARD_SELECT), 'transactions'].sort()
const GC_LOCATION_KEYS = ['code', 'name'].sort()
// GIFT_CARD_TRANSACTION_SELECT = polni 9-stolpčni UI kontrakt
const GC_TX_KEYS = ['amount', 'balanceAfter', 'checkId', 'createdAt', 'giftCardId', 'id', 'note', 'orderId', 'type'].sort()
// Liability odgovor — R144-b kontrakt
const LIABILITY_KEYS = ['byLocation', 'generatedAt', 'totals'].sort()
const LIABILITY_TOTALS_KEYS = ['activeCards', 'depletedCards', 'expiredCards', 'expiringSoon30d', 'outstandingBalance', 'suspendedCards'].sort()
const LIABILITY_ROW_KEYS = ['activeCards', 'depletedCards', 'expiredCards', 'locationCode', 'locationId', 'locationName', 'outstandingBalance', 'suspendedCards'].sort()
const NO_LOCATION_LABEL = 'Brez lokacije'

// ---------- EXACT fixture števci ----------
// locA (čista semena — NIHČE je ne mutate): outstanding = 50 + 0 + 25 + 9
const LOC_A_ROW = {
  locationId: IDS.locA,
  locationName: LOC_A_NAME,
  locationCode: `${RUN_ID}-A`,
  outstandingBalance: 84, // active 50 + depleted 0 + expiring 25 + lazy 9; suspended 30 + expired 40 IZVEN
  activeCards: 3, // aA1, aA5, aA7
  depletedCards: 1, // aA2
  suspendedCards: 2, // aA3, aA6
  expiredCards: 1, // aA4
}
const LOC_A_TOTALS = {
  outstandingBalance: 84,
  activeCards: 3,
  depletedCards: 1,
  suspendedCards: 2,
  expiredCards: 1,
  expiringSoon30d: { cards: 2, balance: 34 }, // aA5 25 (active, +10d) + aA7 9 (active, lazy −1d); aA6 suspended NE, aA4 expired NE
}
const LOC_B_ROW = {
  locationId: IDS.locB,
  locationName: LOC_B_NAME,
  locationCode: `${RUN_ID}-B`,
  outstandingBalance: 100,
  activeCards: 1,
  depletedCards: 0,
  suspendedCards: 0,
  expiredCards: 0,
}
const LOC_B_TOTALS = {
  outstandingBalance: 100,
  activeCards: 1,
  depletedCards: 0,
  suspendedCards: 0,
  expiredCards: 0,
  expiringSoon30d: { cards: 0, balance: 0 },
}
// locD END-STATE po audit bloku (aDdel izbrisan; aD1 75, aD2 susp 20, aD3 susp 5,
// aD4 12, aD5 0, aDdup 0, aDnew 25): outstanding = 75 + 12 + 0 + 0 + 25
const LOC_D_ROW = {
  locationId: IDS.locD,
  locationName: LOC_D_NAME,
  locationCode: `${RUN_ID}-D`,
  outstandingBalance: 112,
  activeCards: 5, // aD1, aD4, aD5, aDdup, aDnew
  depletedCards: 0,
  suspendedCards: 2, // aD2, aD3
  expiredCards: 0,
}
// Super-admin globalna delta (baseline PRED seedom + tole):
const MY_DELTA = {
  outstandingBalance: 84 + 100 + 112 + 11,
  activeCards: 3 + 1 + 5 + 1,
  depletedCards: 1,
  suspendedCards: 2 + 2,
  expiredCards: 1,
  expiring: { cards: 2, balance: 34 },
}

// ---------- Baseline (PRED seedom — imuno na fixture drift, r141/r142/r143) ----------
interface StatusBuckets {
  active: { cards: number; balance: number }
  depleted: { cards: number; balance: number }
  suspended: { cards: number; balance: number }
  expired: { cards: number; balance: number }
}
const emptyBuckets = (): StatusBuckets => ({
  active: { cards: 0, balance: 0 },
  depleted: { cards: 0, balance: 0 },
  suspended: { cards: 0, balance: 0 },
  expired: { cards: 0, balance: 0 },
})
const DAY_STATUS_KEYS = ['active', 'depleted', 'suspended', 'expired'] as const
type DayStatus = (typeof DAY_STATUS_KEYS)[number]
const isDayStatus = (s: string): s is DayStatus => (DAY_STATUS_KEYS as readonly string[]).includes(s)
const outstandingOf = (b: StatusBuckets) => b.active.balance + b.depleted.balance

let baselineTotals = { outstandingBalance: 0, activeCards: 0, depletedCards: 0, suspendedCards: 0, expiredCards: 0, expiring: { cards: 0, balance: 0 } }
// baseline byLocation ključi (locationId ALI '__null__') — za EXACT length trditv
const baselineLocKeys = new Set<string>()
const baselineNullBuckets = emptyBuckets()
const NULL_KEY = '__null__'

/** Neodvisna replikacija liability formule iz route.ts (groupBy po statusu +
 *  expiring aggregate z ISTIM where) — baseline meritev PRED seedom. */
async function measureBaseline(): Promise<void> {
  const cutoff30 = new Date(Date.now() + GIFT_CARD_EXPIRING_SOON_DAYS * DAY_MS)
  const statusRows = await db.giftCard.groupBy({ by: ['status'], _count: { _all: true }, _sum: { balance: true } })
  const t = emptyBuckets()
  for (const row of statusRows) {
    if (!isDayStatus(row.status)) continue
    t[row.status].cards += row._count._all
    t[row.status].balance += toNum(row._sum.balance)
  }
  const expiring = await db.giftCard.aggregate({
    where: { status: 'active', expiresAt: { lte: cutoff30 } },
    _count: { _all: true },
    _sum: { balance: true },
  })
  baselineTotals = {
    outstandingBalance: outstandingOf(t),
    activeCards: t.active.cards,
    depletedCards: t.depleted.cards,
    suspendedCards: t.suspended.cards,
    expiredCards: t.expired.cards,
    expiring: { cards: expiring._count._all, balance: toNum(expiring._sum.balance) },
  }
  // byLocation baseline: samo ključi (za length trditv) + null bucket števci
  const locRows = await db.giftCard.groupBy({ by: ['locationId', 'status'], _count: { _all: true }, _sum: { balance: true } })
  for (const row of locRows) {
    baselineLocKeys.add(row.locationId ?? NULL_KEY)
    if (row.locationId === null && isDayStatus(row.status)) {
      baselineNullBuckets[row.status].cards += row._count._all
      baselineNullBuckets[row.status].balance += toNum(row._sum.balance)
    }
  }
}

// ---------- Pomožniki ----------
async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function gcGet(query = ''): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return giftCardsGET(new Request(`http://localhost/api/gift-cards${query}`))
}

function gcPost(body: unknown): Promise<Response> {
  return giftCardsPOST(
    new Request('http://localhost/api/gift-cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function gcPut(body: unknown, id: string): Promise<Response> {
  return giftCardPUT(
    new NextRequest(`http://localhost/api/gift-cards/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }, // Next 16: params je Promise
  )
}

function gcDelete(id: string): Promise<Response> {
  return giftCardDELETE(new Request(`http://localhost/api/gift-cards/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  })
}

function liabilityGet(query = ''): Promise<Response> {
  return liabilityGET(new Request(`http://localhost/api/gift-cards/liability${query}`))
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

/** Skupno število mojih kartic (RUN_ID v cardNumber) — fail-closed forenzika. */
async function myCardCount(): Promise<number> {
  return db.giftCard.count({ where: { cardNumber: { contains: RUN_ID } } })
}

beforeAll(async () => {
  // 0) Baseline PRED lastnim seedom (super-admin trditve = baseline + delta)
  await measureBaseline()

  // 1) Tri dedikirane lokacije (A = liability/scope, B = tuja, D = audit delavnica)
  await db.location.create({ data: { id: IDS.locA, code: `${RUN_ID}-A`, name: LOC_A_NAME, premisesId: `${RUN_ID}-pA`, isActive: true } })
  await db.location.create({ data: { id: IDS.locB, code: `${RUN_ID}-B`, name: LOC_B_NAME, premisesId: `${RUN_ID}-pB`, isActive: true } })
  await db.location.create({ data: { id: IDS.locD, code: `${RUN_ID}-D`, name: LOC_D_NAME, premisesId: `${RUN_ID}-pD`, isActive: true } })

  // 2) Kartice — status/balance/initialBalance/expiresAt/locationId eksplicitno
  await db.giftCard.createMany({
    data: [
      // locA — liability fixture (glej tabelo v headerju)
      { id: IDS.aA1, cardNumber: CARD_NO_A1, balance: 50, initialBalance: 50, status: 'active', ownerName: `R144 Aktiven ${RUN_ID}`, locationId: IDS.locA },
      { id: IDS.aA2, cardNumber: cardNo('A2'), balance: 0, initialBalance: 50, status: 'depleted', ownerName: `R144 Izcrpan ${RUN_ID}`, locationId: IDS.locA },
      { id: IDS.aA3, cardNumber: cardNo('A3'), balance: 30, initialBalance: 30, status: 'suspended', ownerName: `R144 Suspendiran ${RUN_ID}`, locationId: IDS.locA },
      { id: IDS.aA4, cardNumber: cardNo('A4'), balance: 40, initialBalance: 40, status: 'expired', ownerName: `R144 Potekel ${RUN_ID}`, locationId: IDS.locA },
      { id: IDS.aA5, cardNumber: cardNo('A5'), balance: 25, initialBalance: 25, status: 'active', ownerName: `R144 Potece ${RUN_ID}`, locationId: IDS.locA, expiresAt: SOON },
      { id: IDS.aA6, cardNumber: cardNo('A6'), balance: 7, initialBalance: 7, status: 'suspended', ownerName: `R144 Suspendiran Potece ${RUN_ID}`, locationId: IDS.locA, expiresAt: SOON2 },
      { id: IDS.aA7, cardNumber: cardNo('A7'), balance: 9, initialBalance: 9, status: 'active', ownerName: `R144 Lazy ${RUN_ID}`, locationId: IDS.locA, expiresAt: PAST },
      // locB — tuja lokacija
      { id: IDS.bB1, cardNumber: CARD_NO_B1, balance: 100, initialBalance: 100, status: 'active', ownerName: `R144 Tujec ${RUN_ID}`, locationId: IDS.locB },
      // null lokacija — samo super-admin
      { id: IDS.nGc1, cardNumber: CARD_NO_NULL, balance: 11, initialBalance: 11, status: 'active', ownerName: `R144 Brez Lokacije ${RUN_ID}`, locationId: null },
      // locD — audit delavnica
      { id: IDS.aD1, cardNumber: CARD_NO_L1, balance: 50, initialBalance: 100, status: 'active', ownerName: `R144 Nalagalnik ${RUN_ID}`, locationId: IDS.locD },
      { id: IDS.aD2, cardNumber: cardNo('S1'), balance: 20, initialBalance: 20, status: 'active', ownerName: `R144 Suspendira ${RUN_ID}`, locationId: IDS.locD },
      { id: IDS.aD3, cardNumber: cardNo('BO'), balance: 10, initialBalance: 30, status: 'active', ownerName: `R144 Kombiniran ${RUN_ID}`, locationId: IDS.locD },
      { id: IDS.aD4, cardNumber: cardNo('NO'), balance: 12, initialBalance: 12, status: 'active', ownerName: `R144 Noop ${RUN_ID}`, locationId: IDS.locD },
      { id: IDS.aD5, cardNumber: cardNo('TX'), balance: 0, initialBalance: 10, status: 'active', ownerName: `R144 Zgodovina ${RUN_ID}`, locationId: IDS.locD },
      { id: IDS.aDdup, cardNumber: CARD_NO_DUP, balance: 0, initialBalance: 0, status: 'active', ownerName: `R144 Duplikat ${RUN_ID}`, locationId: IDS.locD },
    ],
  })

  // 3) aD5 fiskalna zgodovina (1 tx → canDeleteGiftCard blokada)
  await db.giftCardTransaction.create({
    data: { giftCardId: IDS.aD5, type: 'load', amount: 10, balanceAfter: 10, note: `R144 seed zgodovina ${RUN_ID}` },
  })
}, 60_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  setSession('admin', IDS.locA, ['admin'])
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (r142-d pravilo):
  //   1) AUDIT vrstice PRVE (7 vrstic v produkcijski hash verigi — brišem svoje
  //      po userId/entityId; datoteka teče ZADNJA po abecedi + fileParallelism
  //      false → veriga se vrne v stanje pred zagonom, glej header),
  //   2) GiftCardTransaction (FK Restrict na GiftCard — MORA pred karticami;
  //      relacijski filter pokrije tudi morebitne POST-strays),
  //   3) GiftCard (id-in + cardNumber-contains RUN_ID — belt&braces za stray),
  //   4) lokacije (GiftCard.locationId FK SetNull, a kartice so že gone).
  // Seje niso ustvarjene (ročna seja brez DB vrstice).
  const myIds = [IDS.aA1, IDS.aA2, IDS.aA3, IDS.aA4, IDS.aA5, IDS.aA6, IDS.aA7, IDS.bB1, IDS.nGc1, IDS.aD1, IDS.aD2, IDS.aD3, IDS.aD4, IDS.aD5, IDS.aDdup, ...createdCardIds]
  await db.auditLog
    .deleteMany({ where: { OR: [{ userId: EMP_ID }, { entityId: { in: myIds } }] } })
    .catch(() => {})
  await db.giftCardTransaction
    .deleteMany({ where: { giftCard: { OR: [{ id: { in: myIds } }, { cardNumber: { contains: RUN_ID } }] } } })
    .catch(() => {})
  await db.giftCard
    .deleteMany({ where: { OR: [{ id: { in: myIds } }, { cardNumber: { contains: RUN_ID } }] } })
    .catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})
  await db.$disconnect().catch(() => {})
}, 60_000)

// ============================================
// 1) AUDIT TRAIL — POST/PUT/DELETE pišejo hash-chain vrstice (R144-b)
// ============================================
describe('R144 #31: audit trail na pravi PGlite (GIFT_CARD_* v produkcijski verigi)', () => {
  it('POST → 201 + polna vrstica z začetnim load tx + AuditLog GIFT_CARD_CREATED (details SAMO last4, NIKOLI poln cardNumber, initialBalance prisoten)', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const res = await gcPost({ cardNumber: CARD_NO_NEW, balance: 25, ownerName: `R144 Novinec ${RUN_ID}` })
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const newId = body.id as string
    expect(typeof newId).toBe('string')
    createdCardIds.push(newId)

    // Round-trip: balance/initialBalance Decimal → number (deepToNumbers), status
    // default 'active', locationId ŽIGOSAN iz seje (MODEL A resolveWriteLocationId);
    // poln cardNumber v API odgovoru je PO DESIGNU (checkout lookup identifier).
    expect(body.cardNumber).toBe(CARD_NO_NEW)
    expect(body.balance).toBe(25)
    expect(body.initialBalance).toBe(25) // data.initialBalance ?? data.balance
    expect(body.status).toBe('active')
    expect(body.locationId).toBe(IDS.locD)
    expect(typeof body.balance).toBe('number')
    const txs = body.transactions as Array<Record<string, unknown>>
    expect(txs).toHaveLength(1)
    expect(Object.keys(txs[0] as Record<string, unknown>).sort()).toEqual(GC_TX_KEYS)
    expect(txs[0]).toMatchObject({ type: 'load', amount: 25, balanceAfter: 25, note: 'Začetno nalaganje' })

    // DB vrstica res obstaja na locD
    const dbRow = await db.giftCard.findUnique({ where: { id: newId } })
    expect(dbRow?.locationId).toBe(IDS.locD)
    expect(Number(dbRow?.balance ?? -1)).toBe(25)

    // AuditLog: TOČNO 1 GIFT_CARD_CREATED vrstica za to kartico
    const rows = await myAuditRows(newId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('GIFT_CARD_CREATED')
    expect(rows[0]?.entityType).toBe('GiftCard')
    expect(rows[0]?.userId).toBe(EMP_ID)
    expect(rows[0]?.locationId).toBe(IDS.locD)
    const details = rows[0]?.detailsParsed as Record<string, unknown>
    expect(details.cardLast4).toBe(CARD_NO_NEW.slice(-4)) // ročni .slice(-4) — ne zaupaj implementaciji
    expect(details.initialBalance).toBe(25)
    expect(details.ownerName).toBe(`R144 Novinec ${RUN_ID}`)
    expect(details.locationId).toBe(IDS.locD)
    expect(details.expiresAt).toBeNull()
    // PII kanon: poln cardNumber (spendable secret) NIKOLI v details
    expect(JSON.stringify(details)).not.toContain(CARD_NO_NEW)
    expect(String(rows[0]?.details)).not.toContain(CARD_NO_NEW)
  })

  it('POST balance 0 → 201 BREZ začetnega load tx (R69 greaterThan pin — kartica s stanjem 0 ne sme dobiti lažne "load, 0" transakcije)', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const res = await gcPost({ cardNumber: CARD_NO_DEL, balance: 0, ownerName: `R144 Za izbris ${RUN_ID}` })
    expect(res.status).toBe(201)
    const body = await asJson(res)
    const delId = body.id as string
    createdCardIds.push(delId)
    expect(body.transactions as Array<unknown>).toHaveLength(0)
    expect(await db.giftCardTransaction.count({ where: { giftCardId: delId } })).toBe(0)
    // audit kljub 0-bilansu obstaja (izdaja je prehod ne glede na znesek)
    const rows = await myAuditRows(delId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('GIFT_CARD_CREATED')
  })

  it('PUT delta (load) → GIFT_CARD_ADJUSTED z balanceBefore/balanceAfter, ki se UJEMATA z realnim DB stanjem + auto ledger "load"; BREZ STATUS_CHANGED', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const res = await gcPut({ balance: 75 }, IDS.aD1)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.balance).toBe(75)
    expect(body.status).toBe('active') // load ne sme spremeniti statusa active kartice

    // auto ledger (appliedDelta forenzika R103 G3): 1 nov tx 'load' 25/75
    const txs = await db.giftCardTransaction.findMany({ where: { giftCardId: IDS.aD1 } })
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({ type: 'load', note: 'Nalaganje sredstev' })
    expect(Number(txs[0].amount)).toBe(25)
    expect(Number(txs[0].balanceAfter)).toBe(75)

    // REALNO DB stanje po PUT
    const dbRow = await db.giftCard.findUnique({ where: { id: IDS.aD1 } })
    expect(Number(dbRow?.balance ?? -1)).toBe(75)

    // Audit: TOČNO 1 vrstica, details se ujemajo z DB forenziko
    const rows = await myAuditRows(IDS.aD1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('GIFT_CARD_ADJUSTED')
    const details = rows[0]?.detailsParsed as Record<string, unknown>
    expect(details).toEqual({ delta: 25, balanceBefore: 50, balanceAfter: 75, cardLast4: CARD_NO_L1.slice(-4) })
    expect(details.balanceAfter).toBe(Number(dbRow?.balance)) // balanceAfter ≡ realno DB stanje
    expect(details.balanceBefore).toBe(Number(dbRow?.balance) - (details.delta as number)) // before + delta = after
    expect(JSON.stringify(details)).not.toContain(CARD_NO_L1)
  })

  it('PUT status-only (suspend) → GIFT_CARD_STATUS_CHANGED active→suspended; BREZ GIFT_CARD_ADJUSTED, BREZ ledger tx, balans nespremenjen', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const res = await gcPut({ status: 'suspended' }, IDS.aD2)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.status).toBe('suspended')
    expect(body.balance).toBe(20)

    const dbRow = await db.giftCard.findUnique({ where: { id: IDS.aD2 } })
    expect(dbRow?.status).toBe('suspended')
    expect(Number(dbRow?.balance ?? -1)).toBe(20)
    expect(await db.giftCardTransaction.count({ where: { giftCardId: IDS.aD2 } })).toBe(0)

    const rows = await myAuditRows(IDS.aD2)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('GIFT_CARD_STATUS_CHANGED')
    expect(rows[0]?.detailsParsed).toEqual({ before: 'active', after: 'suspended', cardLast4: cardNo('S1').slice(-4) })
  })

  it('PUT kombiniran delta+status → OBE audit vrstici (ADJUSTED −5/10/5 + STATUS_CHANGED active→suspended) + auto redeem ledger z NEGATIVNIM amount', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const res = await gcPut({ balance: 5, status: 'suspended' }, IDS.aD3)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.balance).toBe(5)
    expect(body.status).toBe('suspended')

    // auto ledger: appliedDelta −5 → type 'redeem', amount −5 (pin dejanske
    // semantike — zapis iz DEJANSKO uporabljene spremembe, R103 G3)
    const txs = await db.giftCardTransaction.findMany({ where: { giftCardId: IDS.aD3 } })
    expect(txs).toHaveLength(1)
    expect(txs[0].type).toBe('redeem')
    expect(Number(txs[0].amount)).toBe(-5)
    expect(Number(txs[0].balanceAfter)).toBe(5)

    const rows = await myAuditRows(IDS.aD3)
    expect(rows).toHaveLength(2)
    const adjusted = rows.find((r) => r.action === 'GIFT_CARD_ADJUSTED')
    const statusChanged = rows.find((r) => r.action === 'GIFT_CARD_STATUS_CHANGED')
    expect(adjusted?.detailsParsed).toEqual({ delta: -5, balanceBefore: 10, balanceAfter: 5, cardLast4: cardNo('BO').slice(-4) })
    expect(statusChanged?.detailsParsed).toEqual({ before: 'active', after: 'suspended', cardLast4: cardNo('BO').slice(-4) })
  })

  it('PUT no-op (balance = trenutni) → 200, ZERO novih audit vrstic, ZERO ledger tx, DB nespremenjena (diff-only kanon R142 PATCH devices)', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const auditsBefore = await myAuditRows(IDS.aD4)
    const txBefore = await db.giftCardTransaction.count({ where: { giftCardId: IDS.aD4 } })
    expect(auditsBefore).toHaveLength(0)
    expect(txBefore).toBe(0)

    const res = await gcPut({ balance: 12 }, IDS.aD4)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.balance).toBe(12)

    expect(await myAuditRows(IDS.aD4)).toHaveLength(0)
    expect(await db.giftCardTransaction.count({ where: { giftCardId: IDS.aD4 } })).toBe(0)
    const dbRow = await db.giftCard.findUnique({ where: { id: IDS.aD4 } })
    expect(Number(dbRow?.balance ?? -1)).toBe(12)
    expect(dbRow?.status).toBe('active')
  })

  it('DELETE kartice z transakcijsko zgodovino → 409 (canDeleteGiftCard guard, predlog suspendiranja); kartica ostane, BREZ GIFT_CARD_DELETED audita', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const res = await gcDelete(IDS.aD5)
    expect(res.status).toBe(409)
    const json = await asJson(res)
    expect(typeof json.error).toBe('string')
    expect(json.error as string).toContain('transakcij')

    // kartica ŠE VEDNO v DB (fiskalna zgodovina se ohranja)
    expect(await db.giftCard.findUnique({ where: { id: IDS.aD5 } })).not.toBeNull()
    expect(await myAuditRows(IDS.aD5)).toHaveLength(0)
  })

  it('DELETE prazne kartice → 200 {ok, id} + GIFT_CARD_DELETED {cardLast4, balanceAtDelete 0, txnCount 0}; vrstica gone; PII sweep čez VSE moje audit vrstice (7×, nikoli poln cardNumber)', async () => {
    setSession('admin', IDS.locD, ['admin'])
    const delId = createdCardIds[1]
    expect(delId).toBeTruthy()

    const res = await gcDelete(delId)
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body).toEqual({ ok: true, id: delId })
    expect(await db.giftCard.findUnique({ where: { id: delId } })).toBeNull()

    const rows = await myAuditRows(delId)
    const deleted = rows.find((r) => r.action === 'GIFT_CARD_DELETED')
    expect(deleted).toBeTruthy()
    expect(deleted?.detailsParsed).toEqual({ cardLast4: CARD_NO_DEL.slice(-4), balanceAtDelete: 0, txnCount: 0 })

    // FORENZIČNI SWEEP: točno 7 mojih audit vrstic z expected action multiset,
    // vse entityType GiftCard + userId EMP_ID + details BREZ polnih cardNumberjev
    const allMine = await db.auditLog.findMany({
      where: { OR: [{ userId: EMP_ID }, { entityId: { in: [IDS.aD1, IDS.aD2, IDS.aD3, IDS.aD4, IDS.aD5, IDS.aDdup, ...createdCardIds] } }] },
    })
    expect(allMine).toHaveLength(7)
    expect(allMine.map((r) => r.action).sort()).toEqual([
      'GIFT_CARD_ADJUSTED',
      'GIFT_CARD_ADJUSTED',
      'GIFT_CARD_CREATED',
      'GIFT_CARD_CREATED',
      'GIFT_CARD_DELETED',
      'GIFT_CARD_STATUS_CHANGED',
      'GIFT_CARD_STATUS_CHANGED',
    ])
    const allNumbers = [CARD_NO_A1, cardNo('A2'), cardNo('A3'), cardNo('A4'), cardNo('A5'), cardNo('A6'), cardNo('A7'), CARD_NO_B1, CARD_NO_NULL, CARD_NO_L1, cardNo('S1'), cardNo('BO'), cardNo('NO'), cardNo('TX'), CARD_NO_DUP, CARD_NO_NEW, CARD_NO_DEL]
    for (const r of allMine) {
      expect(r.entityType).toBe('GiftCard')
      expect(r.userId).toBe(EMP_ID)
      for (const n of allNumbers) expect(r.details).not.toContain(n)
    }
  })
})

// ============================================
// 2) LIABILITY — GET /api/gift-cards/liability (R144-b)
// ============================================
describe('R144 #31: GET /api/gift-cards/liability (prava PGlite)', () => {
  it('401 fail-closed: brez seje IN z garbage Bearerjem — nikoli scope uhajanje', async () => {
    authRef.current = null
    const resNone = await liabilityGet()
    expect(resNone.status).toBe(401)
    expect(typeof (await asJson(resNone)).error).toBe('string')
    const resGarbage = await liabilityGet()
    expect(resGarbage.status).toBe(401)
    expect(typeof (await asJson(resGarbage)).error).toBe('string')
  })

  it('take_orders seja → 403 { error: "Nimate dovoljenja za to operacijo." } (view_reports kanon) — zero pisnih sledi', async () => {
    const cardsBefore = await myCardCount()
    setSession('take_orders', IDS.locA, ['take_orders'])
    const res = await liabilityGet()
    expect(res.status).toBe(403)
    expect((await asJson(res)).error).toBe('Nimate dovoljenja za to operacijo.')
    expect(await myCardCount()).toBe(cardsBefore)
  })

  it('scope izolacija + EXACT matematika: locA admin → outstanding 84 = active 50 + depleted 0 + expiring 25 + lazy 9 (suspended 30/7 + expired 40 IZVEN), byLocation = TOČNO 1 vrstica, null-location ne uhaja', async () => {
    setSession('admin', IDS.locA, ['admin'])
    const res = await liabilityGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)

    expect(json.totals).toEqual(LOC_A_TOTALS)
    const byLocation = json.byLocation as Array<Record<string, unknown>>
    expect(byLocation).toEqual([LOC_A_ROW]) // TOČNO 1 vrstica — null bucket NI v lokacijskem scope-u
    expect(Object.keys(byLocation[0] as Record<string, unknown>).sort()).toEqual(LIABILITY_ROW_KEYS)

    const raw = JSON.stringify(json)
    expect(raw).not.toContain(IDS.bB1)
    expect(raw).not.toContain(IDS.locB)
    expect(raw).not.toContain(IDS.locD)
    expect(raw).not.toContain(IDS.nGc1) // null-location kartica samo v globalnem pogledu
  })

  it('super-admin globalno: totals = baseline + delta EXACT (outstanding +307, active +10, depleted +1, suspended +4, expired +1, expiring +2/+34), moje 3 byLocation vrstice EXACT, "Brez lokacije" bucket ZADNJI z baseline-merged števci, shape/no-store/number pini', async () => {
    setSession('super_admin', null, ['admin', 'view_reports', 'take_orders'])
    const res = await liabilityGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)

    // EXACT response shape
    expect(Object.keys(json).sort()).toEqual(LIABILITY_KEYS)
    expect(Object.keys(json.totals as Record<string, unknown>).sort()).toEqual(LIABILITY_TOTALS_KEYS)
    expect(json.totals).toEqual({
      outstandingBalance: baselineTotals.outstandingBalance + MY_DELTA.outstandingBalance,
      activeCards: baselineTotals.activeCards + MY_DELTA.activeCards,
      depletedCards: baselineTotals.depletedCards + MY_DELTA.depletedCards,
      suspendedCards: baselineTotals.suspendedCards + MY_DELTA.suspendedCards,
      expiredCards: baselineTotals.expiredCards + MY_DELTA.expiredCards,
      expiringSoon30d: {
        cards: baselineTotals.expiring.cards + MY_DELTA.expiring.cards,
        balance: baselineTotals.expiring.balance + MY_DELTA.expiring.balance,
      },
    })

    // byLocation: moje 3 lokacije EXACT + null bucket (baseline + moj 11) ZADNJI
    const byLocation = json.byLocation as Array<Record<string, unknown>>
    const expectedLength = baselineLocKeys.size + (baselineLocKeys.has(NULL_KEY) ? 3 : 4)
    expect(byLocation).toHaveLength(expectedLength)
    const byId = new Map(byLocation.map((r) => [r.locationId as string | null, r]))
    expect(byId.get(IDS.locA)).toEqual(LOC_A_ROW)
    expect(byId.get(IDS.locB)).toEqual(LOC_B_ROW)
    expect(byId.get(IDS.locD)).toEqual(LOC_D_ROW)
    const nullRow = byId.get(null) as Record<string, unknown> | undefined
    expect(nullRow).toBeDefined()
    expect(nullRow).toEqual({
      locationId: null,
      locationName: NO_LOCATION_LABEL,
      locationCode: null,
      outstandingBalance: baselineNullBuckets.active.balance + baselineNullBuckets.depleted.balance + 11,
      activeCards: baselineNullBuckets.active.cards + 1,
      depletedCards: baselineNullBuckets.depleted.cards,
      suspendedCards: baselineNullBuckets.suspended.cards,
      expiredCards: baselineNullBuckets.expired.cards,
    })
    // deterministični vrstni red: 'Brez lokacije' ZADNJA, preostale localeCompare po imenu
    expect(byLocation[byLocation.length - 1]?.locationId).toBeNull()
    for (let i = 0; i < byLocation.length - 2; i++) {
      const a = String(byLocation[i]?.locationName)
      const b = String(byLocation[i + 1]?.locationName)
      expect(a.localeCompare(b)).toBeLessThanOrEqual(0)
    }

    // Decimal → number: vse denarne vrednosti so JS numbers (nikoli string)
    for (const row of byLocation) {
      expect(typeof row.outstandingBalance).toBe('number')
    }
    expect(typeof (json.totals as Record<string, unknown>).outstandingBalance).toBe('number')

    // generatedAt: ISO iz zdaj (±5 min)
    expect(new Date(json.generatedAt as string).getTime()).toBeGreaterThan(Date.now() - 5 * 60_000)
  })

  it('super-admin z ?locationId → usmerjen pogled: locB = TOČNO 1 vrstica + totals 100/1 (cross-branch dostop po eno lokacijo)', async () => {
    setSession('super_admin', null, ['admin', 'view_reports', 'take_orders'])
    const res = await liabilityGet(`?locationId=${IDS.locB}`)
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.totals).toEqual(LOC_B_TOTALS)
    expect(json.byLocation).toEqual([LOC_B_ROW])
    expect(JSON.stringify(json)).not.toContain(IDS.locA)
    expect(JSON.stringify(json)).not.toContain(IDS.nGc1)
  })
})

// ============================================
// 3) HARDENING — GET /api/gift-cards whitelist + no-store (R144-b)
// ============================================
describe('R144 #31: GET /api/gift-cards hardening (prava PGlite)', () => {
  it('Cache-Control no-store + whitelist: ključi vrstice TOČNO GIFT_CARD_SELECT + transactions (brez card-level createdAt/updatedAt/payments), location omejen na {name, code}, tx 9-stolpčni kontrakt, Decimal → number', async () => {
    setSession('admin', IDS.locA, ['admin'])
    const res = await gcGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)
    // paginacijska oblika nespremenjena (konsumenti ječe {giftCards, total, limit, offset})
    expect(Object.keys(json).sort()).toEqual(['giftCards', 'limit', 'offset', 'total'])
    expect(json.total).toBe(7) // dedikirana locA: aA1..aA7 (audit delavnica je na locD)

    const rows = json.giftCards as Array<Record<string, unknown>>
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(GC_ROW_KEYS)
      expect(Object.keys(row.location as Record<string, unknown>).sort()).toEqual(GC_LOCATION_KEYS)
      expect(typeof row.balance).toBe('number')
      expect(typeof row.initialBalance).toBe('number')
      expect(row.locationId).toBe(IDS.locA)
    }
    // EXACT vrednosti treh representativnih vrstic (active + expiring + expired)
    const aA1 = rows.find((r) => r.id === IDS.aA1) as Record<string, unknown>
    expect(aA1).toMatchObject({ cardNumber: CARD_NO_A1, balance: 50, initialBalance: 50, status: 'active', location: { name: LOC_A_NAME, code: `${RUN_ID}-A` } })
    const aA5 = rows.find((r) => r.id === IDS.aA5) as Record<string, unknown>
    expect(aA5).toMatchObject({ status: 'active', balance: 25 })
    expect(new Date(aA5.expiresAt as string).getTime()).toBe(SOON.getTime())
    const aA4 = rows.find((r) => r.id === IDS.aA4) as Record<string, unknown>
    expect(aA4.expiresAt).toBeNull() // brez expiresAt → null (ne izmišljen datum)

    // izpuščena polja res ne uhajajo (dvojni assertion na surovem JSON-u)
    const raw = JSON.stringify(json)
    expect(raw).not.toContain('updatedAt')
    expect(raw).not.toContain('payments')

    // tx whitelist pin na kartici z LEDGER vrstico (locD end-state po audit bloku:
    // aD1 nosi točno 1 auto-load tx iz PUT +25) — locD admin GET
    setSession('admin', IDS.locD, ['admin'])
    const resD = await gcGet()
    expect(resD.status).toBe(200)
    const jsonD = await asJson(resD)
    expect(jsonD.total).toBe(7) // aD1..aD5 + aDdup + aDnew (aDdel je izbrisan)
    const rowsD = jsonD.giftCards as Array<Record<string, unknown>>
    const aD1 = rowsD.find((r) => r.id === IDS.aD1) as Record<string, unknown>
    const txsD = aD1.transactions as Array<Record<string, unknown>>
    expect(txsD).toHaveLength(1)
    expect(Object.keys(txsD[0] as Record<string, unknown>).sort()).toEqual(GC_TX_KEYS)
    expect(txsD[0]).toMatchObject({ type: 'load', amount: 25, balanceAfter: 75, note: 'Nalaganje sredstev' })
  })

  it('?status=active filter (cross-check z DB count) + ?cardNumber= SCOPED lookup + scope: locA admin NIKOLI ne vidi locB/locD/null kartic', async () => {
    setSession('admin', IDS.locA, ['admin'])

    // ?status=active — cross-check z realnim DB count za isto where
    const resActive = await gcGet('?status=active')
    expect(resActive.status).toBe(200)
    const jsonActive = await asJson(resActive)
    const dbActive = await db.giftCard.findMany({ where: { locationId: IDS.locA, status: 'active' }, select: { id: true } })
    expect(jsonActive.total).toBe(dbActive.length)
    expect((jsonActive.giftCards as Array<Record<string, unknown>>).map((r) => r.id).sort()).toEqual(dbActive.map((r) => r.id).sort())
    expect(jsonActive.total).toBe(3) // aA1, aA5, aA7

    // ?cardNumber= — checkout lookup pot, SCOPED: svoja kartica → 1 zadetek,
    // tuja (locD) kartica po številki → 0 zadetkov (lookup ne razkriva tujih)
    const resLookup = await gcGet(`?cardNumber=${CARD_NO_A1}`)
    expect(resLookup.status).toBe(200)
    const jsonLookup = await asJson(resLookup)
    expect(jsonLookup.total).toBe(1)
    expect((jsonLookup.giftCards as Array<Record<string, unknown>>)[0]?.id).toBe(IDS.aA1)

    const resForeign = await gcGet(`?cardNumber=${CARD_NO_L1}`)
    expect(resForeign.status).toBe(200)
    expect((await asJson(resForeign)).total).toBe(0)

    // scope: tuja (locB), delavnica (locD) in null-location kartica ne uhajajo
    const resAll = await gcGet()
    const raw = JSON.stringify(await asJson(resAll))
    expect(raw).not.toContain(IDS.bB1)
    expect(raw).not.toContain(CARD_NO_B1)
    expect(raw).not.toContain(IDS.aD1)
    expect(raw).not.toContain(IDS.nGc1)
    expect(raw).not.toContain(CARD_NO_NULL)
  })
})

// ============================================
// 4) ZERO-ORACLE + P2002 (R80/R103 kanon)
// ============================================
describe('R144 #31: zero-oracle 404 + P2002 409 (prava PGlite)', () => {
  it('PUT/DELETE tuja kartica (locB) ≡ neobstoječ id → 404 z IDENTIČNIM telesom notInScopeResponse("Darilna kartica"); zero audit sledi, tuja kartica nedotaknjena', async () => {
    setSession('admin', IDS.locA, ['admin'])

    const putForeign = await gcPut({ balance: 1 }, IDS.bB1)
    const putMissing = await gcPut({ balance: 1 }, IDS.missing)
    expect(putForeign.status).toBe(404)
    expect(putMissing.status).toBe(404)
    const putForeignBody = await asJson(putForeign)
    const putMissingBody = await asJson(putMissing)
    expect(putForeignBody).toEqual(putMissingBody) // zero-oracle: tuja ≡ neobstoječa
    // EXACT telo notInScopeResponse('Darilna kartica') — pred R144-d fixom je bil
    // nonexistent pre-check hardcoded 'ni najdena' (1-znakovni ID-enumeration oracle)
    expect(putMissingBody.error).toBe('Darilna kartica ni najden')

    const delForeign = await gcDelete(IDS.bB1)
    const delMissing = await gcDelete(IDS.missing)
    expect(delForeign.status).toBe(404)
    expect(delMissing.status).toBe(404)
    expect(await asJson(delForeign)).toEqual(await asJson(delMissing))

    // forenzika: zero-oracle NIČ ne piše (brez audit vrstic, brez mutacij)
    expect(await myAuditRows(IDS.bB1)).toHaveLength(0)
    const b1 = await db.giftCard.findUnique({ where: { id: IDS.bB1 } })
    expect(b1).not.toBeNull()
    expect(Number(b1?.balance ?? -1)).toBe(100)
  })

  it('DELETE z take_orders sejo → 403 (admin kanon za brisanje denarne entitete); kartica ostane', async () => {
    setSession('take_orders', IDS.locA, ['take_orders'])
    const res = await gcDelete(IDS.bB1)
    expect(res.status).toBe(403)
    expect((await asJson(res)).error).toBe('Nimate dovoljenja za to operacijo.')
    expect(await db.giftCard.findUnique({ where: { id: IDS.bB1 } })).not.toBeNull()
  })

  it('POST duplikat cardNumber → 409 P2002 { error: "Darilna kartica s to številko že obstaja" }; DB vsebuje točno 1 kartico s to številko', async () => {
    setSession('admin', IDS.locD, ['admin'])
    expect(await db.giftCard.count({ where: { cardNumber: CARD_NO_DUP } })).toBe(1) // aDdup seedan direktno prek Prisme

    const res = await gcPost({ cardNumber: CARD_NO_DUP, balance: 5, ownerName: `R144 Duplikat API ${RUN_ID}` })
    expect(res.status).toBe(409)
    expect(await asJson(res)).toEqual({ error: 'Darilna kartica s to številko že obstaja' })

    expect(await db.giftCard.count({ where: { cardNumber: CARD_NO_DUP } })).toBe(1)
  })
})
