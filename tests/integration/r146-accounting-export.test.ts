// @vitest-environment node
// ============================================
// R146 / EPIC #115 #33 — INTEGRACIJA: ACCOUNTING EXPORTS
// (6 novih CSV izvozov: payments/refunds/purchases/expenses/daily-close/journal
//  + MODEL A scope + reproducibilnost + audit ACCOUNTING_EXPORTED)
// ============================================
// Prava PGlite (IT DB, PGLITE_DATA_DIR=/tmp/pglite-data-it iz
// vitest.config.integration.ts; fileParallelism: false). R146 je ZERO
// migration → IT DB ne rabi migracij. Dev server teče na /tmp/pglite-data
// (ločena instanca) — te datoteki se ne dotika.
//
// Kontrakt (R146-b, kot IMPLEMENTIRANO — route.ts + _helpers):
//   GET /api/reports/export?type=<t>&format=<f>&startDate=<yyyy-MM-dd>&endDate=<yyyy-MM-dd>[&locationId=<id>]
//     • rate bucket 'reports-export' PRED authom (AUTHENTICATED_LIMIT 120/min —
//       ta datoteka porabi ~25 klicev, varno pod mejo; in-memory store),
//     • requireAuth permission 'view_reports' (inventory: 'admin' — ni testran
//       tukaj; unit r146-b ga pinira),
//     • MODEL A scope prek resolveTenantLocationIdOrThrow (REALEN — ni mockan;
//       ruta ga uvaža iz '@/lib/tenant-scope'): regular brez sejske lokacije →
//       403 NO_LOCATION_MESSAGE fail-closed; lokacijska seja avtoritativna
//       (?locationId ignoriran); super-admin brez ?locationId = null scope =
//       GLOBALNI izvoz, z ?locationId = cross-branch,
//     • 6 novih tipov SAMO CSV (format≠csv → 400 'Neznan format. Dovoljeni: csv'),
//     • payments/refunds scope RELACIJSKO prek check.order.locationId
//       (Payment NIMA locationId — LEAK test!); purchases/daily-close/expenses
//       prek lastnega locationId (PO.locationId nullable → lokacijski scope
//       IZKLJUČI null-PO, super-admin jih vidi globalno); journal prek
//       journalEntry.locationId (source of truth, ne denormalizirana vrstica),
//     • audit ACCOUNTING_EXPORTED SAMO ob 200 (entityType 'ReportExport',
//       entityId `${type}:${format}`, userId = session.employeeId, locationId =
//       scope lokacija ALI null, details {type,format,startDate,endDate,
//       rows: countCsvRows(csv)}); NIČ ob 400/401/403/429,
//     • odgovor: BOM (EF BB BF) + CSV (';' ločilo, CSV-injection zaščita:
//       vodilni '=' '+' '-' '@' → "'" prefix — negativen znesek dobi prefix!),
//       Content-Type 'text/csv; charset=utf-8', Content-Disposition attachment
//       z SL imenom (placila_/povracila_/nabava_/stroski_/dnevni_zakljucek_/
//       dnevnik_ + <start>_<end>.csv), Cache-Control no-store.
//
// SEED STRATEGIJA (r144/r145 kanon): 2 dedikirani lokaciji (A/B) z RUN_ID,
//   admin employee, Order→Check→Payment na A (cash 50/5, card 80/8 visa
//   ****1234, card 30/0 refund 12.50 'refunded') in B (mobile 20/2, cash 40/0
//   refund 5 'refunded'), Supplier + 2 PO (locA 'invoiced' 100/22/122 +
//   NULL-lokacija 'none' 10/2.20/12.20), DailyClose A (variance −15 →
//   CSV-injection pin) in B, JournalEntry+2 vrstice na A in B, 3 Expense
//   AuditLog vrstice (audit-log-as-ledger — TO je vir expenses izvoza, R146-b;
//   details JSON STRING z vendor PII markerjem, ki NE sme uhajati v CSV).
//   Datumsko okno je ZASEBNO (2031, DAY_OFF iz RUN_ID, UTC-noon varno) →
//   globalni izvozi v oknu vsebujejo TOČNO seeded vrstice (exact-count oracle).
//
// AUDIT VERIGA (r144-d/r145-d pravilo): seeded Expense AuditLog vrstice so del
//   tekaškega repa produkcijske hash verige — pišem jih z ROKA IZRAČUNANIM
//   previousHash/chainHash (isti payload format kot createAuditLog v db.ts) in
//   timestampom v 2031 → route-ovi ACCOUNTING_EXPORTED zapisi se vezjejo nanje
//   (findFirst timestamp desc). afterAll briše VSE svoje AuditLog vrstice
//   (userId = EMP_ID pokrije seed + route zapise) KOT PRVE, nato FK-urejeno:
//   journalLine→journalEntry→payment→check→order→purchaseOrder→dailyClose→
//   supplier→employee→lokaciji; nato EMPIRIČNA verifikacija (rep po čiščenju
//   == rep pred zagonom + 0 ostankov po vseh tabelah). Datoteka teče ZADNJA
//   po abecedi (r146 > r145) → veriga se vrne v stanje pred zagonom.
//
// BOM (R146-b lekcija): Response.text() BOM odstrani (TextDecoder
//   ignoreBOM=false) → telo berem prek res.arrayBuffer() in pinam prvih 3
//   bajta [0xEF,0xBB,0xBF]; tekst = Buffer.from(bytes.slice(3)).toString('utf8').
//
// EXPENSES CAP 5000 (test 17): integracijski dokaz bi zahteval 5001 seeded
//   AuditLog vrstic (drago + krhko) → pin je KODNI-INSPEKCIJSKI
//   (fs.readFileSync: 'const EXPENSES_EXPORT_CAP = 5000' + 'take:
//   EXPENSES_EXPORT_CAP' v accounting-reports.ts). Unit r146-b pinira take
//   5000 na findMany mocku (prava query shape) — skupaj pokrito.
//
// Zagon: bunx vitest run tests/integration/r146-accounting-export.test.ts \
//          --config vitest.config.integration.ts
// ============================================

