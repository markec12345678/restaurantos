// @vitest-environment node
// ============================================
// R143 / EPIC #115 #30 — INTEGRACIJA: LOYALTY / CUSTOMER LIFECYCLE
// ============================================
// GET /api/loyalty/lifecycle (NOVO R143-b) + GET /api/loyalty?search (R143-b
// fix (a)) + POST /api/loyalty-automation akciji expiry_notify (notify-only)
// IN birthday_batch (Guest soft-join fix — denar+SMS) na pravi bazi (PGlite,
// izoliran PGLITE_DATA_DIR=/tmp/pglite-data-it). R143 je ZERO migration →
// /tmp/pglite-data-it NE rabi migracij (migracije ustavljene na 0021).
//
// Kontrakt R143-a/R143-b:
//   GET /api/loyalty/lifecycle:
//     • requireAuth view_reports + resolveTenantLocationIdOrThrow (fail-closed;
//       lokacijska seja AVTORITATIVNA; super-admin brez ?locationId = null
//       scope = globalni pogled, super-admin Z ?locationId = usmerjen pogled)
//     • 5 sekcij, vsaka s svojim .catch → nevtralni fallback (briefing kanon):
//       totals{active,inactive60d}, byTier{bronze,silver,gold,platinum — vsi
//       štirje VEDNO prisotni}, lifecycleBuckets{new,active,at_risk,churned —
//       iz REALnih LoyaltyTransaction.createdAt}, expiringSoon30d{points,
//       accounts,capped,scanned — FIFO približek: max(0, balance − Σ earn ≥
//       now−335d)}, topAccounts top 5 po pointsBalance — PII whitelist
//       (id, customerName, tier, pointsBalance, lifetimePoints, tierProgress)
//     • Cache-Control: no-store; bucket 'loyalty-lifecycle'
//   GET /api/loyalty (R143-b fix (a)):
//     • `search` je prej bil parsan a IGNORIRAN → zdaj OR contains
//       (insensitive) na customerName/customerPhone/customerEmail, KOMPOZIBILNO
//       z tier/isActive/customerPhone in scope-om; no-store
//     • PII HONEST PIN: ruta vrača POLNE Prisma vrstice (customerPhone/
//       customerEmail VKLJUČENO) TUDI po R143 — to je prejšnje (pred-R143)
//       obnašanje, ki ga test pina 1:1 (search fix ne sme spremeniti shape-a)
//   POST /api/loyalty-automation (requireAuth ADMIN — kanon):
//     • action 'expiry_notify' → NOTIFY-ONLY povzetek {processed,
//       accountsExpiring, expiringPoints, capped, notifyOnly:true} — ZERO
//       'expire' zapisov, ZERO balans sprememb, ZERO SMS/outbox
//     • action 'birthday_batch' → Guest soft-join po telefonu
//       (LoyaltyAccount.customerPhone → Guest.phone, guest.locationId ===
//       account.locationId ALI null) + isBirthdayToday (mesec/dan v LJ času):
//       podeli 100 točk (BIRTHDAY_BONUS_POINTS) SAMO današnjim rojstnikom,
//       števec skippedNoBirthday za ostale; counters štejejo DEJANSKE
//       podelitve (R143-b deviation 1); idempotenca awardDailyBonusOnce
//       (advisory lock + Serializable + tx-fresh re-check, R111) nespremenjena;
//       SMS = 1 OutboxEvent (target 'sms', eventType 'loyalty_birthday_bonus',
//       idempotencyKey per-day) ŠELE po commitu
//
// RATE LIMIT BUDŽET: bucketa 'loyalty' in 'loyalty-lifecycle' (oba
// AUTHENTICATED_LIMIT 120/min/IP, ločena števca) — ta datoteka porabi ~21 GET
// klicev (12 lifecycle + 9 search). POST /api/loyalty-automation NIMA rate
// limiterja (ruta ga ne kliče). 429 NI testiran v integraciji — unit pokritost
// (tests/unit/api/r143-loyalty.test.ts, test 'rate limit exceed → 429') —
// budžet ostaja udoben tudi pri ponovljenih zagonih (okno 1 min).
//
// SEED STRATEGIJA (r141/r142 kanon): 4 DEDIKIRANE lokacije z RUN_ID markeri →
//   locA  = scope izolacija + search fixture (4 računi: 3 aktivni + 1 neaktivni)
//   locB  = tuja lokacija (1 aktiven račun)
//   locC  = lifecycle agregat fixture (16 aktivnih računov z REALNIMI
//           LoyaltyTransaction datumi → vsi števci na locC so EXACT)
//   locBD = birthday batch fixture (3 računi + 2 gosta)
//   + 1 račun z locationId NULL (samo super-admin ga vidi)
// Baseline števci (aktivni, byTier, bucketi, expiring, max balance) so zajeti
// PRED seedom → super-admin trditve so baseline+delta exact (imune na fixture
// drift drugih runov, r141/r142 vzorec).
//
// Fixture tabela (locC — EXACT števci izračunani izpod):
//   račun     tier      balance  zadnja tx      bucket    expiring
//   cBz       bronze    0        brez           new       0
//   cSv       silver    0        brez           new       0
//   cGd       gold      0        brez           new       0
//   cPt       platinum  0        brez           new       0
//   cNew      bronze    0        brez           new       0
//   cAct      bronze    50       10 dni nazaj   active    0 (50−50, earn v oknu)
//   cRisk     silver    80       100 dni nazaj  at_risk   0 (80−80, earn v oknu)
//   cChurn    gold      120      200 dni nazaj  churned   0 (120−120, earn v oknu)
//   cExp1     bronze    500      200 dni nazaj  churned   200 (500−300: earn 200d je V 335d oknu)
//   cExp2     bronze    100      danes          active    0 (max(0, 100−300))
//   cOld      bronze    400      400 dni nazaj  churned   400 (earn 400d je ZUNAJ 335d okna — NE odšteje!)
//   cT1..cT5  pt/gd/sv/gd/sv  5000/3000/1500/900/600  danes  active  0 (pokriti z earn v oknu)
//   → totals {active 16, inactive60d 9}, byTier {bronze 6, silver 4, gold 4,
//     platinum 2}, buckets {new 5, active 7, at_risk 1, churned 3},
//     expiring {points 600, accounts 2, capped false, scanned 16}
//
// POMEMBNO O VRSTNEM REDU: testi tečejo deklaracijsko — vsi lifecycle/search/
// expiry_notify testi (read-only) tečejo PRED birthday_batch POST-i, ki
// podelijo 100 točk bd1 (spremenita njegov balance in bucket) → baseline+delta
// trditve super-admina ostanejo veljavne.
//
// SMS POVRŠINA (honestno): v testnem okolju SMS_PROVIDER ni nastavljen →
// sendSms() je no-op (isSmsConfigured() false, samo logger.warn, BREZ omrežja)
// → pošten queued surface = OutboxEvent vrstica (status 'pending').
//
// SEJE: ročno konstruirana PIN seja (r137/r140/r141/r142 kanon) — requireAuth
// je nadomeščen z mockom, ki deluje v moji seji IZ authRef in PONOVNO UPORABI
// realen hasPermission (auth-middleware/permissions) za permission gate →
// 401 brez seje / 403 brez dovoljenja sta 1:1 z realnim middleware telesom
// ('Nimate dovoljenja za to operacijo.'). resolveTenantLocationIdOrThrow
// ostane REALEN (tenant scope testiran v praksi na pravi bazi). AuditLog se
// NE piše (vse testirane rute so read-only oz. pišejo samo LoyaltyTransaction/
// OutboxEvent/logger) → afterAll nima audit čiščenja (r142 vzorec).
//
// Zagon: bunx vitest run tests/integration/r143-loyalty.test.ts \
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

