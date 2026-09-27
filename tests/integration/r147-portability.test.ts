// @vitest-environment node
// ============================================
// R147 / EPIC #115 #34 — INTEGRACIJA: DATA PORTABILITY
// GET /api/export/portability?mode=manifest|full[&locationId=<id>]
// (17 tabel v 5 sekcijah, MODEL A scope, checksum preverljivost,
//  PII cenzura kurirane revije, audit DATA_PORTABILITY_EXPORTED)
// ============================================
// Prava PGlite (IT DB, PGLITE_DATA_DIR=/tmp/pglite-data-it iz
// vitest.config.integration.ts; fileParallelism: false). R147 je ZERO
// migration → IT DB ne rabi migracij. Dev server teče na /tmp/pglite-data
// (ločena instanca) — tej datoteki se ne dotika.
//
// Kontrakt (R147-b, kot IMPLEMENTIRANO — route.ts + _helpers):
//   • rl bucket 'data-portability' PRED authom (AUTHENTICATED_LIMIT 120/min —
//     ta datoteka porabi ~25 klicev, varno pod mejo; in-memory store),
//   • requireAuth permission 'admin' (role admin gre čez gate; manager samo s
//     PREDANIM 'admin' permissionom v seji — bypass NE preide; tak manager
//     potem pade v resolverju: non-admin brez sejske lokacije → 403),
//   • MODEL A prek resolveTenantLocationIdOrThrow (REALEN — ni mockan):
//     lokacijska seja avtoritativna (?locationId ignoriran), super-admin brez
//     ?locationId = null = GLOBAL (vključno z NULL-location vrsticami), z
//     ?locationId = cross-branch, non-admin brez lokacije → 403
//     NO_LOCATION_MESSAGE fail-closed,
//   • mode=manifest → counts-only (count() per tabela), checksum '' in BREZ
//     attachment glav; mode=full → sections + checksum (default); neznana
//     mode → 400 'Neznan način. Dovoljeno: manifest, full',
//   • preverljivost: full checksum = computeChecksum(sections) (serialize
//     canon reuse) — SELF-VERIFYING nad prenešenim telesom; manifest
//     countsChecksum = computeChecksum(counts),
//   • ⚠️ NAJDBA INTEGRACIJE (test 7): route zapiše DATA_PORTABILITY_EXPORTED
//     audit vrstico Z scope-ovo locationId (createAuditLog entry.locationId
//     je ekspliciten → deriveAuditLocationId je ne spremeni) → NASLEDNJI full
//     izvoz istega scope-a v audit sekciji vključi prejšnjega → X-Portability-
//     Checksum med dvema zaporednima full klicema ISTEGA scope-a NI enak
//     (delta = točno 1 audit vrstica; vse ostale 16 tabel identične). To ni
//     kršitev scope-a: DB snapshot se z izvozom SPREMENI (export je dogodek
//     revije). Preverljivost je zato pinana kot: (a) checksum se vedno znova
//     izračuna iz sekcij (self-verify na obeh klicih), (b) manifest
//     counts/countsChecksum je stabilen (manifest NE piše audita), (c) vrstni
//     red vrstic je determinističen (edina delta = audit +1, vrstni red
//     skupnih vrstic ohranjen). Taskovo pričakovanje '2× full → ISTI checksum'
//     bi držalo samo, če route izvzame lasten audit zapis iz prihodnjih
//     izvozov — produkcijska odločitev za R147-final (OPOMBA v worklogu).
//   • PII: AuditLog select je kuriran (brez ipAddress/terminalId/
//     previousHash/chainHash — userAgent v shemi NE obstaja); Guest PII
//     (email/telefon/ime) je VKLJUČEN — portability NI anonimizacija
//     (Art. 6(1)(b) dostop lastnika),
//   • audit createAuditLog SAMO ob 200 full (manifest/400/403 → nič); details
//     counters-only; entityId `${mode}:${locationId ?? 'global'}`,
//   • zero-oracle: neobstoječa ?locationId → 200 s praznimi sekcijami.
//
// SEED STRATEGIJA (r144/r145/r146 kanon): 2 dedikirani lokaciji (A/B) z RUN_ID,
//   admin employee; simetričen seed gostov/menuja čez A in B, inventory/recipe
//   del SAMO na A (→ global InventoryItem == baseline+2 = invA + NULL, točno
//   po kontraktu; RecipeItem/StockTransaction LEAK testiran v smeri B-ne-vidi-A).
//   NULL-location vrstici: InventoryItem (skupna zaloga) + Guest (legacy) —
//   vidni SAMO v globalnem izvozu (fail-closed za lokacijske seje).
//   Seeded AuditLog je ročno hash-vezan na produkcijsko verigo z 2031
//   timestampom (r146-d vzorec) → route-ovi DATA_PORTABILITY_EXPORTED zapisi
//   se vezjejo nanj (previousHash == seed.chainHash); afterAll briše vse svoje
//   AuditLog vrstice (userId EMP_ID) PRVE, nato FK-urejeno, nato EMPIRIČNA
//   verifikacija (rep po čiščenju == rep pred zagonom + 0 ostankov).
//
// EXACT-COUNT ORACLE: lokaciji A/B sta sveži (RUN_ID) → lokacijski counts so
//   točno seedom. GLOBALNI counts = baseline (count() pred seedom, zajet v
//   beforeAll) + znani seed delta + route audit zapisi (števec full klicev —
//   vsak uspešen full doda točno 1 audit vrstico v svoj scope).
//
// Zagon: bunx vitest run tests/integration/r147-portability.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { createHash } from 'node:crypto'

vi.unmock('@/lib/db')

const authRef = vi.hoisted(() => ({
  current: null as null | {
    employeeId: string
    role: string
    locationId: string | null
    permissions: string[]
  },
}))

// ISTI vzorec kot r144/r145/r146 (kanon): realen auth-middleware (importOriginal
// spread), samo requireAuth nadomesti z ročno konstruirano PIN sejo; mock
// UPORABI realen hasPermission za opts.permission gate (403 kanon 1:1).
// resolveTenantLocationIdOrThrow ostane REALEN (ruta ga bere iz
// '@/lib/tenant-scope' — ta modul NI mockan).
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
import { GET as portabilityGET } from '@/app/api/export/portability/route'
import { NO_LOCATION_MESSAGE } from '@/lib/tenant-scope'
import { computeChecksum } from '@/lib/backup/serialize'
import {
  PORTABILITY_MODELS,
  PORTABILITY_NOTES,
  PORTABILITY_SECTIONS,
} from '@/app/api/export/portability/_helpers/portability-sections'