import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
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

// ISTI vzorec kot r144/r145 (kanon): realen auth-middleware (importOriginal
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
import { GET as exportGET } from '@/app/api/reports/export/route'
import { countCsvRows } from '@/app/api/reports/export/_helpers/accounting-reports'
import { NO_LOCATION_MESSAGE } from '@/lib/tenant-scope'

const RUN_ID = `r146-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const EMP_ID = `${RUN_ID}-admin`

// ---------- Datumi: ZASEBNO okno (2031, DAY_OFF iz RUN_ID) — vsi datumi v
// UTC, tako da je obseg [startDate 00:00:00Z, endDate 23:59:59.999Z]
// neodvisen od TZ peskovnika (route: new Date('yyyy-MM-dd') = UTC polnoč,
// endOfDayParam = <end>T23:59:59.999Z).
const rawOff = parseInt(RUN_ID.slice(-6), 36)
const DAY_OFF = (Number.isNaN(rawOff) ? 42 : rawOff) % 400
const DAY_BASE = Date.UTC(2031, 2, 1 + DAY_OFF) // polnoč UTC zasebnega okna
const at = (h: number, min = 0): Date => new Date(DAY_BASE + h * 3_600_000 + min * 60_000)
const dayParam = (d: Date): string => d.toISOString().slice(0, 10) // yyyy-MM-dd (UTC)
const START = dayParam(new Date(DAY_BASE))
const END = dayParam(new Date(DAY_BASE + 86_400_000))
const RANGE_QS = `startDate=${START}&endDate=${END}`
// prazen range: 4–5 dni PRED oknom (nič seeded → header-only)
const EMPTY_START = dayParam(new Date(DAY_BASE - 5 * 86_400_000))
const EMPTY_END = dayParam(new Date(DAY_BASE - 4 * 86_400_000))

const IDS = {
  locA: `${RUN_ID}-loc-a`,
  locB: `${RUN_ID}-loc-b`,
  ordA: `${RUN_ID}-ord-a`,
  ordB: `${RUN_ID}-ord-b`,
  chkA: `${RUN_ID}-chk-a`,
  chkB: `${RUN_ID}-chk-b`,
  payA1: `${RUN_ID}-pay-a1`,
  payA2: `${RUN_ID}-pay-a2`,
  payA3: `${RUN_ID}-pay-a3`,
  payB1: `${RUN_ID}-pay-b1`,
  payB2: `${RUN_ID}-pay-b2`,
  supplier: `${RUN_ID}-sup`,
  poA: `${RUN_ID}-po-a`,
  poNull: `${RUN_ID}-po-null`,
  dcA: `${RUN_ID}-dc-a`,
  dcB: `${RUN_ID}-dc-b`,
  jeA: `${RUN_ID}-je-a`,
  jeB: `${RUN_ID}-je-b`,
  jlA1: `${RUN_ID}-jl-a1`,
  jlA2: `${RUN_ID}-jl-a2`,
  jlB1: `${RUN_ID}-jl-b1`,
  jlB2: `${RUN_ID}-jl-b2`,
}

const LOC_IDS = [IDS.locA, IDS.locB]
const ORDER_IDS = [IDS.ordA, IDS.ordB]
const PAY_IDS = [IDS.payA1, IDS.payA2, IDS.payA3, IDS.payB1, IDS.payB2]
const PO_IDS = [IDS.poA, IDS.poNull]
const DC_IDS = [IDS.dcA, IDS.dcB]
const JE_IDS = [IDS.jeA, IDS.jeB]
const JL_IDS = [IDS.jlA1, IDS.jlA2, IDS.jlB1, IDS.jlB2]

const LOC_A_NAME = `R146 Glavna ${RUN_ID}`
const LOC_B_NAME = `R146 Filiala ${RUN_ID}`
const SUPPLIER_NAME = `Dobavitelj ${RUN_ID}`
const PO_A_NUMBER = `PO-${RUN_ID}-A`
const PO_NULL_NUMBER = `PO-${RUN_ID}-Z`
const JE_A_NUMBER = `JE-R146-${RUN_ID}-A`
const JE_B_NUMBER = `JE-R146-${RUN_ID}-B`
// PII markerji, ki NIKOLI ne smejo uhajati v CSV/audit details
const AUTH_CODE = `AUTH-${RUN_ID}` // Payment.authorizationCode (full-pan proxy)
const EXPENSE_VENDOR = `Vendor-PII-${RUN_ID}` // Expense details.vendor

// ---------- Response helperji (BOM pin na BAJTNI ravni — R146-b lekcija) ----------
async function bodyBytes(res: Response): Promise<Uint8Array> {
  return new Uint8Array(await res.arrayBuffer())
}

function bytesText(bytes: Uint8Array): string {
  return Buffer.from(bytes.slice(3)).toString('utf8') // brez BOM
}

function dataRows(bodyNoBom: string): string[] {
  return bodyNoBom.split('\n').slice(1).filter((l) => l.length > 0)
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function exportQs(type: string, format = 'csv', extra = ''): string {
  return `type=${type}&format=${format}&${RANGE_QS}${extra}`
}

function exportGet(query: string): Promise<Response> {
  // Absolutni URL (kanon — Request v Next 16 zahteva absolutni naslov)
  return exportGET(new Request(`http://localhost/api/reports/export?${query}`))
}

function setSession(role: string, locationId: string | null, permissions: string[]): void {
  authRef.current = { employeeId: EMP_ID, role, locationId, permissions }
}