// ISTI vzorec kot r137/r140/r141/r142: realen auth-middleware (importOriginal
// spread — resolveTenantLocationIdOrThrow ostane REALEN), samo requireAuth
// nadomesti z ročno konstruirano PIN sejo. Razlika proti r142: mock UPORABI
// realen hasPermission (iz auth-middleware/permissions) za opts.permission
// gate, da je 403 kanon loyalty-automation (requireAuth admin) testiran v
// praksi — enako telo kot realni middleware ('Nimate dovoljenja …', 403).
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
import { GET as lifecycleGET } from '@/app/api/loyalty/lifecycle/route'
import { GET as loyaltyGET } from '@/app/api/loyalty/route'
import { POST as automationPOST } from '@/app/api/loyalty-automation/route'
import { computeExpiringPoints } from '@/lib/loyalty/lifecycle'
import { lifecycleBucketForDays } from '@/lib/loyalty/lifecycle-constants'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'

const RUN_ID = `r143-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const DAY_MS = 86_400_000
const NOW = new Date()
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS)

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  locC: `${RUN_ID}-loc-c`,
  locBD: `${RUN_ID}-loc-bd`,
  // locA — scope izolacija + search
  aAna: `${RUN_ID}-a-ana`,
  aBorut: `${RUN_ID}-a-borut`,
  aCvetka: `${RUN_ID}-a-cvetka`,
  aDarko: `${RUN_ID}-a-darko`,
  // locB — tuja lokacija
  bEma: `${RUN_ID}-b-ema`,
  // null lokacija — samo super-admin
  nGost: `${RUN_ID}-n-gost`,
  // locC — lifecycle agregat fixture
  cBz: `${RUN_ID}-c-bz`,
  cSv: `${RUN_ID}-c-sv`,
  cGd: `${RUN_ID}-c-gd`,
  cPt: `${RUN_ID}-c-pt`,
  cNew: `${RUN_ID}-c-new`,
  cAct: `${RUN_ID}-c-act`,
  cRisk: `${RUN_ID}-c-risk`,
  cChurn: `${RUN_ID}-c-churn`,
  cExp1: `${RUN_ID}-c-exp1`,
  cExp2: `${RUN_ID}-c-exp2`,
  cOld: `${RUN_ID}-c-old`,
  cT1: `${RUN_ID}-c-t1`,
  cT2: `${RUN_ID}-c-t2`,
  cT3: `${RUN_ID}-c-t3`,
  cT4: `${RUN_ID}-c-t4`,
  cT5: `${RUN_ID}-c-t5`,
  // locBD — birthday batch
  bd1: `${RUN_ID}-bd-a1`,
  bd2: `${RUN_ID}-bd-a2`,
  bd3: `${RUN_ID}-bd-a3`,
}

const LOC_IDS = [IDS.locA, IDS.locB, IDS.locC, IDS.locBD]

interface AccFixture {
  id: string
  name: string
  phone: string
  email?: string
  tier: string
  active: boolean
  balance: number
  lifetime: number
  locationId: string | null
}

const acc = (
  id: string,
  name: string,
  tier: string,
  opts?: Partial<Omit<AccFixture, 'id' | 'name'>>,
): AccFixture => ({
  id,
  name: `R143 ${name} ${RUN_ID}`,
  phone: `${RUN_ID}-ph-${id.slice(RUN_ID.length + 1)}`,
  tier,
  active: true,
  balance: 0,
  lifetime: 0,
  locationId: IDS.locA,
  ...opts,
})

// 25 računov (glej fixture tabelo v headerju)
const ACCOUNTS: AccFixture[] = [
  // locA — search + scope (3 aktivni + 1 neaktivni)
  acc(IDS.aAna, 'Ana Golob', 'bronze', { balance: 10, lifetime: 10, email: `${RUN_ID}-mail-ana@test.local` }),
  acc(IDS.aBorut, 'Borut Kvart', 'silver', { email: `${RUN_ID}-mail-borut@test.local` }),
  acc(IDS.aCvetka, 'Cvetka Zadnik', 'bronze', { email: `${RUN_ID}-mail-cvetka@test.local` }),
  acc(IDS.aDarko, 'Darko Mirni', 'bronze', { active: false, email: `${RUN_ID}-mail-darko@test.local` }),
  // locB — tuja lokacija
  acc(IDS.bEma, 'Ema Novak', 'bronze', { locationId: IDS.locB }),
  // null lokacija — samo super-admin
  acc(IDS.nGost, 'Globalni Gost', 'bronze', { locationId: null }),
  // locC — lifecycle agregat (16 aktivnih)
  acc(IDS.cBz, 'Bronze Novinec', 'bronze', { locationId: IDS.locC }),
  acc(IDS.cSv, 'Silver Novinec', 'silver', { locationId: IDS.locC }),
  acc(IDS.cGd, 'Gold Novinec', 'gold', { locationId: IDS.locC }),
  acc(IDS.cPt, 'Platinum Novinec', 'platinum', { locationId: IDS.locC }),
  acc(IDS.cNew, 'Brez Transakcij', 'bronze', { locationId: IDS.locC }),
  acc(IDS.cAct, 'Aktiven Kratek', 'bronze', { locationId: IDS.locC, balance: 50, lifetime: 50 }),
  acc(IDS.cRisk, 'Ogrozen Srednji', 'silver', { locationId: IDS.locC, balance: 80, lifetime: 80 }),
  acc(IDS.cChurn, 'Izgubljen Dolg', 'gold', { locationId: IDS.locC, balance: 120, lifetime: 120 }),
  acc(IDS.cExp1, 'Poteceni Glavni', 'bronze', { locationId: IDS.locC, balance: 500, lifetime: 500 }),
  acc(IDS.cExp2, 'Pokrit Earn', 'bronze', { locationId: IDS.locC, balance: 100, lifetime: 100 }),
  acc(IDS.cOld, 'Zunaj Okna', 'bronze', { locationId: IDS.locC, balance: 400, lifetime: 400 }),
  acc(IDS.cT1, 'Top Platinum', 'platinum', { locationId: IDS.locC, balance: 5000, lifetime: 5000 }),
  acc(IDS.cT2, 'Top Gold', 'gold', { locationId: IDS.locC, balance: 3000, lifetime: 3000 }),
  acc(IDS.cT3, 'Top Silver', 'silver', { locationId: IDS.locC, balance: 1500, lifetime: 1500 }),
  acc(IDS.cT4, 'Top Gold Mali', 'gold', { locationId: IDS.locC, balance: 900, lifetime: 900 }),
  acc(IDS.cT5, 'Top Silver Mali', 'silver', { locationId: IDS.locC, balance: 600, lifetime: 600 }),
  // locBD — birthday batch (3 aktivni)
  acc(IDS.bd1, 'Rojstnik A1', 'bronze', { locationId: IDS.locBD }),
  acc(IDS.bd2, 'Nerojstnik A2', 'bronze', { locationId: IDS.locBD }),
  acc(IDS.bd3, 'Brez Gosta A3', 'bronze', { locationId: IDS.locBD }),
]

const ALL_ACCOUNT_IDS = ACCOUNTS.map((a) => a.id)
const ALL_PHONES = ACCOUNTS.map((a) => a.phone)
const ALL_EMAILS = ACCOUNTS.filter((a) => a.email).map((a) => a.email as string)
const PII_SUBSTRINGS = [...ALL_PHONES, ...ALL_EMAILS]

const PHONE_BD1 = ACCOUNTS.find((a) => a.id === IDS.bd1)!.phone
const NAME_BD1 = ACCOUNTS.find((a) => a.id === IDS.bd1)!.name
const PHONE_ANA = ACCOUNTS.find((a) => a.id === IDS.aAna)!.phone

// LoyaltyTransaction z EKPLICITNIMI createdAt (REALNI datumi so THE ključna
// integracijska lastnost — bucketi/expiring so izračunani iz njih). Prisma
// dopušča pisanje createdAt na create (@default, NE @updatedAt) — verify:
// probe na /tmp/pglite-data-it je potrdil 'EXPLICIT createdAt on create: OK'.
const TRANSACTIONS = [
  { loyaltyAccountId: IDS.aAna, type: 'earn', points: 10, reason: 'Nakup', monetaryValue: 12.5, createdAt: daysAgo(0) },
  { loyaltyAccountId: IDS.cAct, type: 'earn', points: 50, reason: 'Nakup', monetaryValue: 5, createdAt: daysAgo(10) },
  { loyaltyAccountId: IDS.cRisk, type: 'earn', points: 80, reason: 'Nakup', monetaryValue: 8, createdAt: daysAgo(100) },
  { loyaltyAccountId: IDS.cChurn, type: 'earn', points: 120, reason: 'Nakup', monetaryValue: 12, createdAt: daysAgo(200) },
  { loyaltyAccountId: IDS.cExp1, type: 'earn', points: 300, reason: 'Nakup', monetaryValue: 30, createdAt: daysAgo(200) },
  { loyaltyAccountId: IDS.cExp2, type: 'earn', points: 300, reason: 'Nakup', monetaryValue: 30, createdAt: daysAgo(0) },
  // earn 400 dni nazaj = ZUNAJ 335d okna → FIFO približek ga NE odšteje
  { loyaltyAccountId: IDS.cOld, type: 'earn', points: 100, reason: 'Nakup', monetaryValue: 10, createdAt: daysAgo(400) },
  { loyaltyAccountId: IDS.cT1, type: 'earn', points: 5000, reason: 'Nakup', monetaryValue: 0, createdAt: daysAgo(0) },
  { loyaltyAccountId: IDS.cT2, type: 'earn', points: 3000, reason: 'Nakup', monetaryValue: 0, createdAt: daysAgo(0) },
  { loyaltyAccountId: IDS.cT3, type: 'earn', points: 1500, reason: 'Nakup', monetaryValue: 0, createdAt: daysAgo(0) },
  { loyaltyAccountId: IDS.cT4, type: 'earn', points: 900, reason: 'Nakup', monetaryValue: 0, createdAt: daysAgo(0) },
  { loyaltyAccountId: IDS.cT5, type: 'earn', points: 600, reason: 'Nakup', monetaryValue: 0, createdAt: daysAgo(0) },
]

// Rojstni dnevi — DANES po LJ (Europe/Ljubljana) vs. danes+100 dni (leto ni
// pomembno; isBirthdayToday primerja SAMO mesec/dan). Date-only konstrukt →
// UTC polnoč → Prisma shrani 1:1, isBirthdayToday bere UTC dele
// (deterministična izbira, dokumentirana v lib/loyalty/birthday).
const LJ_TODAY = ljubljanaTodayStr(new Date()) // 'YYYY-MM-DD'
const LJ_PLUS_100 = ljubljanaTodayStr(new Date(Date.now() + 100 * DAY_MS))
const BIRTHDAY_TODAY = new Date(`1990-${LJ_TODAY.slice(5, 7)}-${LJ_TODAY.slice(8, 10)}T00:00:00.000Z`)
const BIRTHDAY_PLUS_100 = new Date(`1990-${LJ_PLUS_100.slice(5, 7)}-${LJ_PLUS_100.slice(8, 10)}T00:00:00.000Z`)

// ---------- Baseline (PRED seedom — imuno na fixture drift, r141/r142) ----------
let baselineActive = 0
let baselineInactive60dCount = 0
let baselineMaxBalance = 0
let baselineExpiringPoints = 0
let baselineExpiringAccounts = 0
let baselineByTier: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 }
let baselineBuckets: Record<string, number> = { new: 0, active: 0, at_risk: 0, churned: 0 }

// Delta lastnih fixture (glej tabelo v headerju; vsota = 24 aktivnih:
// locA 3 + locB 1 + locC 16 + locBD 3 + null 1)
const MY_DELTA = {
  active: 24,
  inactive60d: 16, // locA 2 + locB 1 + null 1 + locC 9 + locBD 3
  byTier: { bronze: 13, silver: 5, gold: 4, platinum: 2 },
  buckets: { new: 12, active: 8, at_risk: 1, churned: 3 },
}
const MY_EXPIRING = { points: 600, accounts: 2 } // samo cExp1 (200) + cOld (400)

// locC EXACT števci (dedicated lokacija → brez drifta)
const LOC_C = {
  totals: { active: 16, inactive60d: 9 },
  byTier: { bronze: 6, silver: 4, gold: 4, platinum: 2 },
  buckets: { new: 5, active: 7, at_risk: 1, churned: 3 },
  expiring: { points: 600, accounts: 2, capped: false, scanned: 16 },
}

// locA EXACT števci (3 aktivni: ana z tx danes, borut/cvetka brez tx)
const LOC_A = {
  totals: { active: 3, inactive60d: 2 },
  byTier: { bronze: 2, silver: 1, gold: 0, platinum: 0 },
  buckets: { new: 2, active: 1, at_risk: 0, churned: 0 },
  expiring: { points: 0, accounts: 0, capped: false, scanned: 3 },
}

// Whitelist kontrakt topAccounts vrstice (5 polj + tierProgress)
const TOP_ROW_KEYS = ['customerName', 'id', 'lifetimePoints', 'pointsBalance', 'tier', 'tierProgress'].sort()
const TIER_PROGRESS_KEYS = ['current', 'lifetimePoints', 'next', 'nextThreshold', 'pointsToNext', 'progressPct'].sort()

// HONEST PIN GET /api/loyalty: polna Prisma vrstica (route NE select-a) +
// include transactions (10 zadnjih) — customerPhone/customerEmail STA del
// pred-R143 oblike (search fix ne sme spremeniti shape-a).
const LOYALTY_ROW_KEYS = [
  'createdAt', 'customerEmail', 'customerName', 'customerPhone', 'id', 'isActive',
  'lifetimePoints', 'locationId', 'pointsBalance', 'tier', 'transactions', 'updatedAt',
].sort()
const LOYALTY_TX_KEYS = [
  'checkId', 'createdAt', 'id', 'loyaltyAccountId', 'monetaryValue', 'orderId',
  'points', 'reason', 'type',
].sort()

// ---------- Pomožniki ----------
async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function lifecycleGet(query = ''): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return lifecycleGET(new Request(`http://localhost/api/loyalty/lifecycle${query}`))
}