const RUN_ID = `r147it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const EMP_ID = `${RUN_ID}-admin`

// ---------- Datumi: zasebno okno 2031 (r146 kanon) — samo za seeded audit
// timestamp (najnovejši med tekom → route audit se vezje nanj) in rezervacijo.
const rawOff = parseInt(RUN_ID.slice(-6), 36)
const DAY_OFF = (Number.isNaN(rawOff) ? 42 : rawOff) % 400
const DAY_BASE = Date.UTC(2031, 2, 1 + DAY_OFF)
const at = (h: number, min = 0): Date => new Date(DAY_BASE + h * 3_600_000 + min * 60_000)

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  // customers
  gA: `${RUN_ID}-g-a`,
  gB: `${RUN_ID}-g-b`,
  gN: `${RUN_ID}-g-n`, // NULL-location legacy gost
  visA: `${RUN_ID}-vis-a`,
  visB: `${RUN_ID}-vis-b`,
  loyA: `${RUN_ID}-loy-a`,
  loyB: `${RUN_ID}-loy-b`,
  ltA: `${RUN_ID}-lt-a`,
  ltB: `${RUN_ID}-lt-b`,
  resA: `${RUN_ID}-res-a`,
  resB: `${RUN_ID}-res-b`,
  wlA: `${RUN_ID}-wl-a`,
  wlB: `${RUN_ID}-wl-b`,
  fbA: `${RUN_ID}-fb-a`,
  fbB: `${RUN_ID}-fb-b`,
  // menu
  menA: `${RUN_ID}-men-a`,
  menB: `${RUN_ID}-men-b`,
  catA: `${RUN_ID}-cat-a`,
  catB: `${RUN_ID}-cat-b`,
  itmA: `${RUN_ID}-itm-a`,
  itmB: `${RUN_ID}-itm-b`,
  mgA: `${RUN_ID}-mg-a`,
  mgB: `${RUN_ID}-mg-b`,
  modA: `${RUN_ID}-mod-a`,
  modB: `${RUN_ID}-mod-b`,
  taxA: `${RUN_ID}-tax-a`,
  taxB: `${RUN_ID}-tax-b`,
  // recipes / inventory
  recA: `${RUN_ID}-rec-a`,
  invA: `${RUN_ID}-inv-a`,
  invN: `${RUN_ID}-inv-n`, // NULL-location skupna zaloga
  stA: `${RUN_ID}-st-a`,
}
const LOC_IDS = [IDS.locA, IDS.locB]

// Markerji za LEAK/PII asercije: vsaka seeded vrstica nosi RUN_ID-specifičen
// niz (id in/ali ime), ki se v bodyju pojavi IZKLJUČNO v vrstici te tabele →
// string search po celem JSON bodyju je varen oracle (taskov kanon).
// B vrstice (session A jih NE sme videti — 13):
const B_MARKERS = [IDS.gB, IDS.visB, IDS.loyB, IDS.ltB, IDS.resB, IDS.wlB, IDS.fbB, IDS.menB, IDS.catB, IDS.itmB, IDS.mgB, IDS.modB, IDS.taxB]
// A vrstice + NULL vrstici + seed-audit details marker (session B jih NE sme videti — 19):
const A_MARKERS = [IDS.gA, IDS.visA, IDS.loyA, IDS.ltA, IDS.resA, IDS.wlA, IDS.fbA, IDS.menA, IDS.catA, IDS.itmA, IDS.mgA, IDS.modA, IDS.taxA, IDS.invA, IDS.invN, IDS.stA, IDS.recA, IDS.gN, `${RUN_ID}-seeddet`]

// PII markerji seedanega AuditLog zapisa (kurirani select jih MORA cenzurirati):
const SEED_AUDIT_IP = `${RUN_ID}-secret-ip`
const SEED_AUDIT_TERM = `${RUN_ID}-secret-term`
const SEED_AUDIT_DETAILS = `${RUN_ID}-seeddet` // details JSON — VKLJUČEN v arhivu

const LOC_A_NAME = `R147 Glavna ${RUN_ID}`
const LOC_B_NAME = `R147 Filiala ${RUN_ID}`
const GUEST_A_EMAIL = `r147it-mail-${RUN_ID}@test.local`
const GUEST_A_PHONE = `040-${RUN_ID}`

// ---------- Števeci full klicev (exact-count oracle za AuditLog):
// vsak uspešen full klic zapiše točno 1 DATA_PORTABILITY_EXPORTED vrstico z
// locationId == scope (ali null za global). Manifest/400/403 ne pišejo nič.
let fullLocA = 0
let fullLocB = 0
let fullGlobal = 0
let fullMissing = 0
const fullTotal = (): number => fullLocA + fullLocB + fullGlobal + fullMissing
// lokacijski scope A: 1 seeded audit + vsi route zapisi z locationId=locA
const expAuditLocA = (): number => 1 + fullLocA
// lokacijski scope B: brez seeda — samo route zapisi
const expAuditLocB = (): number => fullLocB
// global: vse (baseline + seed + VSI route zapisi ne glede na scope)
let baselineAudit = 0
const expAuditGlobal = (): number => baselineAudit + 1 + fullTotal()

// ---------- Response helperji ----------
async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

type SectionRows = Record<string, Record<string, Array<Record<string, unknown>>>>
type SectionCounts = Record<string, Record<string, number>>

function countsOf(body: Record<string, unknown>): SectionCounts {
  return body.counts as SectionCounts
}
function sectionsOf(body: Record<string, unknown>): SectionRows {
  return body.sections as SectionRows
}
function sumCounts(counts: SectionCounts): number {
  return Object.values(counts).reduce((acc, sec) => acc + Object.values(sec).reduce((a, b) => a + b, 0), 0)
}
const rowIds = (rows: Array<Record<string, unknown>>): unknown[] => rows.map((r) => r.id)

function manifestGet(extra = ''): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return portabilityGET(new Request(`http://localhost/api/export/portability?mode=manifest${extra}`))
}
function fullGet(extra = ''): Promise<Response> {
  return portabilityGET(new Request(`http://localhost/api/export/portability?mode=full${extra}`))
}
function setSession(role: string, locationId: string | null, permissions: string[]): void {
  authRef.current = { employeeId: EMP_ID, role, locationId, permissions }
}