// ---------- Točne CSV glave (R146-b accounting-reports.ts, 1:1) ----------
const PAYMENTS_HEADER = 'Datum;Metoda;Status;Znesek (EUR);Napitnina (EUR);Povračilo (EUR);Kartica;Referenca'
const REFUNDS_HEADER = 'Datum;Originalni znesek;Povračilo;Metoda;Status;Referenca'
const PURCHASES_HEADER = 'Datum;Št. naročila;Dobavitelj;Stanje računa;Brez DDV;DDV;Skupaj'
const EXPENSES_HEADER = 'Datum;Opis;Kategorija;Znesek;Uporabnik;Referenca'
const DAILYCLOSE_HEADER = 'Poslovni dan;Lokacija;Prodaja skupaj;Gotovina;Kartica;Mobilna;Alternativna;Popusti;Napitnine;Preklici;Povračila;Odstopanje gotovine'
const JOURNAL_HEADER = 'Vnos;Datum;Konto;Konto ime;Bremenitev (debit);Kronanje (kredit);Referenca;Vir;Status vnosa'

// ---------- Pričakovane podatkovne vrstice (iz seedov, ISO datumi, EUR toFixed(2)) ----------
const PAY_A1_ROW = `${at(6).toISOString()};cash;completed;50.00;5.00;0.00;;${IDS.payA1}`
const PAY_A2_ROW = `${at(7).toISOString()};card;completed;80.00;8.00;0.00;visa ****1234;${IDS.payA2}`
const PAY_A3_ROW = `${at(8).toISOString()};card;refunded;30.00;0.00;12.50;mastercard ****9876;${IDS.payA3}`
const PAY_B1_ROW = `${at(9).toISOString()};mobile;completed;20.00;2.00;0.00;;${IDS.payB1}`
const PAY_B2_ROW = `${at(10).toISOString()};cash;refunded;40.00;0.00;5.00;;${IDS.payB2}`
const REFUND_A3_ROW = `${at(8).toISOString()};30.00;12.50;card;refunded;${IDS.payA3}`
const REFUND_B2_ROW = `${at(10).toISOString()};40.00;5.00;cash;refunded;${IDS.payB2}`
const PO_A_ROW = `${at(12).toISOString()};${PO_A_NUMBER};${SUPPLIER_NAME};invoiced;100.00;22.00;122.00`
const PO_NULL_ROW = `${at(13).toISOString()};${PO_NULL_NUMBER};${SUPPLIER_NAME};none;10.00;2.20;12.20`
const DC_A_ROW = `${new Date(DAY_BASE).toISOString()};${LOC_A_NAME};500.00;200.00;250.00;30.00;20.00;10.00;40.00;5.00;12.50;'-15.00`
const DC_B_ROW = `${new Date(DAY_BASE).toISOString()};${LOC_B_NAME};100.00;100.00;0.00;0.00;0.00;0.00;0.00;0.00;0.00;0.00`
const JE_A1_ROW = `${JE_A_NUMBER};${at(14).toISOString()};1010;Blagajna;122.00;0.00;order:${RUN_ID}-ref-a;manual;posted`
const JE_A2_ROW = `${JE_A_NUMBER};${at(14).toISOString()};7000;Promet — na mestu;0.00;122.00;order:${RUN_ID}-ref-a;manual;posted`
const JE_B1_ROW = `${JE_B_NUMBER};${at(15).toISOString()};5000;Stroški materiala;10.00;0.00;expense:${RUN_ID}-ref-b;auto-expense;posted`
const JE_B2_ROW = `${JE_B_NUMBER};${at(15).toISOString()};1010;Blagajna;0.00;10.00;expense:${RUN_ID}-ref-b;auto-expense;posted`

// Expense zapisi (AuditLog) — id-ji nastanejo ob seedom (Referenca stolpec = log.id)
const EXPENSE_SEEDS = [
  { action: 'EXPENSE_SUPPLIES', details: { description: `Kava ${RUN_ID}`, category: 'zaloge', amount: 25.5, vendor: EXPENSE_VENDOR, paymentMethod: 'cash' }, timestamp: at(16), locationId: IDS.locA },
  { action: 'EXPENSE_SERVICES', details: { description: `Čistilni servis ${RUN_ID}`, category: 'storitve', amount: 10, vendor: EXPENSE_VENDOR, paymentMethod: 'card' }, timestamp: at(16, 30), locationId: IDS.locB },
  { action: 'EXPENSE_UTILITIES', details: { description: `Režija ${RUN_ID}`, category: 'rezija', amount: 40, vendor: EXPENSE_VENDOR, paymentMethod: 'cash' }, timestamp: at(17), locationId: IDS.locA },
]
const EXPENSE_IDS: string[] = []
const EXPENSE_ROW_TEMPLATES = [
  (id: string): string => `${at(16).toISOString()};Kava ${RUN_ID};zaloge;25.50;${EMP_ID};${id}`,
  (id: string): string => `${at(16, 30).toISOString()};Čistilni servis ${RUN_ID};storitve;10.00;${EMP_ID};${id}`,
  (id: string): string => `${at(17).toISOString()};Režija ${RUN_ID};rezija;40.00;${EMP_ID};${id}`,
]

// ---------- Audit veriga: rep pred zagonom + seeded expense rep ----------
let auditTailBefore: string | null = null
let expenseTailHash: string | null = null // chainHash zadnje seeded Expense vrstice

/** Seeda AuditLog vrstico z ročno izračunano hash vezavo (1:1 payload format
 *  createAuditLog v db.ts) — expense ledger mora biti del produkcijske verige,
 *  da se route-ovi ACCOUNTING_EXPORTED zapisi vezjejo nanjo (findFirst
 *  timestamp desc — 2031 timestampi so med tekom najnovejši). */