function loyaltyGet(query = ''): Promise<Response> {
  return loyaltyGET(new Request(`http://localhost/api/loyalty${query}`))
}

function automationPost(body: unknown): Promise<Response> {
  return automationPOST(
    new Request('http://localhost/api/loyalty-automation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function setSession(role: string, locationId: string | null, permissions: string[]) {
  authRef.current = { employeeId: `emp-${RUN_ID}`, role, locationId, permissions }
}

// Isti izračun kot fetchBuckets v ruti (bucketi iz REALnih tx datumov) —
// uporablja kanonski lifecycleBucketForDays (enoten vir, lib/lifecycle-constants)
// za baseline snapshot PRED seedom.
async function snapshotBuckets(): Promise<Record<string, number>> {
  const accounts = await db.loyaltyAccount.findMany({ where: { isActive: true }, select: { id: true } })
  const lastTxRows = await db.loyaltyTransaction.groupBy({
    by: ['loyaltyAccountId'],
    where: { loyaltyAccountId: { in: accounts.map((a) => a.id) } },
    _max: { createdAt: true },
  })
  const lastByAccount = new Map<string, Date | null>(lastTxRows.map((r) => [r.loyaltyAccountId, r._max.createdAt]))
  const buckets: Record<string, number> = { new: 0, active: 0, at_risk: 0, churned: 0 }
  for (const a of accounts) {
    const last = lastByAccount.get(a.id) ?? null
    buckets[lifecycleBucketForDays(last ? (Date.now() - last.getTime()) / DAY_MS : null)]++
  }
  return buckets
}

async function myExpireTxCount(): Promise<number> {
  return db.loyaltyTransaction.count({ where: { type: 'expire', loyaltyAccountId: { in: ALL_ACCOUNT_IDS } } })
}

async function myOutboxCount(): Promise<number> {
  return db.outboxEvent.count({
    where: { OR: [{ aggregateId: { in: ALL_ACCOUNT_IDS } }, { idempotencyKey: { contains: RUN_ID } }] },
  })
}

beforeAll(async () => {
  // 0) Baseline PRED lastnim seedom (super-admin trditve = baseline + delta)
  baselineActive = await db.loyaltyAccount.count({ where: { isActive: true } })
  // isti pomen 'inactive60d' kot fetchTotals v ruti (brez tx v 60 dneh, tudi brez VSEH)
  baselineInactive60dCount = await db.loyaltyAccount.count({
    where: { isActive: true, transactions: { none: { createdAt: { gte: new Date(NOW.getTime() - 60 * DAY_MS) } } } },
  })
  const maxAgg = await db.loyaltyAccount.aggregate({ _max: { pointsBalance: true } })
  baselineMaxBalance = maxAgg._max.pointsBalance ?? 0
  const tierRows = await db.loyaltyAccount.groupBy({
    by: ['tier'],
    where: { isActive: true },
    _count: { tier: true },
  })
  for (const r of tierRows) baselineByTier[r.tier] = r._count.tier
  baselineBuckets = await snapshotBuckets()
  // baseline FIFO expiring prispevek (skupni vir z ruto — lib/loyalty/lifecycle)
  const baseExp = await computeExpiringPoints(null, NOW)
  baselineExpiringPoints = baseExp.points
  baselineExpiringAccounts = baseExp.accounts

  // 1) Štiri dedikirane lokacije
  await db.location.create({ data: { id: IDS.locA, code: `${RUN_ID}-A`, name: `R143 Glavna ${RUN_ID}`, premisesId: `${RUN_ID}-pA`, isActive: true } })
  await db.location.create({ data: { id: IDS.locB, code: `${RUN_ID}-B`, name: `R143 Filiala ${RUN_ID}`, premisesId: `${RUN_ID}-pB`, isActive: true } })
  await db.location.create({ data: { id: IDS.locC, code: `${RUN_ID}-C`, name: `R143 Lifecycle ${RUN_ID}`, premisesId: `${RUN_ID}-pC`, isActive: true } })
  await db.location.create({ data: { id: IDS.locBD, code: `${RUN_ID}-BD`, name: `R143 Rojstni ${RUN_ID}`, premisesId: `${RUN_ID}-pBD`, isActive: true } })

  // 2) Računi (25) — eksplicitni tier/balance/isActive/locationId
  await db.loyaltyAccount.createMany({
    data: ACCOUNTS.map((a) => ({
      id: a.id,
      customerName: a.name,
      customerPhone: a.phone,
      customerEmail: a.email ?? '',
      pointsBalance: a.balance,
      lifetimePoints: a.lifetime,
      tier: a.tier,
      isActive: a.active,
      locationId: a.locationId,
    })),
  })

  // 3) Transakcije z REALNimi datumi (bucketi + FIFO expiring)
  await db.loyaltyTransaction.createMany({ data: TRANSACTIONS })

  // 4) Gosti za birthday soft-join (lastName je obvezen; phone = ključ soft-joina)
  await db.guest.createMany({
    data: [
      { lastName: `R143 Gost A1 ${RUN_ID}`, phone: PHONE_BD1, locationId: IDS.locBD, birthday: BIRTHDAY_TODAY },
      {
        lastName: `R143 Gost A2 ${RUN_ID}`,
        phone: ACCOUNTS.find((a) => a.id === IDS.bd2)!.phone,
        locationId: IDS.locBD,
        birthday: BIRTHDAY_PLUS_100,
      },
    ],
  })
}, 60_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  setSession('admin', IDS.locA, ['admin'])
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (r142 kanon):
  //   1) outbox eventi (aggregateId/idempotencyKey po RUN_ID — brez FK, a prvi),
  //   2) LoyaltyTransaction (FK Restrict na LoyaltyAccount — MORA pred računi),
  //   3) LoyaltyAccount,
  //   4) Guest (soft-join po telefonu; loyaltyAccountId ni bil nastavljen),
  //   5) lokacije (LoyaltyAccount.locationId FK SetNull, a računi so že gone).
  // AuditLog se NE piše (nobena testirana ruta ne piše audita); seje niso
  // ustvarjene (ročna seja brez DB vrstice).
  await db.outboxEvent.deleteMany({
    where: { OR: [{ aggregateId: { in: ALL_ACCOUNT_IDS } }, { idempotencyKey: { contains: RUN_ID } }] },
  }).catch(() => {})
  await db.loyaltyTransaction.deleteMany({ where: { loyaltyAccountId: { in: ALL_ACCOUNT_IDS } } }).catch(() => {})
  await db.loyaltyAccount.deleteMany({ where: { id: { in: ALL_ACCOUNT_IDS } } }).catch(() => {})
  await db.guest.deleteMany({ where: { phone: { contains: RUN_ID } } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})
  await db.$disconnect().catch(() => {})
}, 60_000)

// ============================================
// 1) GET /api/loyalty/lifecycle
// ============================================
describe('R143 #30: GET /api/loyalty/lifecycle (prava PGlite)', () => {
  it('GET 401 fail-closed: brez seje IN z garbage Bearerjem — nikoli scope uhajanje', async () => {
    authRef.current = null
    const resNone = await lifecycleGet()
    expect(resNone.status).toBe(401)
    const jsonNone = await asJson(resNone)
    expect(typeof jsonNone.error).toBe('string')

    // garbage Bearer — requireAuth faila enako (fail-closed; token validacija
    // je enota r137 kanona — ruta MORA samo prenesti error 1:1)
    const resGarbage = await lifecycleGet()
    expect(resGarbage.status).toBe(401)
    expect(typeof (await asJson(resGarbage)).error).toBe('string')
  })

  it('GET scope: lokacijski admin A vidi TOČNO svoje 3 aktivne račune — tuja, null-location in neaktivni ne uhajajo (counts exact + PII)', async () => {
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)

    // EXACT locA števci (dedicated lokacija — brez drifta)
    expect(json.totals).toEqual(LOC_A.totals)
    expect(json.byTier).toEqual(LOC_A.byTier)
    expect(json.lifecycleBuckets).toEqual(LOC_A.buckets)
    expect(json.expiringSoon30d).toEqual(LOC_A.expiring)

    // topAccounts: 3 vrstice (vse balance-0 razen ana 10) — ana je #1
    const top = json.topAccounts as Array<Record<string, unknown>>
    expect(top).toHaveLength(3)
    expect(top.map((r) => r.id)).toContain(IDS.aAna)
    expect(top[0]?.id).toBe(IDS.aAna)

    // tuja (locB), null-location in NEAKTIVNI (aDarko) račun ne uhajajo —
    // niti po ID-ju niti po vsebini; neaktivni je izključen iz scope (isActive:true)
    const raw = JSON.stringify(json)
    expect(raw).not.toContain(IDS.bEma)
    expect(raw).not.toContain(IDS.nGost)
    expect(raw).not.toContain(IDS.aDarko)

    // PII kanon: lifecycle agregat NIKOLI ne vsebuje telefonov/e-pošte
    // (dvojni assertion: ključi AND vrednosti)
    expect(raw).not.toContain('customerPhone')
    expect(raw).not.toContain('customerEmail')
    for (const pii of PII_SUBSTRINGS) expect(raw).not.toContain(pii)

    // generatedAt: ISO iz zdaj (±5 min)
    const generatedAt = new Date(json.generatedAt as string)
    expect(generatedAt.getTime()).toBeGreaterThan(Date.now() - 5 * 60_000)
  })

  it('GET super-admin: vse tri skope v enem odgovoru (baseline+delta exact: locA+locB+locC+locBD+null) + ?locationId usmerjen pogled', async () => {
    // super_admin nosi celoten permission set (pariteta realnega employeeja —
    // hasPermission NIKOLI ne uveljavi role 'super_admin' posebej: pogled je
    // samo na session.permissions; r142 mock je gate preskočil, ta ga drži 1:1)
    setSession('super_admin', null, ['admin', 'view_reports', 'take_orders'])

    // (a) Globalni pogled — EXACT baseline+delta (24 aktivnih mojih računov)
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.totals).toEqual({
      active: baselineActive + MY_DELTA.active,
      inactive60d: baselineInactive60dCount + MY_DELTA.inactive60d,
    })
    expect(json.byTier).toEqual({
      bronze: (baselineByTier.bronze ?? 0) + MY_DELTA.byTier.bronze,
      silver: (baselineByTier.silver ?? 0) + MY_DELTA.byTier.silver,
      gold: (baselineByTier.gold ?? 0) + MY_DELTA.byTier.gold,
      platinum: (baselineByTier.platinum ?? 0) + MY_DELTA.byTier.platinum,
    })
    expect(json.lifecycleBuckets).toEqual({
      new: (baselineBuckets.new ?? 0) + MY_DELTA.buckets.new,
      active: (baselineBuckets.active ?? 0) + MY_DELTA.buckets.active,
      at_risk: (baselineBuckets.at_risk ?? 0) + MY_DELTA.buckets.at_risk,
      churned: (baselineBuckets.churned ?? 0) + MY_DELTA.buckets.churned,
    })
    // FIFO expiring: baseline prispevek + moj 600/2; scanned = vsi aktivni
    // (baselineActive + 24 < LIFECYCLE_ACCOUNT_CAP 2000 → capped false)
    expect(json.expiringSoon30d).toEqual({
      points: baselineExpiringPoints + MY_EXPIRING.points,
      accounts: baselineExpiringAccounts + MY_EXPIRING.accounts,
      capped: false,
      scanned: baselineActive + MY_DELTA.active,
    })
    // null-location račun JE vključen v globalni pogled (numerično: count exact)
    // + PII kanon velja tudi za super-admina
    const raw = JSON.stringify(json)
    for (const pii of PII_SUBSTRINGS) expect(raw).not.toContain(pii)
    expect(raw).not.toContain('customerPhone')

    // (b) top 5 po pointsBalance: mojih 5 Top računov (5000..600), dokler
    //     baseline nima višjih balansov (trenutno IT DB loyalty = prazna)
    const top = json.topAccounts as Array<Record<string, unknown>>
    expect(top).toHaveLength(5)
    if (baselineMaxBalance < 5000) {
      expect(top.map((r) => r.id)).toEqual([IDS.cT1, IDS.cT2, IDS.cT3, IDS.cT4, IDS.cT5])
    } else {
      expect(top.some((r) => r.id === IDS.cT1)).toBe(true)
    }

    // (c) Super-admin Z ?locationId = usmerjen pogled na posamezno lokacijo:
    //     locB → TOČNO 1 račun (null-location NIKOLI v usmerjenem pogledu),
    //     locC → TOČNO 16 — vsi trije skopi so dosegljivi super-adminu po enega
    //     (lokacijska seja tega NE more, ker je NJENA lokacija avtoritativna)
    const resB = await lifecycleGet(`?locationId=${IDS.locB}`)
    expect(resB.status).toBe(200)
    const jsonB = await asJson(resB)
    expect(jsonB.totals).toEqual({ active: 1, inactive60d: 1 })
    expect((jsonB.topAccounts as Array<Record<string, unknown>>).map((r) => r.id)).toEqual([IDS.bEma])
    expect(JSON.stringify(jsonB)).not.toContain(IDS.nGost)

    const resC = await lifecycleGet(`?locationId=${IDS.locC}`)
    expect(resC.status).toBe(200)
    const jsonC = await asJson(resC)
    expect((jsonC.totals as Record<string, number>).active).toBe(LOC_C.totals.active)
  })

  it('GET byTier na locC: vsi ŠTIRI nivoji vedno prisotni, števila exact (bronze 6, silver 4, gold 4, platinum 2)', async () => {
    setSession('admin', IDS.locC, ['admin'])
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    // vsi štirje ključi prisotni (literarni map kanon — neznane DB vrednosti
    // se ignorirajo, 0-defaulti pa ostanejo)
    expect(Object.keys(json.byTier as Record<string, number>).sort()).toEqual(['bronze', 'gold', 'platinum', 'silver'])
    expect(json.byTier).toEqual(LOC_C.byTier)
  })

  it('GET lifecycleBuckets iz REALnih tx datumov: brez tx → new, 10d → active, 100d → at_risk, 200d/400d → churned (locC exact + totals)', async () => {
    setSession('admin', IDS.locC, ['admin'])
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    // 5 brez tx (cBz/cSv/cGd/cPt/cNew), 7 aktivnih (≤60d: cAct 10d, cExp2 danes,
    // cT1..cT5 danes), 1 at_risk (61–180: cRisk 100d), 3 churned (>180:
    // cChurn 200d, cExp1 200d, cOld 400d)
    expect(json.lifecycleBuckets).toEqual(LOC_C.buckets)
    // totals: active = 16; inactive60d = brez tx v 60d (5 new + cRisk 100d +
    // cChurn 200d + cExp1 200d + cOld 400d = 9)
    expect(json.totals).toEqual(LOC_C.totals)
  })

  it('GET expiringSoon30d FIFO približek: earn V oknu (200d < 335d) odšteje (500−300=200), earn ZUNAJ okna (400d) NE (400−0=400); shape {points, accounts, capped, scanned}', async () => {
    setSession('admin', IDS.locC, ['admin'])
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    // cExp1: balance 500, earn 300 @ 200d (V 335d oknu) → 200 poteče
    // cOld:  balance 400, earn 100 @ 400d (ZUNAJ okna)  → 400 poteče
    // cExp2: balance 100, earn 300 v oknu → max(0, 100−300) = 0
    // ostali: balance 0 ali earn v oknu pokrije balance → 0
    expect(json.expiringSoon30d).toEqual(LOC_C.expiring)
    // štiri ključe shape kontrakta (capped=false — 16 << LIFECYCLE_ACCOUNT_CAP 2000)
    expect(Object.keys(json.expiringSoon30d as Record<string, unknown>).sort()).toEqual(['accounts', 'capped', 'points', 'scanned'])
  })

  it('GET topAccounts: TOČNO 6 ključev/vrstico (5 whitelist + tierProgress), order po pointsBalance desc, PII dvojni assertion (ključi + vrednosti)', async () => {
    setSession('admin', IDS.locC, ['admin'])
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    const json = await asJson(res)
    const top = json.topAccounts as Array<Record<string, unknown>>

    // top 5 po pointsBalance desc — cExp1 (500) je 6. in NE uhaja
    expect(top.map((r) => r.id)).toEqual([IDS.cT1, IDS.cT2, IDS.cT3, IDS.cT4, IDS.cT5])
    expect(top.map((r) => r.pointsBalance)).toEqual([5000, 3000, 1500, 900, 600])
    for (const row of top) {
      // TOČNO whitelist + tierProgress — nič več (brez telefona/e-pošte/audit stolpcev)
      expect(Object.keys(row).sort()).toEqual(TOP_ROW_KEYS)
      const tp = row.tierProgress as Record<string, unknown>
      expect(Object.keys(tp).sort()).toEqual(TIER_PROGRESS_KEYS)
    }

    // tierProgress iz kanonskega lib/loyalty-tiers (ročno dodeljen tier =
    // trenutni): cT1 platinum 5000 → 100 % zaključeno; cT2 gold 3000 →
    // naslednji platinum, manjka 2000, 33 % napredka
    expect(top[0]?.tierProgress).toEqual({ current: 'platinum', next: null, pointsToNext: null, progressPct: 100, nextThreshold: null, lifetimePoints: 5000 })
    expect(top[1]?.tierProgress).toEqual({ current: 'gold', next: 'platinum', pointsToNext: 2000, progressPct: 33, nextThreshold: 5000, lifetimePoints: 3000 })

    // PII dvojni assertion: ključi AND seeded vrednosti ne uhajajo nikjer
    const raw = JSON.stringify(json)
    expect(raw).not.toContain('customerPhone')
    expect(raw).not.toContain('customerEmail')
    for (const pii of PII_SUBSTRINGS) expect(raw).not.toContain(pii)
  })

  it('GET Cache-Control: no-store (živi podatki o točkah — nikoli cache-friendly)', async () => {
    const res = await lifecycleGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})

// ============================================
// 2) GET /api/loyalty?search (R143-b fix (a))
// ============================================
describe('R143 #30: GET /api/loyalty?search — OR contains fix (prava PGlite)', () => {
  it('search po delcu imena (case-insensitive contains) → SAMO ujemanja; GOLOB (velike) enako', async () => {
    const res = await loyaltyGet('?search=golob')
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.total).toBe(1)
    expect((json.accounts as Array<Record<string, unknown>>).map((a) => a.id)).toEqual([IDS.aAna])

    const resUpper = await loyaltyGet('?search=GOLOB')
    expect(resUpper.status).toBe(200)
    expect((await asJson(resUpper)).total).toBe(1)
  })

  it('search po delcu telefona IN delcu e-pošte → ujemanja (OR na vseh treh poljih)', async () => {
    const resPhone = await loyaltyGet('?search=ph-a-borut')
    expect(resPhone.status).toBe(200)
    const jsonPhone = await asJson(resPhone)
    expect(jsonPhone.total).toBe(1)
    expect((jsonPhone.accounts as Array<Record<string, unknown>>).map((a) => a.id)).toEqual([IDS.aBorut])

    const resMail = await loyaltyGet('?search=mail-cvetka')
    expect(resMail.status).toBe(200)
    const jsonMail = await asJson(resMail)
    expect(jsonMail.total).toBe(1)
    expect((jsonMail.accounts as Array<Record<string, unknown>>).map((a) => a.id)).toEqual([IDS.aCvetka])
  })

  it('search kompozibilen s tier filtrom → OBA filtra uporabljena (AND)', async () => {
    // ime ujema + tier ujema → zadetek
    const resHit = await loyaltyGet('?search=kvart&tier=silver')
    expect(resHit.status).toBe(200)
    const jsonHit = await asJson(resHit)
    expect(jsonHit.total).toBe(1)
    expect((jsonHit.accounts as Array<Record<string, unknown>>).map((a) => a.id)).toEqual([IDS.aBorut])

    // ime ujema, tier NE → prazno (filter je res AND, ne OR)
    const resMiss = await loyaltyGet('?search=golob&tier=silver')
    expect(resMiss.status).toBe(200)
    expect((await asJson(resMiss)).total).toBe(0)
  })

  it('brez search parametra → brez OR (nespremenjena oblika): vsi scoped računi VKLJUČNO z neaktivnim + no-store', async () => {
    const res = await loyaltyGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const json = await asJson(res)
    // brez isActive parametra ruta NE filtrira statusa (honestna semantika) —
    // 4 računi na locA (3 aktivni + aDarko neaktivni); search fix NI spremenil
    // obnašanja brez ?search
    expect(json.total).toBe(4)
    const ids = (json.accounts as Array<Record<string, unknown>>).map((a) => a.id)
    expect(ids.sort()).toEqual([IDS.aAna, IDS.aBorut, IDS.aCvetka, IDS.aDarko].sort())
    // paginacijska oblika ostane 1:1
    expect(Object.keys(json).sort()).toEqual(['accounts', 'limit', 'offset', 'total'])
    expect(json.offset).toBe(0)
    expect(typeof json.limit).toBe('number')
  })

  it('PII regression pin: vrstica nosi TOČNO prejšnjo (pred-R143) obliko — polna Prisma vrstica + transactions[10]; phone/email STA ŠE VEDNO v odgovoru (ruta ju je vračala že pred R143)', async () => {
    const res = await loyaltyGet('?search=Ana')
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.total).toBe(1)
    const row = (json.accounts as Array<Record<string, unknown>>)[0] as Record<string, unknown>

    // TOČNO ključi polne vrstice (brez select-a v ruti — pin dejanske oblike)
    expect(Object.keys(row).sort()).toEqual(LOYALTY_ROW_KEYS)
    // HONEST: customerPhone/customerEmail sta del odgovora (pred-R143 oblika,
    // namenoma ohranjena — ta ruta je plačilni dialog attach, PII je tu doma)
    expect(row.customerPhone).toBe(PHONE_ANA)
    expect(row.customerEmail).toBe(`${RUN_ID}-mail-ana@test.local`)

    // transactions include (10 zadnjih, orderBy createdAt desc) — ana ima 1
    const txs = row.transactions as Array<Record<string, unknown>>
    expect(txs).toHaveLength(1)
    expect(Object.keys(txs[0] as Record<string, unknown>).sort()).toEqual(LOYALTY_TX_KEYS)
    expect(txs[0]).toMatchObject({ loyaltyAccountId: IDS.aAna, type: 'earn', points: 10, reason: 'Nakup' })
    // Decimal monetaryValue: db.ts patcha Decimal.toJSON → number (deepToNumbers
    // ni na tej ruti — pin seralizacije na pravi bazi)
    expect(typeof (txs[0] as Record<string, unknown>).monetaryValue).toBe('number')
  })
})