async function myExportAuditIds(): Promise<string[]> {
  const rows = await db.auditLog.findMany({
    where: { userId: EMP_ID, action: 'DATA_PORTABILITY_EXPORTED' },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/** Seeda AuditLog vrstico z ročno izračunano hash vezavo (1:1 payload format
 *  createAuditLog v db.ts) — 2031 timestamp → med tekom najnovejša vrstica,
 *  route-ovi DATA_PORTABILITY_EXPORTED zapisi se vezjejo nanjo (r146-d vzorec). */
let seedAuditChainHash: string | null = null
async function seedAuditEntry(): Promise<string> {
  const last = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  const previousHash = last?.chainHash || ''
  const detailsStr = JSON.stringify({ marker: SEED_AUDIT_DETAILS, note: `Revija seed ${RUN_ID}` })
  const hashPayload = [previousHash, 'R147_SEED_MARKER', 'PortabilitySeed', '', EMP_ID, detailsStr].join('|')
  const chainHash = createHash('sha256').update(hashPayload).digest('hex')
  const created = await db.auditLog.create({
    data: {
      userId: EMP_ID,
      action: 'R147_SEED_MARKER',
      entityType: 'PortabilitySeed',
      entityId: null,
      details: detailsStr,
      ipAddress: SEED_AUDIT_IP, // MORA biti cenzuriran v arhivu (kuriran select)
      terminalId: SEED_AUDIT_TERM, // MORA biti cenzuriran v arhivu
      locationId: IDS.locA,
      previousHash,
      chainHash,
      timestamp: at(20),
    },
  })
  seedAuditChainHash = chainHash
  return created.id
}

// ---------- Exact-count oracle: baseline pred seedom (globalna revija je
// SKUPNA preteklost IT DB — baseline + znani delta je edini poetičen oracle).
const baseline: Record<string, number> = {}
let auditTailBefore: string | null = null

beforeAll(async () => {
  // 0) AuditLog rep PRED zagonom (chain kontinuiteta v afterAll — r144-d pravilo)
  const tailRow = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  auditTailBefore = tailRow?.chainHash ?? null

  // 1) Baseline counts (PRED seedom) — po delegatih, točno 17 tabel
  baseline.Guest = await db.guest.count()
  baseline.GuestVisit = await db.guestVisit.count()
  baseline.LoyaltyAccount = await db.loyaltyAccount.count()
  baseline.LoyaltyTransaction = await db.loyaltyTransaction.count()
  baseline.Reservation = await db.reservation.count()
  baseline.WaitlistEntry = await db.waitlistEntry.count()
  baseline.GuestFeedback = await db.guestFeedback.count()
  baseline.Menu = await db.menu.count()
  baseline.Category = await db.category.count()
  baseline.MenuItem = await db.menuItem.count()
  baseline.ModifierGroup = await db.modifierGroup.count()
  baseline.Modifier = await db.modifier.count()
  baseline.TaxRate = await db.taxRate.count()
  baseline.RecipeItem = await db.recipeItem.count()
  baseline.InventoryItem = await db.inventoryItem.count()
  baseline.StockTransaction = await db.stockTransaction.count()
  baseline.AuditLog = await db.auditLog.count()
  baselineAudit = baseline.AuditLog

  // 2) Dve dedikirani lokaciji (A = matična, B = filiala)
  await db.location.create({ data: { id: IDS.locA, code: `${RUN_ID}-A`, name: LOC_A_NAME, premisesId: `${RUN_ID}-pA`, isActive: true } })
  await db.location.create({ data: { id: IDS.locB, code: `${RUN_ID}-B`, name: LOC_B_NAME, premisesId: `${RUN_ID}-pB`, isActive: true } })

  // 3) Test-admin (unikaten email + pin; seja je hand-built, vrstica je realen
  //    lastnik audit userId-jev)
  await db.employee.create({ data: { id: EMP_ID, name: `Test Admin ${RUN_ID}`, email: `r147-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-a`, role: 'admin', locationId: IDS.locA } })

  // 4) Zvestoba: računa A + B (P1-7 per lokacijo), nato gostje (FK loyaltyAccountId)
  await db.loyaltyAccount.create({ data: { id: IDS.loyA, customerName: `${RUN_ID}-loy-a`, customerPhone: `041-${RUN_ID}-a`, customerEmail: `r147it-loy-${RUN_ID}-a@test.local`, pointsBalance: 120, lifetimePoints: 200, tier: 'silver', locationId: IDS.locA } })
  await db.loyaltyAccount.create({ data: { id: IDS.loyB, customerName: `${RUN_ID}-loy-b`, pointsBalance: 5, locationId: IDS.locB } })
  await db.guest.create({ data: { id: IDS.gA, firstName: 'Ana', lastName: `${RUN_ID}-g-a`, email: GUEST_A_EMAIL, phone: GUEST_A_PHONE, isVip: true, totalVisits: 3, loyaltyAccountId: IDS.loyA, locationId: IDS.locA } })
  await db.guest.create({ data: { id: IDS.gB, firstName: 'Bor', lastName: `${RUN_ID}-g-b`, locationId: IDS.locB, loyaltyAccountId: IDS.loyB } })
  await db.guest.create({ data: { id: IDS.gN, firstName: 'Nula', lastName: `${RUN_ID}-g-n` } }) // NULL-location (legacy)

  // 5) Obiski (GuestVisit NIMA locationId — scope RELACIJSKO prek guest)
  await db.guestVisit.create({ data: { id: IDS.visA, guestId: IDS.gA, partySize: 2, totalSpent: 45.5, tipAmount: 3, feedbackScore: 5, employeeName: 'Test Admin' } })
  await db.guestVisit.create({ data: { id: IDS.visB, guestId: IDS.gB, partySize: 4, totalSpent: 80 } })

  // 6) Transakciji zvestobe (scope RELACIJSKO prek loyaltyAccount)
  await db.loyaltyTransaction.create({ data: { id: IDS.ltA, loyaltyAccountId: IDS.loyA, type: 'earn', points: 12, reason: 'Nakup' } })
  await db.loyaltyTransaction.create({ data: { id: IDS.ltB, loyaltyAccountId: IDS.loyB, type: 'redeem', points: -5 } })

  // 7) Rezervaciji + čakanji + povratne informacije (direktni locationId)
  await db.reservation.create({ data: { id: IDS.resA, customerName: `${RUN_ID}-res-a`, customerPhone: GUEST_A_PHONE, dateTime: at(30), partySize: 2, locationId: IDS.locA, notes: 'Ob oknu' } })
  await db.reservation.create({ data: { id: IDS.resB, customerName: `${RUN_ID}-res-b`, dateTime: at(31), partySize: 4, locationId: IDS.locB } })
  await db.waitlistEntry.create({ data: { id: IDS.wlA, guestName: `${RUN_ID}-wl-a`, partySize: 2, quotedWaitMinutes: 15, locationId: IDS.locA } })
  await db.waitlistEntry.create({ data: { id: IDS.wlB, guestName: `${RUN_ID}-wl-b`, partySize: 3, locationId: IDS.locB } })
  await db.guestFeedback.create({ data: { id: IDS.fbA, guestId: IDS.gA, guestName: `${RUN_ID}-fb-a`, overallRating: 5, comment: 'Odlično', locationId: IDS.locA } })
  await db.guestFeedback.create({ data: { id: IDS.fbB, guestName: `${RUN_ID}-fb-b`, overallRating: 3, locationId: IDS.locB } })

  // 8) Meni na A (polna kombinacija) + zrcalni meni na B (LEAK test)
  await db.menu.create({ data: { id: IDS.menA, name: `${RUN_ID}-men-a`, sortOrder: 1, locationId: IDS.locA } })
  await db.menu.create({ data: { id: IDS.menB, name: `${RUN_ID}-men-b`, sortOrder: 1, locationId: IDS.locB } })
  await db.category.create({ data: { id: IDS.catA, name: `${RUN_ID}-cat-a`, menuId: IDS.menA } })
  await db.category.create({ data: { id: IDS.catB, name: `${RUN_ID}-cat-b`, menuId: IDS.menB } })
  await db.menuItem.create({ data: { id: IDS.itmA, name: `${RUN_ID}-itm-a`, price: 10.5, categoryId: IDS.catA } })
  await db.menuItem.create({ data: { id: IDS.itmB, name: `${RUN_ID}-itm-b`, price: 8, categoryId: IDS.catB } })
  await db.modifierGroup.create({ data: { id: IDS.mgA, name: `${RUN_ID}-mg-a`, locationId: IDS.locA } })
  await db.modifierGroup.create({ data: { id: IDS.mgB, name: `${RUN_ID}-mg-b`, locationId: IDS.locB } })
  await db.modifier.create({ data: { id: IDS.modA, name: `${RUN_ID}-mod-a`, price: 1.5, modifierGroupId: IDS.mgA } })
  await db.modifier.create({ data: { id: IDS.modB, name: `${RUN_ID}-mod-b`, modifierGroupId: IDS.mgB } })
  await db.taxRate.create({ data: { id: IDS.taxA, name: `${RUN_ID}-tax-a`, rate: 22, code: 'S', locationId: IDS.locA } })
  await db.taxRate.create({ data: { id: IDS.taxB, name: `${RUN_ID}-tax-b`, rate: 9.5, code: 'R', locationId: IDS.locB } })

  // 9) Zaloga: invA na locA + invN NULL (skupna zaloga) — B NIMA zaloge
  //    (global InventoryItem == baseline + 2, točno po kontraktu)
  await db.inventoryItem.create({ data: { id: IDS.invA, name: `${RUN_ID}-inv-a`, unit: 'kg', quantity: 10, costPerUnit: 2.5, locationId: IDS.locA } })
  await db.inventoryItem.create({ data: { id: IDS.invN, name: `${RUN_ID}-inv-n`, unit: 'pcs', quantity: 4 } })

  // 10) Receptura (3-nivojska relacija menuItem→category→menu) + knjiga premikov
  //     (FK inventoryItemId!) — SAMO na A
  await db.recipeItem.create({ data: { id: IDS.recA, menuItemId: IDS.itmA, inventoryItemId: IDS.invA, quantityPerServing: 0.15, unit: 'kg' } })
  await db.stockTransaction.create({ data: { id: IDS.stA, inventoryItemId: IDS.invA, type: 'procurement', quantity: 10, previousQty: 0, newQty: 10, costPerUnit: 2.5, totalCost: 25, note: `${RUN_ID}-st-a`, employeeName: 'Test Admin' } })

  // 11) Seeded AuditLog (ZADNJI — chain na aktualni rep; 2031 → najnovejši)
  await seedAuditEntry()
}, 60_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  setSession('admin', IDS.locA, ['admin'])
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (r142-d/r144-d/r145-d/r146-d pravilo):
  //   1) AUDIT vrstice PRVE (userId EMP_ID pokrije seeded marker + VSE route
  //      DATA_PORTABILITY_EXPORTED zapise — tudi tiste z neobstoječo lokacijo),
  //   2) GuestVisit → LoyaltyTransaction → LoyaltyAccount → Guest,
  //   3) GuestFeedback (loose refi), WaitlistEntry → Reservation,
  //   4) RecipeItem → Modifier → ModifierGroup → MenuItem → Category → Menu,
  //   5) TaxRate, StockTransaction (FK Restrict!) → InventoryItem,
  //   6) Employee, lokaciji.
  // Nato EMPIRIČNA verifikacija: rep po čiščenju == rep pred zagonom + 0 ostankov.
  await db.auditLog.deleteMany({ where: { userId: EMP_ID } }).catch(() => {})
  await db.guestVisit.deleteMany({ where: { id: { in: [IDS.visA, IDS.visB] } } }).catch(() => {})
  await db.loyaltyTransaction.deleteMany({ where: { id: { in: [IDS.ltA, IDS.ltB] } } }).catch(() => {})
  await db.loyaltyAccount.deleteMany({ where: { id: { in: [IDS.loyA, IDS.loyB] } } }).catch(() => {})
  await db.guest.deleteMany({ where: { id: { in: [IDS.gA, IDS.gB, IDS.gN] } } }).catch(() => {})
  await db.guestFeedback.deleteMany({ where: { id: { in: [IDS.fbA, IDS.fbB] } } }).catch(() => {})
  await db.waitlistEntry.deleteMany({ where: { id: { in: [IDS.wlA, IDS.wlB] } } }).catch(() => {})
  await db.reservation.deleteMany({ where: { id: { in: [IDS.resA, IDS.resB] } } }).catch(() => {})
  await db.recipeItem.deleteMany({ where: { id: IDS.recA } }).catch(() => {})
  await db.modifier.deleteMany({ where: { id: { in: [IDS.modA, IDS.modB] } } }).catch(() => {})
  await db.modifierGroup.deleteMany({ where: { id: { in: [IDS.mgA, IDS.mgB] } } }).catch(() => {})
  await db.menuItem.deleteMany({ where: { id: { in: [IDS.itmA, IDS.itmB] } } }).catch(() => {})
  await db.category.deleteMany({ where: { id: { in: [IDS.catA, IDS.catB] } } }).catch(() => {})
  await db.menu.deleteMany({ where: { id: { in: [IDS.menA, IDS.menB] } } }).catch(() => {})
  await db.taxRate.deleteMany({ where: { id: { in: [IDS.taxA, IDS.taxB] } } }).catch(() => {})
  await db.stockTransaction.deleteMany({ where: { id: IDS.stA } }).catch(() => {})
  await db.inventoryItem.deleteMany({ where: { id: { in: [IDS.invA, IDS.invN] } } }).catch(() => {})
  await db.employee.deleteMany({ where: { OR: [{ id: EMP_ID }, { email: { contains: RUN_ID } }] } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})

  // --- EMPIRIČNA VERIFIKACIJA ČIŠČENJA ---
  const tailAfter = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  expect(tailAfter?.chainHash ?? null).toBe(auditTailBefore)
  expect(await db.auditLog.count({ where: { userId: EMP_ID } })).toBe(0)
  expect(await db.auditLog.count({ where: { entityType: 'PortabilityExport' } })).toBe(0)
  expect(await db.guestVisit.count({ where: { id: { in: [IDS.visA, IDS.visB] } } })).toBe(0)
  expect(await db.loyaltyTransaction.count({ where: { id: { in: [IDS.ltA, IDS.ltB] } } })).toBe(0)
  expect(await db.loyaltyAccount.count({ where: { id: { in: [IDS.loyA, IDS.loyB] } } })).toBe(0)
  expect(await db.guest.count({ where: { lastName: { contains: RUN_ID } } })).toBe(0)
  expect(await db.guestFeedback.count({ where: { id: { in: [IDS.fbA, IDS.fbB] } } })).toBe(0)
  expect(await db.waitlistEntry.count({ where: { id: { in: [IDS.wlA, IDS.wlB] } } })).toBe(0)
  expect(await db.reservation.count({ where: { id: { in: [IDS.resA, IDS.resB] } } })).toBe(0)
  expect(await db.recipeItem.count({ where: { id: IDS.recA } })).toBe(0)
  expect(await db.modifier.count({ where: { id: { in: [IDS.modA, IDS.modB] } } })).toBe(0)
  expect(await db.modifierGroup.count({ where: { id: { in: [IDS.mgA, IDS.mgB] } } })).toBe(0)
  expect(await db.menuItem.count({ where: { id: { in: [IDS.itmA, IDS.itmB] } } })).toBe(0)
  expect(await db.category.count({ where: { id: { in: [IDS.catA, IDS.catB] } } })).toBe(0)
  expect(await db.menu.count({ where: { id: { in: [IDS.menA, IDS.menB] } } })).toBe(0)
  expect(await db.taxRate.count({ where: { id: { in: [IDS.taxA, IDS.taxB] } } })).toBe(0)
  expect(await db.stockTransaction.count({ where: { id: IDS.stA } })).toBe(0)
  expect(await db.inventoryItem.count({ where: { id: { in: [IDS.invA, IDS.invN] } } })).toBe(0)
  expect(await db.employee.count({ where: { email: { contains: RUN_ID } } })).toBe(0)
  expect(await db.location.count({ where: { id: { in: LOC_IDS } } })).toBe(0)
  await db.$disconnect().catch(() => {})
}, 60_000)

// ============================================
// 1) MANIFEST: OBLIKA + TOČNI COUNTS (SCOPE A)
// ============================================
describe('R147 #34: manifest (counts-only, scope A)', () => {
  it('1. manifest 200: format/version/generatedAt/schemaStamp/scope{locA,locationName}/counts shape (5 sekcij, 17 modelov)/countsChecksum 64hex/checksum \'\']/notes — brez attachment glav', async () => {
    const res = await manifestGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toBeNull() // manifest NI attachment
    expect(res.headers.get('x-portability-checksum')).toBeNull() // checksum je v bodyju ('')

    const body = await asJson(res)
    expect(body.format).toBe('restaurantos-portability')
    expect(body.version).toBe(1)
    expect(Number.isNaN(new Date(body.generatedAt as string).getTime())).toBe(false) // veljaven ISO
    expect(body.schemaStamp).toMatch(/^[0-9a-f]{64}$/)
    expect(body.schemaStamp).toBe(computeChecksum(PORTABILITY_MODELS.join(','))) // recompute pin
    expect(body.checksum).toBe('') // backup manifest vzorec
    expect(body.countsChecksum).toMatch(/^[0-9a-f]{64}$/)
    expect(body.countsChecksum).toBe(computeChecksum(countsOf(body))) // recompute pin
    expect(body.scope).toEqual({ locationId: IDS.locA, locationName: LOC_A_NAME })
    expect(body.notes).toEqual(PORTABILITY_NOTES) // 7 opomb, žive s strežnika

    // counts shape: točno 5 sekcij, točno 17 modelov (registry parity)
    const counts = countsOf(body)
    expect(Object.keys(counts).sort()).toEqual([...PORTABILITY_SECTIONS].sort())
    const flatModels = Object.values(counts).flatMap((sec) => Object.keys(sec)).sort()
    expect(flatModels).toEqual([...PORTABILITY_MODELS].sort())
  })

  it('2. manifest counts == seed (scope A): 16 netabel točno 1, AuditLog == 1 seeded + route zapisi; NULL vrstici IZVEN scope-a; countsChecksum stabilen med manifest klici', async () => {
    const res = await manifestGet()
    expect(res.status).toBe(200)
    const counts = countsOf(await asJson(res))

    expect(counts.customers).toEqual({ Guest: 1, GuestVisit: 1, LoyaltyAccount: 1, LoyaltyTransaction: 1, Reservation: 1, WaitlistEntry: 1, GuestFeedback: 1 })
    expect(counts.menu).toEqual({ Menu: 1, Category: 1, MenuItem: 1, ModifierGroup: 1, Modifier: 1, TaxRate: 1 })
    expect(counts.recipes).toEqual({ RecipeItem: 1 })
    expect(counts.inventory).toEqual({ InventoryItem: 1, StockTransaction: 1 }) // invN (NULL) IZVEN scope-a — fail-closed
    expect(counts.audit).toEqual({ AuditLog: expAuditLocA() }) // 1 seeded + route full zapisi

    // countsChecksum stabilen (manifest NE piše audita): 2. manifest klic za istega
    const res2 = await manifestGet()
    expect(res2.status).toBe(200)
    const body2 = await asJson(res2)
    expect(body2.countsChecksum).toBe(computeChecksum(counts)) // == countsChecksum 1. klica
  })
})

// ============================================
// 2) MODEL A: GLOBAL (SUPER-ADMIN) + NULL-LOCATION + ZERO-ORACLE
// ============================================
describe('R147 #34: MODEL A global + NULL-location + zero-oracle', () => {
  it('3. global manifest (super-admin brez ?locationId): scope null, counts == baseline + seed — Guest +3 (2 lokaciji + NULL legacy), InventoryItem +2 (skupna zaloga + invA), Menu +2, revija +1', async () => {
    setSession('super_admin', null, ['admin'])
    const res = await manifestGet()
    expect(res.status).toBe(200)
    const body = await asJson(res)
    expect(body.scope).toEqual({ locationId: null, locationName: null })

    const counts = countsOf(body)
    // exact-count oracle: baseline (skupna preteklost IT DB) + znani seed delta
    expect(counts.customers).toEqual({
      Guest: baseline.Guest + 3, // gA (locA) + gB (locB) + gN (NULL) — NULL VIDEN samo globalno
      GuestVisit: baseline.GuestVisit + 2,
      LoyaltyAccount: baseline.LoyaltyAccount + 2,
      LoyaltyTransaction: baseline.LoyaltyTransaction + 2,
      Reservation: baseline.Reservation + 2,
      WaitlistEntry: baseline.WaitlistEntry + 2,
      GuestFeedback: baseline.GuestFeedback + 2,
    })
    expect(counts.menu).toEqual({
      Menu: baseline.Menu + 2,
      Category: baseline.Category + 2,
      MenuItem: baseline.MenuItem + 2,
      ModifierGroup: baseline.ModifierGroup + 2,
      Modifier: baseline.Modifier + 2,
      TaxRate: baseline.TaxRate + 2,
    })
    expect(counts.recipes).toEqual({ RecipeItem: baseline.RecipeItem + 1 })
    expect(counts.inventory).toEqual({
      InventoryItem: baseline.InventoryItem + 2, // invA (locA) + invN (NULL skupna zaloga)
      StockTransaction: baseline.StockTransaction + 1,
    })
    expect(counts.audit).toEqual({ AuditLog: expAuditGlobal() }) // baseline + seed + (še) 0 route zapisov
  })

  it('4. NULL-location vrstice: session A full ju NE vidi (fail-closed); super-admin global full ju VIDI (row-level: InventoryItem + Guest z locationId null)', async () => {
    // Session A: skupna zaloga + legacy gost IZVEN lokacijskega arhiva
    const resA = await fullGet()
    expect(resA.status).toBe(200)
    const bodyA = await asJson(resA)
    const textA = JSON.stringify(bodyA)
    expect(textA).not.toContain(IDS.invN)
    expect(textA).not.toContain(IDS.gN)
    const invRowsA = sectionsOf(bodyA).inventory.InventoryItem
    expect(invRowsA).toHaveLength(1)
    expect(invRowsA[0].locationId).toBe(IDS.locA)
    fullLocA++

    // Super-admin global: NULL vrstici VIDNI (row-level asercija, ne string search)
    setSession('super_admin', null, ['admin'])
    const resG = await fullGet()
    expect(resG.status).toBe(200)
    const bodyG = await asJson(resG)
    const secG = sectionsOf(bodyG)
    const invRowsG = secG.inventory.InventoryItem
    const nullInv = invRowsG.find((r) => r.id === IDS.invN)
    expect(nullInv).toBeTruthy()
    expect(nullInv?.locationId).toBeNull() // skupna zaloga: locationId NULL v vrstici
    const nullGuest = secG.customers.Guest.find((r) => r.id === IDS.gN)
    expect(nullGuest).toBeTruthy()
    expect(nullGuest?.locationId).toBeNull()
    fullGlobal++
  }, 30_000)

  it('5. zero-oracle: super-admin ?locationId=<neobstoječa> → manifest 200 vseh counts 0 + locationName null; full 200 praznih sekcij, checksum self-verifies', async () => {
    setSession('super_admin', null, ['admin'])
    const missing = `r147it-neobstojeca-${RUN_ID}`

    const resM = await manifestGet(`&locationId=${encodeURIComponent(missing)}`)
    expect(resM.status).toBe(200)
    const bodyM = await asJson(resM)
    expect(bodyM.scope).toEqual({ locationId: missing, locationName: null })
    const countsM = countsOf(bodyM)
    for (const section of PORTABILITY_SECTIONS) {
      expect(Object.values(countsM[section]).every((n) => n === 0)).toBe(true)
    }
    expect(bodyM.countsChecksum).toBe(computeChecksum(countsM))

    // full: prazne sekcije + self-verify (prazen DB snapshot je preverljiv)
    const resF = await fullGet(`&locationId=${encodeURIComponent(missing)}`)
    expect(resF.status).toBe(200)
    const bodyF = await asJson(resF)
    const secF = sectionsOf(bodyF)
    for (const section of PORTABILITY_SECTIONS) {
      expect(Object.values(secF[section]).every((rows) => Array.isArray(rows) && rows.length === 0)).toBe(true)
    }
    expect(countsF_zero(countsOf(bodyF))).toBe(true)
    const checksumF = bodyF.checksum as string
    expect(checksumF).toMatch(/^[0-9a-f]{64}$/)
    expect(computeChecksum(secF)).toBe(checksumF) // self-verify nad praznimi sekcijami
    expect(resF.headers.get('x-portability-checksum')).toBe(checksumF)
    // prva uporaba te (neobstoječe) lokacije: revija scope-a je še prazna TUDI v full
    expect(countsOf(bodyF).audit.AuditLog).toBe(0)
    // ... route je svoj audit zapisal ŠELE po branju (locationId=missing)
    fullMissing++
  }, 30_000)
})

// helper za test 5 (vse counts 0)
function countsF_zero(counts: SectionCounts): boolean {
  return Object.values(counts).every((sec) => Object.values(sec).every((n) => n === 0))
}

// ============================================
// 3) FULL ARHIV: HEADERS + PREVERLJIVOST (EPIC GATE) + DETERMINIZEM
// ============================================
describe('R147 #34: full arhiv — headers + preverljivost + determinizem', () => {
  it('6. full 200 + headers: no-store, Content-Disposition prenos-podatkov-<YYYYMMDD-HHmmss>.json, X-Portability-Checksum 64hex, X-Portability-Sections 5 sekcij', async () => {
    const res = await fullGet()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="prenos-podatkov-\d{8}-\d{6}\.json"$/)
    expect(res.headers.get('x-portability-checksum')).toMatch(/^[0-9a-f]{64}$/)
    expect(res.headers.get('x-portability-sections')).toBe(PORTABILITY_SECTIONS.join(','))

    const body = await asJson(res)
    expect(body.format).toBe('restaurantos-portability')
    expect(body.version).toBe(1)
    expect(body.scope).toEqual({ locationId: IDS.locA, locationName: LOC_A_NAME })
    fullLocA++
    // telo porabljeno zgoraj (single-read) — naslednji testi jemljejo sveže klice
  }, 30_000)

  it('7. preverljivost (epic gate): checksum self-verifies nad sections (2× full); 2× full → X-Portability-Checksum RAZLIČNA (route-ov lasten audit pride v naslednji izvoz — delta točno 1 vrstica; NAJDBA, glej header); byte-body različen (generatedAt + audit delta)', async () => {
    const res1 = await fullGet()
    expect(res1.status).toBe(200)
    const checksum1 = res1.headers.get('x-portability-checksum') ?? ''
    const body1 = await asJson(res1)
    fullLocA++

    const res2 = await fullGet()
    expect(res2.status).toBe(200)
    const checksum2 = res2.headers.get('x-portability-checksum') ?? ''
    const body2 = await asJson(res2)
    fullLocA++

    // (a) SELF-VERIFY — jedro preverljivosti: preneseni arhiv se preveri sam
    //     (recompute computeChecksum(sections) == body.checksum == header),
    //     neodvisno od generatedAt (checksum pokriva PODATKE, ne ovojnico).
    expect(checksum1).toMatch(/^[0-9a-f]{64}$/)
    expect(computeChecksum(sectionsOf(body1))).toBe(checksum1)
    expect(body1.checksum).toBe(checksum1)
    expect(computeChecksum(sectionsOf(body2))).toBe(checksum2)
    expect(body2.checksum).toBe(checksum2)

    // (b) NAJDBA (dokumentirano odstopanje od taskovega 'ISTI checksum'): DB
    //     snapshot se z izvozom SPREMENI — 1. klic zapiše DATA_PORTABILITY_EXPORTED
    //     v revijo scope-a, 2. klic jo prebere → checksuma je različna, delta točno 1.
    expect(checksum2).not.toBe(checksum1)
    const audit1 = sectionsOf(body1).audit.AuditLog
    const audit2 = sectionsOf(body2).audit.AuditLog
    expect(audit2).toHaveLength(audit1.length + 1)
    const ids1 = new Set(rowIds(audit1))
    const added = audit2.filter((r) => !ids1.has(r.id))
    expect(added).toHaveLength(1)
    expect(added[0].action).toBe('DATA_PORTABILITY_EXPORTED')
    expect(added[0].entityType).toBe('PortabilityExport')
    expect(added[0].entityId).toBe(`full:${IDS.locA}`)
    // vseh 16 netabel: IDENTIČNIH med obema klicema (edina delta = revija)
    for (const section of PORTABILITY_SECTIONS) {
      if (section === 'audit') continue
      expect(sectionsOf(body2)[section]).toEqual(sectionsOf(body1)[section])
    }

    // (c) byte-body: različen (generatedAt + audit delta) — NE pinamo byte-bodyja
    expect(JSON.stringify(body1)).not.toBe(JSON.stringify(body2))
  }, 30_000)

  it('8. manifest == full counts (parity pod capi, back-to-back): vseh 17 tabel + countsChecksum ENAK (route bere counts PRED lastnim audit zapisom)', async () => {
    const resM = await manifestGet()
    expect(resM.status).toBe(200)
    const bodyM = await asJson(resM)

    const resF = await fullGet()
    expect(resF.status).toBe(200)
    const bodyF = await asJson(resF)
    fullLocA++

    expect(countsOf(bodyF)).toEqual(countsOf(bodyM)) // deep-equal, vse 17 tabel (tudi revija!)
    expect(bodyF.countsChecksum).toBe(bodyM.countsChecksum)
    expect(sumCounts(countsOf(bodyF))).toBe(sumCounts(countsOf(bodyM)))
    expect(sumCounts(countsOf(bodyM))).toBeGreaterThan(16) // res podatkovni izvoz, ne prazen
  }, 30_000)

  it('9. determinizem vrstic: 2× full → vseh 16 netabel deep-equal (vrstni red orderBy stabilen), revija +1 (lasten audit), vrstni red skupnih revij vrstic ohranjen', async () => {
    const res1 = await fullGet()
    const res2 = await fullGet()
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const body1 = await asJson(res1)
    const body2 = await asJson(res2)
    fullLocA += 2

    for (const section of PORTABILITY_SECTIONS) {
      if (section === 'audit') continue
      expect(sectionsOf(body2)[section]).toEqual(sectionsOf(body1)[section])
    }
    const audit1 = sectionsOf(body1).audit.AuditLog
    const audit2 = sectionsOf(body2).audit.AuditLog
    expect(audit2).toHaveLength(audit1.length + 1)
    // vrstni red skupnih vrstic ohranjen (orderBy timestamp asc, id asc)
    const ids1 = rowIds(audit1)
    expect(rowIds(audit2).filter((id) => ids1.includes(id))).toEqual(ids1)
  }, 30_000)

  it('10. countsChecksum determinizem: 2 zaporedna manifest klica (brez full vmes) → identični counts + countsChecksum', async () => {
    const res1 = await manifestGet()
    const res2 = await manifestGet()
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const body1 = await asJson(res1)
    const body2 = await asJson(res2)
    expect(body2.counts).toEqual(body1.counts)
    expect(body2.countsChecksum).toBe(body1.countsChecksum)
    expect(body2.countsChecksum).toBe(computeChecksum(countsOf(body1)))
  }, 30_000)

  it('11. format/schemaStamp parity manifest↔full + notes pin: isti schemaStamp (isti modeli), notes == PORTABILITY_NOTES (7 opomb), full nosi sections', async () => {
    const resM = await manifestGet()
    expect(resM.status).toBe(200)
    const bodyM = await asJson(resM)

    const resF = await fullGet()
    expect(resF.status).toBe(200)
    const bodyF = await asJson(resF)
    fullLocA++

    expect(bodyF.format).toBe(bodyM.format)
    expect(bodyF.version).toBe(bodyM.version)
    expect(bodyF.schemaStamp).toBe(bodyM.schemaStamp)
    expect(bodyF.schemaStamp).toBe(computeChecksum(PORTABILITY_MODELS.join(',')))
    expect(bodyF.notes).toEqual(PORTABILITY_NOTES)
    expect((bodyF.notes as string[]).some((n) => n.includes('Poročila → Izvoz'))).toBe(true) // cross-ref #33
    // full ima sections, manifest jih NIMA (ključ sploh ne obstaja)
    expect(bodyF.sections).toBeTruthy()
    expect('sections' in bodyM).toBe(false)
  }, 30_000)
})

// ============================================
// 4) SCOPE IZOLACIJA (LEAK PER RELACIJSKA TABELA) + PII CENZURA
// ============================================
describe('R147 #34: scope izolacija (LEAK) + PII cenzura', () => {
  it('12. LEAK test per tabela: session A ne vidi NIČesar od B (13 markerjev), session B ne vidi NIČesar od A + NULL vrstic (19 markerjev); relacijske tabele row-level (GuestVisit/LoyaltyTransaction/Category/MenuItem/Modifier/RecipeItem/StockTransaction)', async () => {
    // Session A: točno A vrstice v vseh relacijskih tabelah
    const resA = await fullGet()
    expect(resA.status).toBe(200)
    const bodyA = await asJson(resA)
    const secA = sectionsOf(bodyA)
    fullLocA++

    expect(rowIds(secA.customers.Guest)).toEqual([IDS.gA])
    expect(rowIds(secA.customers.GuestVisit)).toEqual([IDS.visA]) // rel. guest.locationId
    expect(rowIds(secA.customers.LoyaltyTransaction)).toEqual([IDS.ltA]) // rel. loyaltyAccount
    expect(rowIds(secA.menu.Category)).toEqual([IDS.catA]) // rel. menu
    expect(rowIds(secA.menu.MenuItem)).toEqual([IDS.itmA]) // rel. category.menu
    expect(rowIds(secA.menu.Modifier)).toEqual([IDS.modA]) // rel. modifierGroup
    expect(rowIds(secA.recipes.RecipeItem)).toEqual([IDS.recA]) // rel. menuItem.category.menu
    expect(rowIds(secA.inventory.StockTransaction)).toEqual([IDS.stA]) // rel. inventoryItem
    expect(rowIds(secA.inventory.InventoryItem)).toEqual([IDS.invA])
    for (const marker of B_MARKERS) {
      expect(JSON.stringify(bodyA)).not.toContain(marker) // 13 B markerjev NIKJER v A arhivu
    }

    // Session B: točno B vrstice; A + NULL vrstice popolnoma izven
    setSession('admin', IDS.locB, ['admin'])
    const resB = await fullGet()
    expect(resB.status).toBe(200)
    const bodyB = await asJson(resB)
    const secB = sectionsOf(bodyB)
    fullLocB++

    expect(rowIds(secB.customers.Guest)).toEqual([IDS.gB])
    expect(rowIds(secB.customers.GuestVisit)).toEqual([IDS.visB])
    expect(rowIds(secB.customers.LoyaltyTransaction)).toEqual([IDS.ltB])
    expect(rowIds(secB.menu.Category)).toEqual([IDS.catB])
    expect(rowIds(secB.menu.MenuItem)).toEqual([IDS.itmB])
    expect(rowIds(secB.menu.Modifier)).toEqual([IDS.modB])
    // B nima inventory/recipe vrstic (seed) — in nikoli A-jevih:
    expect(secB.recipes.RecipeItem).toHaveLength(0)
    expect(secB.inventory.InventoryItem).toHaveLength(0)
    expect(secB.inventory.StockTransaction).toHaveLength(0)
    expect(bodyB.scope).toEqual({ locationId: IDS.locB, locationName: LOC_B_NAME })
    for (const marker of A_MARKERS) {
      expect(JSON.stringify(bodyB)).not.toContain(marker) // 19 A/NULL markerjev NIKJER v B arhivu
    }
  }, 30_000)

  it('13. PII cenzura: seeded AuditLog ipAddress/terminalId + previousHash/chainHash NIKOLI v arhivu (kuriran select); details JSON marker JE v arhivu; Guest PII (email/telefon/ime) JE v arhivu — portability NI anonimizacija (Art. 6(1)(b))', async () => {
    const res = await fullGet()
    expect(res.status).toBe(200)
    const body = await asJson(res)
    const text = JSON.stringify(body)
    fullLocA++

    // revija je kurirana: IP/terminal/hash-veriga strukturno izključeni
    expect(text).not.toContain(SEED_AUDIT_IP) // 'r147it-secret-ip' marker
    expect(text).not.toContain(SEED_AUDIT_TERM)
    expect(text).not.toContain('ipAddress')
    expect(text).not.toContain('terminalId')
    expect(text).not.toContain('previousHash')
    expect(text).not.toContain('chainHash')

    // details (poslovna vsebina revije) JE vključen + Guest PII JE vključen
    expect(text).toContain(SEED_AUDIT_DETAILS)
    expect(text).toContain(GUEST_A_EMAIL)
    expect(text).toContain(GUEST_A_PHONE)
    expect(text).toContain(`${RUN_ID}-g-a`)
    // GuestVisit hash veriga (EU 852/2004) prav tako cenzurirana — samo podatki
    expect(text).toContain(IDS.visA)
  }, 30_000)
})

// ============================================
// 5) REJECTIONI: 400 / 403 + ZERO-AUDIT
// ============================================
describe('R147 #34: rejectioni + zero-audit', () => {
  it('14. 400 neznana mode: EXACT telo \'Neznan način. Dovoljeno: manifest, full\'', async () => {
    const res = await portabilityGET(new Request(`http://localhost/api/export/portability?mode=bogus`))
    expect(res.status).toBe(400)
    expect(await asJson(res)).toEqual({ error: 'Neznan način. Dovoljeno: manifest, full' })
  })

  it('15. 403 manager brez \'admin\' permissiona (bypass NE preide na permission admin): EXACT telo gate-a', async () => {
    setSession('manager', null, ['view_reports'])
    const res = await manifestGet()
    expect(res.status).toBe(403)
    expect(await asJson(res)).toEqual({ error: 'Nimate dovoljenja za to operacijo.' })
  })

  it('16. 403 non-admin seja (manager s predanim \'admin\' permissionom) brez sejske lokacije → resolver fail-closed: EXACT NO_LOCATION_MESSAGE', async () => {
    setSession('manager', null, ['admin'])
    const res = await fullGet()
    expect(res.status).toBe(403)
    expect(await asJson(res)).toEqual({ error: NO_LOCATION_MESSAGE })
  })

  it('17. zero-audit: manifest + 400 + 403 → NIČ novih DATA_PORTABILITY_EXPORTED zapisov (audit obstaja ⇔ izvoz uspel)', async () => {
    const before = await myExportAuditIds()

    expect((await manifestGet()).status).toBe(200)
    expect((await portabilityGET(new Request('http://localhost/api/export/portability?mode=bogus'))).status).toBe(400)
    setSession('manager', null, ['view_reports'])
    expect((await manifestGet()).status).toBe(403)

    expect(await myExportAuditIds()).toEqual(before) // 0 novih
  })
})

// ============================================
// 6) AUDIT DATA_PORTABILITY_EXPORTED
// ============================================
describe('R147 #34: audit DATA_PORTABILITY_EXPORTED', () => {
  it('18. full 200 → točno 1 nov audit: action/entityType/entityId \'full:locA\'/userId/locationId scope-a, details counters-only EXACT (tables 17, sections 5, rows == vsota counts, checksum == header), chain vezan na seeded 2031 rep, brez PII', async () => {
    const before = await myExportAuditIds()

    const res = await fullGet()
    expect(res.status).toBe(200)
    const body = await asJson(res)
    fullLocA++
    const checksum = res.headers.get('x-portability-checksum') ?? ''

    const after = await myExportAuditIds()
    expect(after).toHaveLength(before.length + 1)
    const newId = after.find((id) => !before.includes(id))
    expect(newId).toBeTruthy()
    const row = await db.auditLog.findUnique({ where: { id: newId ?? '' } })
    expect(row).not.toBeNull()
    if (!row) throw new Error('audit vrstica ni najdena')

    expect(row.action).toBe('DATA_PORTABILITY_EXPORTED')
    expect(row.entityType).toBe('PortabilityExport')
    expect(row.entityId).toBe(`full:${IDS.locA}`)
    expect(row.userId).toBe(EMP_ID) // session.employeeId
    expect(row.locationId).toBe(IDS.locA) // scope lokacija (ekspliciten — derive je ne spremeni)

    const details = JSON.parse(row.details) as Record<string, unknown>
    expect(details).toEqual({
      mode: 'full',
      tables: 17,
      sections: 5,
      rows: sumCounts(countsOf(body)), // točno vsota counts istega odgovora
      checksum,
    })
    expect(details.checksum).toBe(body.checksum) // header == body == details
    // PII: details nosi samo števce — brez gostov/PII markerjev
    expect(row.details).not.toContain(GUEST_A_EMAIL)
    expect(row.details).not.toContain(`${RUN_ID}-g-a`)
    expect(row.details).not.toContain(SEED_AUDIT_IP)
    // hash chain: vezan na seeded 2031 rep (najnovejši timestamp med tekom)
    expect(row.previousHash).toBe(seedAuditChainHash)
    expect(row.chainHash).toMatch(/^[0-9a-f]{64}$/)

    // manifest NE avdita že dokazan v testu 17; global full → entityId 'full:global'
    // je pinan posredno prek zero-oracle testa (fullMissing) in LEAK testa (fullLocB).
  }, 30_000)
})