async function seedAuditEntry(entry: {
  action: string
  entityType: string
  entityId?: string
  details: Record<string, unknown>
  timestamp: Date
  locationId: string | null
}): Promise<string> {
  const last = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  const previousHash = last?.chainHash || ''
  const detailsStr = JSON.stringify(entry.details)
  const hashPayload = [previousHash, entry.action, entry.entityType, entry.entityId || '', EMP_ID, detailsStr].join('|')
  const chainHash = createHash('sha256').update(hashPayload).digest('hex')
  const created = await db.auditLog.create({
    data: {
      userId: EMP_ID,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      details: detailsStr,
      ipAddress: '',
      terminalId: null,
      locationId: entry.locationId,
      previousHash,
      chainHash,
      timestamp: entry.timestamp,
    },
  })
  expenseTailHash = chainHash
  return created.id
}

/** Moj ACCOUNTING_EXPORTED zapisi (diff po id-jih med dvema točkama v času). */
async function myExportAuditIds(): Promise<string[]> {
  const rows = await db.auditLog.findMany({
    where: { userId: EMP_ID, action: 'ACCOUNTING_EXPORTED' },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

beforeAll(async () => {
  // 0) AuditLog rep PRED zagonom (chain kontinuiteta v afterAll — r144-d pravilo)
  const tailRow = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  auditTailBefore = tailRow?.chainHash ?? null

  // 1) Dve dedikirani lokaciji (A = matična, B = filiala)
  await db.location.create({ data: { id: IDS.locA, code: `${RUN_ID}-A`, name: LOC_A_NAME, premisesId: `${RUN_ID}-pA`, isActive: true } })
  await db.location.create({ data: { id: IDS.locB, code: `${RUN_ID}-B`, name: LOC_B_NAME, premisesId: `${RUN_ID}-pB`, isActive: true } })

  // 2) Test-admin (unikaten email + pin; seja je hand-built, vrstica je realen
  //    lastnik audit userId-jev)
  await db.employee.create({ data: { id: EMP_ID, name: `Test Admin ${RUN_ID}`, email: `r146-${RUN_ID}@test.local`, pin: `pin-${RUN_ID}-a`, role: 'admin', locationId: IDS.locA } })

  // 3) Order→Check→Payment na A (3: cash 50/5, card 80/8 visa, card 30 refund 12.50)
  await db.order.create({ data: { id: IDS.ordA, orderNumber: 1, locationId: IDS.locA, status: 'completed', paymentStatus: 'paid' } })
  await db.check.create({ data: { id: IDS.chkA, orderId: IDS.ordA, checkNumber: 1, total: 160, paymentStatus: 'paid' } })
  await db.payment.create({ data: { id: IDS.payA1, checkId: IDS.chkA, amount: 50, tipAmount: 5, refundAmount: 0, type: 'cash', status: 'completed', createdAt: at(6) } })
  await db.payment.create({ data: { id: IDS.payA2, checkId: IDS.chkA, amount: 80, tipAmount: 8, refundAmount: 0, type: 'card', status: 'completed', cardType: 'visa', cardLast4: '1234', authorizationCode: AUTH_CODE, createdAt: at(7) } })
  await db.payment.create({ data: { id: IDS.payA3, checkId: IDS.chkA, amount: 30, tipAmount: 0, refundAmount: 12.5, type: 'card', status: 'refunded', cardType: 'mastercard', cardLast4: '9876', createdAt: at(8) } })

  // 4) Order→Check→Payment na B (2: mobile 20/2, cash 40 refund 5)
  await db.order.create({ data: { id: IDS.ordB, orderNumber: 1, locationId: IDS.locB, status: 'completed', paymentStatus: 'paid' } })
  await db.check.create({ data: { id: IDS.chkB, orderId: IDS.ordB, checkNumber: 1, total: 60, paymentStatus: 'paid' } })
  await db.payment.create({ data: { id: IDS.payB1, checkId: IDS.chkB, amount: 20, tipAmount: 2, refundAmount: 0, type: 'mobile', status: 'completed', createdAt: at(9) } })
  await db.payment.create({ data: { id: IDS.payB2, checkId: IDS.chkB, amount: 40, tipAmount: 0, refundAmount: 5, type: 'cash', status: 'refunded', createdAt: at(10) } })

  // 5) Supplier + 2 PurchaseOrder (A 'invoiced' + NULL-lokacija 'none')
  await db.supplier.create({ data: { id: IDS.supplier, name: SUPPLIER_NAME, code: `SUP-${RUN_ID}`, isActive: true } })
  await db.purchaseOrder.create({ data: { id: IDS.poA, poNumber: PO_A_NUMBER, supplierId: IDS.supplier, status: 'received', invoiceStatus: 'invoiced', orderDate: at(12), subtotal: 100, vatAmount: 22, totalAmount: 122, locationId: IDS.locA } })
  await db.purchaseOrder.create({ data: { id: IDS.poNull, poNumber: PO_NULL_NUMBER, supplierId: IDS.supplier, status: 'sent', invoiceStatus: 'none', orderDate: at(13), subtotal: 10, vatAmount: 2.2, totalAmount: 12.2, locationId: null } })

  // 6) DailyClose A (variance −15 → CSV-injection "'" prefix pin) + B
  await db.dailyClose.create({ data: { id: IDS.dcA, locationId: IDS.locA, businessDate: new Date(DAY_BASE), status: 'CLOSED', totalSales: 500, cashSales: 200, cardSales: 250, mobileSales: 30, alternateSales: 20, totalDiscounts: 10, totalTips: 40, totalVoided: 5, totalRefunds: 12.5, expectedCash: 210, countedCash: 195, cashVariance: -15, idempotencyKey: `${RUN_ID}-dc-a-key` } })
  await db.dailyClose.create({ data: { id: IDS.dcB, locationId: IDS.locB, businessDate: new Date(DAY_BASE), status: 'PENDING_APPROVAL', totalSales: 100, cashSales: 100, idempotencyKey: `${RUN_ID}-dc-b-key` } })

  // 7) JournalEntry + JournalLine (double-entry 122 = 122 na A; 10 = 10 na B)
  await db.journalEntry.create({ data: { id: IDS.jeA, entryNumber: JE_A_NUMBER, date: at(14), createdAt: at(14), locationId: IDS.locA, reference: `${RUN_ID}-ref-a`, referenceType: 'order', description: `R146 dnevnik A ${RUN_ID}`, source: 'manual', status: 'posted' } })
  await db.journalLine.create({ data: { id: IDS.jlA1, journalEntryId: IDS.jeA, accountCode: '1010', accountName: 'Blagajna', accountType: 'asset', debit: 122, credit: 0, locationId: IDS.locA, description: `R146 bremenitev ${RUN_ID}` } })
  await db.journalLine.create({ data: { id: IDS.jlA2, journalEntryId: IDS.jeA, accountCode: '7000', accountName: 'Promet — na mestu', accountType: 'revenue', debit: 0, credit: 122, locationId: IDS.locA, description: `R146 kronanje ${RUN_ID}` } })
  await db.journalEntry.create({ data: { id: IDS.jeB, entryNumber: JE_B_NUMBER, date: at(15), createdAt: at(15), locationId: IDS.locB, reference: `${RUN_ID}-ref-b`, referenceType: 'expense', description: `R146 dnevnik B ${RUN_ID}`, source: 'auto-expense', status: 'posted' } })
  await db.journalLine.create({ data: { id: IDS.jlB1, journalEntryId: IDS.jeB, accountCode: '5000', accountName: 'Stroški materiala', accountType: 'expense', debit: 10, credit: 0, locationId: IDS.locB } })
  await db.journalLine.create({ data: { id: IDS.jlB2, journalEntryId: IDS.jeB, accountCode: '1010', accountName: 'Blagajna', accountType: 'asset', debit: 0, credit: 10, locationId: IDS.locB } })

  // 8) Expense AuditLog vrstice (audit-log-as-ledger — vir expenses izvoza),
  //    hash-vezane na produkcijsko verigo; timestampi 2031 → route audit
  //    (now() = 2026) se vedno vezje na zadnjo od njih.
  for (const seed of EXPENSE_SEEDS) {
    EXPENSE_IDS.push(await seedAuditEntry({ ...seed, entityType: 'Expense' }))
  }
}, 60_000)

beforeEach(() => {
  // Privzeta seja: admin na glavni lokaciji A (posamezni testi jo zamenjajo)
  setSession('admin', IDS.locA, ['admin'])
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO lastne RUN_ID vrstice (r142-d/r144-d/r145-d pravilo):
  //   1) AUDIT vrstice PRVE (vse po userId EMP_ID: seeded Expense ledger + route
  //      ACCOUNTING_EXPORTED zapisi — vsi so del tekaškega repa hash verige),
  //   2) JournalLine → JournalEntry (Restrict FK),
  //   3) Payment → Check → Order (Payment.check Restrict),
  //   4) PurchaseOrder (Supplier Restrict → PO prej), DailyClose, Supplier,
  //   5) Employee, lokaciji.
  // Nato EMPIRIČNA verifikacija: rep po čiščenju == rep pred zagonom + 0 ostankov.
  await db.auditLog.deleteMany({ where: { userId: EMP_ID } }).catch(() => {})
  await db.journalLine.deleteMany({ where: { id: { in: JL_IDS } } }).catch(() => {})
  await db.journalEntry.deleteMany({ where: { id: { in: JE_IDS } } }).catch(() => {})
  await db.payment.deleteMany({ where: { id: { in: PAY_IDS } } }).catch(() => {})
  await db.check.deleteMany({ where: { orderId: { in: ORDER_IDS } } }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: ORDER_IDS } } }).catch(() => {})
  await db.purchaseOrder.deleteMany({ where: { id: { in: PO_IDS } } }).catch(() => {})
  await db.dailyClose.deleteMany({ where: { id: { in: DC_IDS } } }).catch(() => {})
  await db.supplier.deleteMany({ where: { id: IDS.supplier } }).catch(() => {})
  await db.employee.deleteMany({ where: { OR: [{ id: EMP_ID }, { email: { contains: RUN_ID } }] } }).catch(() => {})
  await db.location.deleteMany({ where: { id: { in: LOC_IDS } } }).catch(() => {})

  // --- EMPIRIČNA VERIFIKACIJA ČIŠČENJA ---
  const tailAfter = await db.auditLog.findFirst({ orderBy: { timestamp: 'desc' }, select: { chainHash: true } })
  expect(tailAfter?.chainHash ?? null).toBe(auditTailBefore)
  expect(await db.auditLog.count({ where: { userId: EMP_ID } })).toBe(0)
  expect(await db.auditLog.count({ where: { entityType: 'Expense', details: { contains: RUN_ID } } })).toBe(0)
  expect(await db.journalLine.count({ where: { id: { in: JL_IDS } } })).toBe(0)
  expect(await db.journalEntry.count({ where: { id: { in: JE_IDS } } })).toBe(0)
  expect(await db.payment.count({ where: { id: { in: PAY_IDS } } })).toBe(0)
  expect(await db.check.count({ where: { orderId: { in: ORDER_IDS } } })).toBe(0)
  expect(await db.order.count({ where: { id: { in: ORDER_IDS } } })).toBe(0)
  expect(await db.purchaseOrder.count({ where: { id: { in: PO_IDS } } })).toBe(0)
  expect(await db.dailyClose.count({ where: { id: { in: DC_IDS } } })).toBe(0)
  expect(await db.supplier.count({ where: { name: SUPPLIER_NAME } })).toBe(0)
  expect(await db.employee.count({ where: { email: { contains: RUN_ID } } })).toBe(0)
  expect(await db.location.count({ where: { id: { in: LOC_IDS } } })).toBe(0)
  await db.$disconnect().catch(() => {})
}, 60_000)