// ============================================
// 3) POST /api/loyalty-automation — action expiry_notify (NOTIFY-ONLY)
// ============================================
describe('R143 #30: POST /api/loyalty-automation — expiry_notify (prava PGlite)', () => {
  it('ne-admin (take_orders seja) → 403 { error: "Nimate dovoljenja za to operacijo." } — requireAuth ADMIN kanon', async () => {
    setSession('take_orders', IDS.locC, ['take_orders'])
    const res = await automationPost({ action: 'expiry_notify' })
    expect(res.status).toBe(403)
    const json = await asJson(res)
    // EXACT telo realnega requireAuth permission gate-a (mock uporabi realen
    // hasPermission — glej mock komentar v headerju)
    expect(json.error).toBe('Nimate dovoljenja za to operacijo.')
    // fail-closed: nobenih pisnih sledi
    expect(await myExpireTxCount()).toBe(0)
    expect(await myOutboxCount()).toBe(0)
  })

  it('admin na locC → 200, povzetek števcev 1:1 z FIFO izračunom (processed 16, accountsExpiring 2, expiringPoints 600, capped false, notifyOnly true); ZERO expire zapisov, balansi nespremenjeni, ZERO outbox', async () => {
    setSession('admin', IDS.locC, ['admin'])
    const expireBefore = await myExpireTxCount()
    const outboxBefore = await myOutboxCount()
    const balBefore = await db.loyaltyAccount.findMany({
      where: { id: { in: [IDS.cExp1, IDS.cExp2, IDS.cOld] } },
      select: { id: true, pointsBalance: true },
    })

    const res = await automationPost({ action: 'expiry_notify' })
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.success).toBe(true)
    // EXACT R143-b shape (processExpiryNotifyBatch) — isti FIFO izračun kot
    // lifecycle expiringSoon30d na locC (skupni vir lib/loyalty/lifecycle)
    expect(json.results).toEqual({
      expiryNotify: { processed: 16, accountsExpiring: 2, expiringPoints: 600, capped: false, notifyOnly: true },
    })

    // NOTIFY-ONLY forenzika: ZERO 'expire' zapisov (count before === after),
    // balansi nespremenjeni, nobenega SMS/outbox eventa
    expect(await myExpireTxCount()).toBe(expireBefore)
    expect(expireBefore).toBe(0)
    expect(await myOutboxCount()).toBe(outboxBefore)
    const balAfter = await db.loyaltyAccount.findMany({
      where: { id: { in: [IDS.cExp1, IDS.cExp2, IDS.cOld] } },
      select: { id: true, pointsBalance: true },
    })
    expect(balAfter).toEqual(balBefore)
  })
})