// ============================================
// 1) CSV VSEBINA == SEED (privzeta seja: admin na A)
// ============================================
describe('R146 #33: CSV vsebina == seed (lokacija A)', () => {
  it('1. payments CSV: BOM [EF BB BF] + header EXACT + 3 seeded vrstice EXACT (zneski EUR toFixed(2), kartica maska, refund) + countCsvRows pariteta', async () => {
    const res = await exportGet(exportQs('payments'))
    expect(res.status).toBe(200)

    const bytes = await bodyBytes(res)
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]) // UTF-8 BOM (Response.text() ga bi odstranil!)
    const body = bytesText(bytes)

    const lines = body.split('\n')
    expect(lines[0]).toBe(PAYMENTS_HEADER)
    expect(dataRows(body)).toEqual([PAY_A1_ROW, PAY_A2_ROW, PAY_A3_ROW]) // orderBy createdAt asc, id asc

    // countCsvRows (IZVOŽEN quote-aware števec) == št. podatkovnih vrstic == seed
    expect(countCsvRows(body)).toBe(3)
  })

  it('2. refunds CSV (A): header EXACT + samo refund vrstica (payA3) EXACT; ne-refund plačila izpuščena', async () => {
    const res = await exportGet(exportQs('refunds'))
    expect(res.status).toBe(200)

    const body = bytesText(await bodyBytes(res))
    const rows = dataRows(body)
    expect(body.split('\n')[0]).toBe(REFUNDS_HEADER)
    expect(rows).toEqual([REFUND_A3_ROW]) // refundAmount 12.50 > 0 AND status 'refunded'
    expect(body).not.toContain(IDS.payA1)
    expect(body).not.toContain(IDS.payA2)
    expect(body).not.toContain(IDS.payB2) // B je izven seje A (scope)
  })

  it('3. purchases CSV (A): header EXACT + PO-A vrstica EXACT; NULL-lokacijska PO IZKLJUČENA (fail-closed, R146-b kanon)', async () => {
    const res = await exportGet(exportQs('purchases'))
    expect(res.status).toBe(200)

    const body = bytesText(await bodyBytes(res))
    expect(body.split('\n')[0]).toBe(PURCHASES_HEADER)
    expect(dataRows(body)).toEqual([PO_A_ROW]) // orderBy orderDate asc; poNull IZVEN lokacijskega scope-a
    expect(body).not.toContain(PO_NULL_NUMBER)
  })

  it('4. expenses CSV (A): header EXACT + 2 seeded vrstici EXACT (details JSON parse: Opis/Kategorija/Znesek/Uporabnik=userId) + vendor PII NIKOLI v CSV', async () => {
    const res = await exportGet(exportQs('expenses'))
    expect(res.status).toBe(200)

    const body = bytesText(await bodyBytes(res))
    expect(body.split('\n')[0]).toBe(EXPENSES_HEADER)
    // Referenca = AuditLog.id (nastane ob seedom); Uporabnik = userId (employee ID — PII-min)
    expect(dataRows(body)).toEqual([EXPENSE_ROW_TEMPLATES[0](EXPENSE_IDS[0] ?? ''), EXPENSE_ROW_TEMPLATES[2](EXPENSE_IDS[2] ?? '')])
    // PII: vendor iz details JSON-a NE sme uhajati v izvoz (R146-b deviation 5)
    expect(body).not.toContain(EXPENSE_VENDOR)
    // B-lokacijski strošek izven seje A
    expect(body).not.toContain(EXPENSE_IDS[1] ?? 'no-exp-b-id')
  })

  it('5. daily-close CSV (A): header EXACT (12 stolpcev) + vrstica EXACT z imenom lokacije; −15.00 → CSV-injection "\'" prefix', async () => {
    const res = await exportGet(exportQs('daily-close'))
    expect(res.status).toBe(200)

    const body = bytesText(await bodyBytes(res))
    expect(body.split('\n')[0]).toBe(DAILYCLOSE_HEADER)
    expect(dataRows(body)).toEqual([DC_A_ROW]) // B close izven seje A
    expect(body).toContain(LOC_A_NAME)
    // CSV-injection zaščita: vodilni '-' v '-15.00' dobi "'" prefix (escapeCsvField)
    expect(body).toContain("'-15.00")
  })

  it('6. journal CSV (A): header EXACT + 2 double-entry vrstici EXACT (debit/kredit po JournalLine); B-vnosi izpuščeni', async () => {
    const res = await exportGet(exportQs('journal'))
    expect(res.status).toBe(200)

    const body = bytesText(await bodyBytes(res))
    expect(body.split('\n')[0]).toBe(JOURNAL_HEADER)
    expect(dataRows(body)).toEqual([JE_A1_ROW, JE_A2_ROW]) // orderBy entry.createdAt asc, line.id asc
    expect(body).not.toContain(JE_B_NUMBER)
    expect(body).not.toContain('5000;Stroški materiala') // B konta ne smejo uhajati
  })
})

// ============================================
// 2) SCOPE IZOLACIJA + MODEL A
// ============================================
describe('R146 #33: scope izolacija + MODEL A', () => {
  it('7. LEAK test: admin A vidi TOČNO 3 A plačila (brez B id-jev); admin B vidi TOČNO 2 B plačili (brez A id-jev) — relacijski scope check.order.locationId', async () => {
    const resA = await exportGet(exportQs('payments'))
    expect(resA.status).toBe(200)
    const bodyA = bytesText(await bodyBytes(resA))
    expect(dataRows(bodyA)).toEqual([PAY_A1_ROW, PAY_A2_ROW, PAY_A3_ROW])
    expect(bodyA).not.toContain(IDS.payB1)
    expect(bodyA).not.toContain(IDS.payB2)

    setSession('admin', IDS.locB, ['admin'])
    const resB = await exportGet(exportQs('payments'))
    expect(resB.status).toBe(200)
    const bodyB = bytesText(await bodyBytes(resB))
    expect(dataRows(bodyB)).toEqual([PAY_B1_ROW, PAY_B2_ROW])
    expect(bodyB).not.toContain(IDS.payA1)
    expect(bodyB).not.toContain(IDS.payA2)
    expect(bodyB).not.toContain(IDS.payA3)
  })

  it('8. MODEL A super-admin: brez ?locationId → GLOBALNI izvoz (točno 5 plačil A+B); z ?locationId=<A> → cross-branch (točno 3 A)', async () => {
    setSession('super_admin', null, ['admin', 'view_reports'])
    const resGlobal = await exportGet(exportQs('payments'))
    expect(resGlobal.status).toBe(200)
    const bodyGlobal = bytesText(await bodyBytes(resGlobal))
    expect(dataRows(bodyGlobal)).toEqual([PAY_A1_ROW, PAY_A2_ROW, PAY_A3_ROW, PAY_B1_ROW, PAY_B2_ROW]) // exact-count oracle: zasebno okno

    const resScoped = await exportGet(exportQs('payments', 'csv', `&locationId=${encodeURIComponent(IDS.locA)}`))
    expect(resScoped.status).toBe(200)
    const bodyScoped = bytesText(await bodyBytes(resScoped))
    expect(dataRows(bodyScoped)).toEqual([PAY_A1_ROW, PAY_A2_ROW, PAY_A3_ROW])
    expect(bodyScoped).not.toContain(IDS.payB1)
    expect(bodyScoped).not.toContain(IDS.payB2)
  })

  it('9. MODEL A super-admin global: purchases vključi NULL-PO (2), refunds A+B (2), expenses vključi B strošek (3), daily-close A+B (2), journal vključi B vnose (4 vrstice)', async () => {
    setSession('super_admin', null, ['admin', 'view_reports'])

    const resPo = await exportGet(exportQs('purchases'))
    expect(resPo.status).toBe(200)
    expect(dataRows(bytesText(await bodyBytes(resPo)))).toEqual([PO_A_ROW, PO_NULL_ROW]) // orderBy orderDate asc: A (12h) pred NULL (13h)

    const resRef = await exportGet(exportQs('refunds'))
    expect(resRef.status).toBe(200)
    expect(dataRows(bytesText(await bodyBytes(resRef)))).toEqual([REFUND_A3_ROW, REFUND_B2_ROW]) // createdAt asc čez lokacije

    const resExp = await exportGet(exportQs('expenses'))
    expect(resExp.status).toBe(200)
    const expBody = bytesText(await bodyBytes(resExp))
    expect(dataRows(expBody)).toEqual([
      EXPENSE_ROW_TEMPLATES[0](EXPENSE_IDS[0] ?? ''),
      EXPENSE_ROW_TEMPLATES[1](EXPENSE_IDS[1] ?? ''), // B strošek VIDEN samo globalno (timestamp 16:30)
      EXPENSE_ROW_TEMPLATES[2](EXPENSE_IDS[2] ?? ''),
    ])

    const resDc = await exportGet(exportQs('daily-close'))
    expect(resDc.status).toBe(200)
    expect(dataRows(bytesText(await bodyBytes(resDc)))).toEqual([DC_A_ROW, DC_B_ROW]) // isti businessDate → id tiebreak (a < b)

    const resJr = await exportGet(exportQs('journal'))
    expect(resJr.status).toBe(200)
    expect(dataRows(bytesText(await bodyBytes(resJr)))).toEqual([JE_A1_ROW, JE_A2_ROW, JE_B1_ROW, JE_B2_ROW])
  })

  it('10. MODEL A regular (manager, view_reports) brez sejske lokacije → 403 EXACT NO_LOCATION_MESSAGE fail-closed; NIČ novih auditov', async () => {
    setSession('manager', null, ['view_reports'])
    const auditBefore = await myExportAuditIds()

    const res = await exportGet(exportQs('payments'))
    expect(res.status).toBe(403)
    expect(await asJson(res)).toEqual({ error: NO_LOCATION_MESSAGE })

    expect(await myExportAuditIds()).toEqual(auditBefore) // 403 NE piše audita
  })
})