// ============================================
// 4) POST action birthday_batch — Guest soft-join fix (denar + SMS)
// ============================================
describe('R143 #30: POST action birthday_batch — Guest soft-join po telefonu (prava PGlite)', () => {
  it('dodeli SAMO gostu z današnjim rojstnim dnem (LJ): 1 award × 100 točk, skippedNoBirthday === 2; točno 1 earn tx za A1, 0 za A2/A3; balansi 100/0/0', async () => {
    // sanity: +100 dni NIKOLI isto (mesec, dan) kot danes (100 mod 365 ≠ 0)
    expect(LJ_PLUS_100.slice(5)).not.toBe(LJ_TODAY.slice(5))

    setSession('admin', IDS.locBD, ['admin'])
    const res = await automationPost({ action: 'birthday_batch' })
    expect(res.status).toBe(200)
    const json = await asJson(res)
    expect(json.success).toBe(true)

    // EXACT R143-b counter shape — števci odražajo DEJANSKE podelitve
    expect(json.results).toEqual({
      birthday: { processed: 3, sent: 1, skippedNoBirthday: 2, pointsAwarded: 100 },
    })

    // LoyaltyTransaction forenzika: TOČNO 1 nova earn vrstica za A1
    // (reason 'Rojstni dan bonus', 100 točk), 0 za A2/A3
    const txs = await db.loyaltyTransaction.findMany({
      where: { loyaltyAccountId: { in: [IDS.bd1, IDS.bd2, IDS.bd3] } },
      orderBy: { createdAt: 'asc' },
    })
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({
      loyaltyAccountId: IDS.bd1,
      type: 'earn',
      points: 100,
      reason: 'Rojstni dan bonus',
      orderId: null,
    })

    // Balansi: A1 +100 (pointsBalance IN lifetimePoints), A2/A3 nespremenjena
    const rows = await db.loyaltyAccount.findMany({
      where: { id: { in: [IDS.bd1, IDS.bd2, IDS.bd3] } },
      select: { id: true, pointsBalance: true, lifetimePoints: true },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    expect(byId.get(IDS.bd1)?.pointsBalance).toBe(100)
    expect(byId.get(IDS.bd1)?.lifetimePoints).toBe(100)
    expect(byId.get(IDS.bd2)?.pointsBalance).toBe(0)
    expect(byId.get(IDS.bd3)?.pointsBalance).toBe(0)
  }, 20_000)

  it('idempotenca: ponovni isti-dnevni tek → 0 novih podelitev (awardDailyBonusOnce guard), števci pošteno 0 (R143-b deviation 1: števci štejo DEJANSKE podelitve)', async () => {
    setSession('admin', IDS.locBD, ['admin'])
    const txCountBefore = await db.loyaltyTransaction.count({
      where: { loyaltyAccountId: { in: [IDS.bd1, IDS.bd2, IDS.bd3] } },
    })

    const res = await automationPost({ action: 'birthday_batch' })
    expect(res.status).toBe(200)
    const json = await asJson(res)
    // processed 3, skipped 2; sent/pointsAwarded = 0 (prej bi lažno poročali
    // sent > 0 — pin R143-b popravljenega poštenega štetja)
    expect(json.results).toEqual({
      birthday: { processed: 3, sent: 0, skippedNoBirthday: 2, pointsAwarded: 0 },
    })

    // NIČ novih transakcij, balans nespremenjen (idempotenca R111 kanon)
    const txCountAfter = await db.loyaltyTransaction.count({
      where: { loyaltyAccountId: { in: [IDS.bd1, IDS.bd2, IDS.bd3] } },
    })
    expect(txCountAfter).toBe(txCountBefore)
    expect(txCountAfter).toBe(1)
    const a1 = await db.loyaltyAccount.findUnique({ where: { id: IDS.bd1 }, select: { pointsBalance: true } })
    expect(a1?.pointsBalance).toBe(100)
  }, 20_000)

  it('SMS/outbox surface: TOČNO 1 OutboxEvent (target sms, loyalty_birthday_bonus) za A1, noben za A2/A3; payload nosi telefon + 100-točkovno sporočilo; per-day idempotencyKey; ponovni tek NE doda eventa', async () => {
    // (teče po prvih dveh batch tekih — surface mora biti še vedno 1 event)
    const events = await db.outboxEvent.findMany({
      where: { aggregateId: { in: [IDS.bd1, IDS.bd2, IDS.bd3] } },
    })
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.aggregateId).toBe(IDS.bd1)
    expect(ev.aggregateType).toBe('customer')
    expect(ev.target).toBe('sms')
    expect(ev.eventType).toBe('loyalty_birthday_bonus')
    // honest queued surface: pending (SMS provider v testnem okolju ni
    // konfiguriran → direktni sendSms je no-op, outbox ostane vrsta)
    expect(ev.status).toBe('pending')
    // per-day idempotencyKey (sendLoyaltySms kanon)
    expect(ev.idempotencyKey).toBe(`loyalty:${IDS.bd1}:birthday_bonus:${new Date().toISOString().slice(0, 10)}`)

    // payload: prejemnik = A1 telefon, telo vsebuje ime in 100 točk
    const payload = ev.payload as { to: string; body: string; type: string }
    expect(payload.to).toBe(PHONE_BD1)
    expect(payload.type).toBe('birthday_bonus')
    expect(payload.body).toContain(NAME_BD1)
    expect(payload.body).toContain('100')
  }, 20_000)
})