// ============================================
// 3) REPRODUCIBILNOST (epic gate "[ ] accounting export reproducibility")
// ============================================
describe('R146 #33: reproducibilnost (epic gate)', () => {
  it('11. payments: 2 zaporedna klica istega poizvedbe → BYTE-IDENTIČEN body + prva podatkovna vrstica == orderBy pričakovana', async () => {
    const res1 = await exportGet(exportQs('payments'))
    const res2 = await exportGet(exportQs('payments'))
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const bytes1 = await bodyBytes(res1)
    const bytes2 = await bodyBytes(res2)
    expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true) // epic gate

    const body1 = bytesText(bytes1)
    expect(dataRows(body1)[0]).toBe(PAY_A1_ROW) // determinističen vrstni red: createdAt asc + id asc
  })

  it('12. daily-close: 2 zaporedna klica → BYTE-IDENTIČEN body (drugi epic-gate par)', async () => {
    const res1 = await exportGet(exportQs('daily-close'))
    const res2 = await exportGet(exportQs('daily-close'))
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const bytes1 = await bodyBytes(res1)
    const bytes2 = await bodyBytes(res2)
    expect(Buffer.from(bytes1).equals(Buffer.from(bytes2))).toBe(true)
    expect(bytes1.length).toBeGreaterThan(3 + DAILYCLOSE_HEADER.length) // ni pomote: res podatek, ne header-only
  })
})

// ============================================
// 4) REJECTIONI + HEADERS
// ============================================
describe('R146 #33: rejectioni + headers', () => {
  it('13. 400 neznan tip + 400 format≠csv za računovodski tip — EXACT telesi; NIČ novih audit zapisov', async () => {
    const auditBefore = await myExportAuditIds()

    const resType = await exportGet(exportQs('neznan-tip'))
    expect(resType.status).toBe(400)
    expect(await asJson(resType)).toEqual({ error: 'Neznana vrsta izvoza' })

    const resFormat = await exportGet(exportQs('payments', 'pdf'))
    expect(resFormat.status).toBe(400)
    expect(await asJson(resFormat)).toEqual({ error: 'Neznan format. Dovoljeni: csv' })

    expect(await myExportAuditIds()).toEqual(auditBefore) // 400 NE piše audita (audit obstaja ⇔ izvoz uspel)
  })

  it('14. prazen datumski range → 200 + header-only CSV (točno header + \\n, brez podatkovnih vrstic) + rows 0', async () => {
    const res = await exportGet(`type=payments&format=csv&startDate=${EMPTY_START}&endDate=${EMPTY_END}`)
    expect(res.status).toBe(200)

    const body = bytesText(await bodyBytes(res))
    expect(body).toBe(`${PAYMENTS_HEADER}\n`) // generator vedno zapiše header + '\n'
    expect(countCsvRows(body)).toBe(0)
  })

  it('15. headers: Cache-Control no-store + Content-Type text/csv + Content-Disposition SL imena (placila_ / dnevni_zakljucek_)', async () => {
    const resPay = await exportGet(exportQs('payments'))
    expect(resPay.status).toBe(200)
    expect(resPay.headers.get('cache-control')).toBe('no-store')
    expect(resPay.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(resPay.headers.get('content-disposition')).toBe(`attachment; filename="${encodeURIComponent(`placila_${START}_${END}.csv`)}"`)
    await bodyBytes(resPay) // telo porabi (single-read lekcija)

    const resDc = await exportGet(exportQs('daily-close'))
    expect(resDc.status).toBe(200)
    expect(resDc.headers.get('content-disposition')).toBe(`attachment; filename="${encodeURIComponent(`dnevni_zakljucek_${START}_${END}.csv`)}"`)
    await bodyBytes(resDc)
  })
})

// ============================================
// 5) AUDIT ACCOUNTING_EXPORTED (epic P2-04: export → authorization → audit)
// ============================================
describe('R146 #33: audit ACCOUNTING_EXPORTED', () => {
  it('16. po 200 klicu → točno 1 nov ACCOUNTING_EXPORTED: entityType ReportExport, entityId payments:csv, userId == session employeeId, locationId == scope, details EXACT (rows == countCsvRows IZVOŽEN), chain vezava na seeded rep; super-admin global → locationId null; PII v details NIČ', async () => {
    const auditBefore = await myExportAuditIds()

    const res = await exportGet(exportQs('payments'))
    expect(res.status).toBe(200)
    const body = bytesText(await bodyBytes(res))

    const after = await myExportAuditIds()
    expect(after).toHaveLength(auditBefore.length + 1)
    const newId = after.find((id) => !auditBefore.includes(id))
    expect(newId).toBeTruthy()
    const row = await db.auditLog.findUnique({ where: { id: newId ?? '' } })
    expect(row).not.toBeNull()
    if (!row) throw new Error('audit vrstica ni najdena')

    expect(row.action).toBe('ACCOUNTING_EXPORTED')
    expect(row.entityType).toBe('ReportExport')
    expect(row.entityId).toBe('payments:csv')
    expect(row.userId).toBe(EMP_ID) // session.employeeId (R146-b deviation 8)
    expect(row.locationId).toBe(IDS.locA) // scope lokacija (seja A)

    const details = JSON.parse(row.details) as Record<string, unknown>
    expect(details).toEqual({ type: 'payments', format: 'csv', startDate: START, endDate: END, rows: 3 })
    expect(details.rows).toBe(countCsvRows(body)) // izvožen quote-aware števec == zapisan rows
    // PII: details nosi samo številke/counters — ni kartic/code/vendorja
    expect(row.details).not.toContain(AUTH_CODE)
    expect(row.details).not.toContain(EXPENSE_VENDOR)
    expect(row.details).not.toContain('cardLast4')
    // hash chain: vezan na rep seeded Expense ledgerja (najnovejši timestamp med tekom)
    expect(row.previousHash).toBe(expenseTailHash)
    expect(row.chainHash).toMatch(/^[0-9a-f]{64}$/)

    // super-admin global → locationId null (metadata; null dovoljen po kontraktu)
    setSession('super_admin', null, ['admin', 'view_reports'])
    const auditBeforeGlobal = await myExportAuditIds()
    const resGlobal = await exportGet(exportQs('payments'))
    expect(resGlobal.status).toBe(200)
    await bodyBytes(resGlobal)
    const afterGlobal = await myExportAuditIds()
    expect(afterGlobal).toHaveLength(auditBeforeGlobal.length + 1)
    const globalId = afterGlobal.find((id) => !auditBeforeGlobal.includes(id))
    const globalRow = globalId ? await db.auditLog.findUnique({ where: { id: globalId } }) : null
    expect(globalRow?.locationId).toBeNull()
  })

  it('17. expenses cap 5000: kodni-inspekcijski pin — EXPENSES_EXPORT_CAP = 5000 + take: EXPENSES_EXPORT_CAP (integracijski dokaz bi zahteval 5001 seeded vrstic — OPOMBA v worklog)', async () => {
    const src = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'reports', 'export', '_helpers', 'accounting-reports.ts'), 'utf8')
    expect(src).toContain('const EXPENSES_EXPORT_CAP = 5000')
    expect(src).toContain('take: EXPENSES_EXPORT_CAP')
    // orderBy pred take: determinizem pod capom (timestamp asc + id asc)
    expect(src).toContain("orderBy: [{ timestamp: 'asc' }, { id: 'asc' }]")
  })
})
