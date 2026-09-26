// @vitest-environment node
// ============================================
// R140 / EPIC #115 P1-14 — INTEGRACIJA: CUSTOMER FEEDBACK LOOP
// ============================================
// Kontrakt P1-14 (R140-b strežnik: schema 0021 + PATCH resolution ruta +
// public POST persist fix + GET hardening) na pravi bazi (PGlite, izoliran
// PGLITE_DATA_DIR=/tmp/pglite-data-it):
//   (a) PUBLIC POST /api/feedback-public z mizo + naročilom: 201; DB
//       forenzika — tableId persistiran + tableNumber SNAPSHOT (miza na
//       ISTI lokaciji), orderRef = Order.orderNumber snapshot, status
//       'new', source kot poslan; audit GUEST_FEEDBACK_RECEIVED.
//   (b) ZERO-ORACLE na javni poti: neobstoječ orderId IN tuja miza →
//       VSEENO 201 z IDENTIČNIM telesom (ni enumeracije); orderRef null,
//       tableNumber null, tableId se vseeno shrani; tuja lokacija orderja
//       → orderRef prav tako null.
//   (c) PATCH /api/guests/feedback/[id] (staff PIN seja take_orders):
//       new→resolved happy path z odgovorom → 200; DB: status, resolvedById
//       (IZ SEJE — nikoli od klienta), resolvedByName (Employee snapshot),
//       resolvedAt, response+respondedAt+responded; audit 'feedback_resolved'
//       z before/after V ISTEM tx.
//   (d) Veriga new→in_review→resolved (dva klica) → obe 200, končno
//       resolved; vmesni in_review brez resolved forenzike; dve audit
//       vrstici (feedback_status_changed + feedback_resolved).
//   (e) CAS (R112 kanon): zaporedni drugi PATCH new→in_review na vrstici,
//       ki je že in_review → 409 'Neveljaven prehod statusa mnenja' (prijazen),
//       DB nespremenjena, odgovor NI prepisan; CONCURRENT dvojni PATCH
//       (Promise.all) → točno EN 200 + EN 409 (CAS lost-race), DB ostane
//       in_review z odgovorom ZMAGOVALCA, točno ENA audit vrstica.
//   (f) Fail-closed: brez auth → 401; tuj tenant (vrstica lokacije loc-2,
//       seja HQ) → 404 notInScope z ISTIM telesom kot neobstoječ id
//       (zero-oracle), zero pisnih učinkov.
//   (g) Zod/fail-closed pred body parse (R87-4): status 'nonsense' → 400,
//       response 1001 znakov → 400, whitespace-only response → 400,
//       razbit JSON → 400; NULL-lokacija staff seja + razbit JSON → 403
//       PRED parsanjem bodyja; vsi zero pisnih učinkov.
//   (h) GET /api/guests/feedback whitelist v praksi: 200 + Cache-Control
//       no-store; vrstice vsebujejo status/tableNumber/orderRef; scope
//       (tuja lokacija ni vidna); PII naročila (customerName/customerEmail)
//       ne uhaja po VREDNOSTI niti po KLJUČU (dvojni assertion r136/r137).
//
// Rate limit: javni POST teče na REALNEM limiterju (brez REDIS_URL →
// MemoryCacheAdapter, isti pristop kot r135/r136) z FEEDBACK_PUBLIC_LIMIT
// 5/min/IP. Ta datoteka porabi točno 3 POSTe (happy 1 + zero-oracle 2) —
// varno pod mejo; 429 pot je pokrita v unit r140-feedback-resolution
// (r136 kanon: limiterja namerno ne testiramo v integraciji).
//
// DB PRIPRAVA (fixture R92 MODEL A, R137-d lekcije — seed MORA teči z .env
// sourced zaradi pinLookup HMAC):
//     rm -rf /tmp/pglite-data-it
//     PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/init-pglite.mjs
//     PGLITE_DATA_DIR=/tmp/pglite-data-it NEXTAUTH_SECRET=<dev> \
//       node scripts/seed-e2e-pglite.mjs
//     PGLITE_DATA_DIR=/tmp/pglite-data-it node scripts/topup-kiosk-e2e.mjs
// Stanje mora vsebovati shemo 0021 (GuestFeedback.status/… — R140-b jo je
// apliciral prek scripts/apply-migration-pglite.mjs). Test je KLJUB temu
// self-sufficient: beforeAll idempotentno ensure lokaciji (po unikatni
// kodi 'HQ'/'FIL2') + test-admin + lastne RUN_ID mize/naročila/mnenja.
// Fixture vrstice (lokaciji, test-admin) afterAll ostanejo; briše SAMO
// svoje RUN_ID vrstice. AuditLog se NE briše (neprekinjena hash veriga).
//
// Zagon: bunx vitest run tests/integration/r140-feedback.test.ts \
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

// ISTI vzorec kot r137-delivery-driver: realen auth-middleware
// (importOriginal spread — resolveTenantLocationIdOrThrow ostane REALEN,
// tenant scope je testiran v praksi na pravi bazi), samo requireAuth
// nadomesti z ročno konstruirano PIN sejo.
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
import { POST as publicPOST } from '@/app/api/feedback-public/route'
import { PATCH as feedbackPATCH } from '@/app/api/guests/feedback/[id]/route'
import { GET as feedbackGET } from '@/app/api/guests/feedback/route'

const RUN_ID = `r140-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
// orderNumber je unikaten po (locationId, orderNumber) — 9-mestna baza iz
// časa zagona (r137 vzorec, varno nad Counter števcem).
const ORDER_BASE = Number(`${Date.now()}`.slice(-9))
// Mize: številka unikatna po (number, locationId) — velika vrednost iz
// časa zagona se izogne trkom s fixture mizami (table-1/table-2 = 1).
const TABLE_MAIN = 95000 + (Date.now() % 1000)

const IDS = {
  tableMain: `${RUN_ID}-t1`,
  tableForeign: `${RUN_ID}-tf`,
  oMain: `${RUN_ID}-o1`,
  oForeign: `${RUN_ID}-of`,
  fbResolved: `${RUN_ID}-fb1`,
  fbChain: `${RUN_ID}-fb2`,
  fbCas: `${RUN_ID}-fb3`,
  fbRace: `${RUN_ID}-fb4`,
  fbForeign: `${RUN_ID}-fbf`,
}

// PII vrednosti seedane na naročilu — NIKOLI se smejo pojaviti v staff GET
// odgovoru (whitelist vrednosti IN ključi — dvojni assertion r136/r137)
const PII_NAME = 'PII Gost R140'
const PII_EMAIL = 'pii-r140@test.si'

const RESPONSE_TEXT = 'Hvala za mnenje — veseli nas!'

// Fixture id-ji (e2e seed). Lokacije se resolva po UNIKATNI kodi
// ('HQ'/'FIL2'), ker je bil id 'loc-1' preimenovan v 'locKioskA'
// (topup-kiosk-e2e.mjs) — deluje v obeh stanjih.
const ADMIN = { id: 'test-admin', name: 'Test Admin', email: 'admin@e2e.test' }
const LOC: { main: string; foreign: string } = { main: '', foreign: '' }

async function asJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function publicPost(body: Record<string, unknown>): Promise<Response> {
  return publicPOST(new Request('http://x/api/feedback-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

function patchFeedback(id: string, body: unknown): Promise<Response> {
  return feedbackPATCH(
    new Request(`http://x/api/guests/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

function patchFeedbackRaw(id: string, rawBody: string): Promise<Response> {
  // Razbit JSON — dokaz R87-4 fail-closed pred body parse
  return feedbackPATCH(
    new Request(`http://x/api/guests/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: rawBody,
    }),
    { params: Promise.resolve({ id }) },
  )
}

function feedbackGet(): Promise<Response> {
  return feedbackGET(new Request('http://x/api/guests/feedback'))
}

// Idempotentna garantija fixture lokacije (po unikatni kodi — r137 vzorec;
// vrne DEJANSKI id vrstice).
async function ensureLocation(code: string, preferredId: string, name: string): Promise<string> {
  const byCode = await db.location.findUnique({ where: { code } })
  if (byCode) return byCode.id
  await db.location.create({
    data: { id: preferredId, code, name, premisesId: `${RUN_ID}-prem-${code}`, isActive: true },
  }).catch(() => {})
  const created = await db.location.findUnique({ where: { code } })
  if (!created) throw new Error(`R140 seed: lokacija ${code} ni na voljo`)
  return created.id
}

// Idempotentna garantija fixture zaposlenega test-admin (r137 vzorec).
async function ensureTestAdmin(): Promise<void> {
  await db.employee.upsert({
    where: { email: ADMIN.email },
    update: {},
    create: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: 'admin', status: 'active' },
  })
}

// Lastna RUN_ID miza (self-sufficient — ne sme trčit s fixture mizo na isti
// lokaciji; unikat je po (number, locationId)).
async function ensureTable(id: string, locationId: string, number: number): Promise<string> {
  const created = await db.table.create({ data: { id, number, locationId } }).catch(() => null)
  if (created) return created.id
  const existing = await db.table.findFirst({ where: { id } })
  if (existing && existing.locationId === locationId) return existing.id
  throw new Error(`R140 seed: miza ${id} ni na voljo`)
}

// Direktno ustvarjeno mnenje (staff PATCH testi — determinističen seed,
// ne porabi rate-limit budgeta javne poti).
async function seedFeedback(id: string, locationId: string, extra: Record<string, unknown> = {}): Promise<void> {
  await db.guestFeedback.create({
    data: {
      id,
      locationId,
      guestName: `Anonimen gost ${RUN_ID}`,
      overallRating: 3,
      foodRating: 3,
      serviceRating: 3,
      atmosphereRating: 3,
      comment: `R140 mnenje ${RUN_ID} ${id}`,
      tags: '[]',
      source: 'qr_kiosk',
      status: 'new',
      ...extra,
    },
  })
}

beforeAll(async () => {
  // 1) Fixture lokaciji (tenant scope potrebuje obe) + test-admin
  LOC.main = await ensureLocation('HQ', 'locKioskA', 'Test Restavracija')
  LOC.foreign = await ensureLocation('FIL2', 'loc-2', 'Test Filiala')
  await ensureTestAdmin()

  // 2) Mize: glavna na HQ (snapshot vrednost = TABLE_MAIN), tuja na FIL2
  await ensureTable(IDS.tableMain, LOC.main, TABLE_MAIN)
  await ensureTable(IDS.tableForeign, LOC.foreign, TABLE_MAIN + 1)

  // 3) Naročili: obstoječ na glavni lokaciji (public POST orderRef vir, s
  //    PII markerji za GET whitelist dokaz) + tuja na loc-2 (zero-oracle)
  await db.order.create({
    data: {
      id: IDS.oMain,
      orderNumber: ORDER_BASE,
      type: 'dine-in',
      status: 'completed',
      paymentStatus: 'paid',
      locationId: LOC.main,
      tableId: IDS.tableMain,
      total: 24.5,
      customerName: PII_NAME,
      customerEmail: PII_EMAIL,
    },
  })
  await db.order.create({
    data: {
      id: IDS.oForeign,
      orderNumber: ORDER_BASE + 1,
      type: 'dine-in',
      status: 'completed',
      paymentStatus: 'paid',
      locationId: LOC.foreign,
      total: 11,
    },
  })

  // 4) Mnenja za staff PATCH poti (vsi 'new'; foreign na loc-2)
  await seedFeedback(IDS.fbResolved, LOC.main, {
    tableId: IDS.tableMain,
    tableNumber: String(TABLE_MAIN),
    orderRef: String(ORDER_BASE),
    orderId: IDS.oMain,
  })
  await seedFeedback(IDS.fbChain, LOC.main)
  await seedFeedback(IDS.fbCas, LOC.main)
  await seedFeedback(IDS.fbRace, LOC.main)
  await seedFeedback(IDS.fbForeign, LOC.foreign)
})

beforeEach(() => {
  // Privzeta seja: test-admin na glavni lokaciji (posamezni testi jo
  // lahko zamenjajo/odstranijo)
  authRef.current = { employeeId: ADMIN.id, role: 'admin', locationId: LOC.main, permissions: ['take_orders'] }
})

afterAll(async () => {
  // Čiščenje po FK redu — SAMO svoje RUN_ID vrstice. Mnenja: znani id-ji +
  // javno-POST ustvarjene vrstice (marker RUN_ID v komentarju). Fixture
  // vrstice (test-admin, lokaciji) ostanejo; AuditLog se NE briše
  // (neprekinjena hash veriga — r127 restore round-trip jo bere).
  await db.guestFeedback.deleteMany({
    where: {
      OR: [
        { id: { in: Object.values(IDS) } },
        { comment: { contains: RUN_ID } },
      ],
    },
  }).catch(() => {})
  await db.order.deleteMany({ where: { id: { in: [IDS.oMain, IDS.oForeign] } } }).catch(() => {})
  await db.table.deleteMany({ where: { id: { in: [IDS.tableMain, IDS.tableForeign] } } }).catch(() => {})
  await db.$disconnect().catch(() => {})
})

describe('R140 P1-14: feedback loop (prava PGlite)', () => {
  it('Public POST z mizo + naročilom: 201 — tableId + tableNumber snapshot + orderRef + status new + source, audit GUEST_FEEDBACK_RECEIVED', async () => {
    const res = await publicPost({
      ratings: { food: 5, service: 4, ambience: 4 },
      comment: `R140 mnenje ${RUN_ID} public-happy`,
      quickFeedback: ['Hitra postrežba'],
      tableId: IDS.tableMain,
      orderId: IDS.oMain,
      locationId: LOC.main,
      source: 'qr_kiosk',
    })
    expect(res.status).toBe(201)
    expect(await asJson(res)).toEqual({ success: true, message: 'Hvala za vaše mnenje!' })

    // DB forenzika: najnovejše mnenje na tej mizi
    const fb = await db.guestFeedback.findFirst({
      where: { tableId: IDS.tableMain },
      orderBy: { createdAt: 'desc' },
    })
    expect(fb).not.toBeNull()
    expect(fb!.locationId).toBe(LOC.main)
    // snapshot mize + naročila (Order.orderNumber kot String, NIKOLI FK/id)
    expect(fb!.tableId).toBe(IDS.tableMain)
    expect(fb!.tableNumber).toBe(String(TABLE_MAIN))
    expect(fb!.orderRef).toBe(String(ORDER_BASE))
    // resolution workflow: sveže mnenje je 'new'
    expect(fb!.status).toBe('new')
    expect(fb!.source).toBe('qr_kiosk')
    // zero-oracle: sam orderId (cuid) se NE persistira
    expect(fb!.orderId).toBeNull()
    // ocene strežniško: avg((5+4+4)/3)=4.33 → overall 4, kategorije 1:1
    expect(fb!.overallRating).toBe(4)
    expect(fb!.foodRating).toBe(5)
    expect(fb!.serviceRating).toBe(4)
    expect(fb!.atmosphereRating).toBe(4)
    expect(fb!.guestName).toBe('Anonimen')
    expect(JSON.parse(fb!.tags)).toEqual(['Hitra postrežba'])

    // Audit zapis obstaja (details vsebuje tableId)
    const audit = await db.auditLog.findFirst({
      where: { action: 'GUEST_FEEDBACK_RECEIVED', details: { contains: IDS.tableMain } },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
  })

  it('Zero-oracle na javnem POSTu: neobstoječ orderId + tuja miza IN tuja-lokacija order → VSEENO 201 z istim telesom, orderRef/tableNumber null, tableId se shrani', async () => {
    const body = {
      ratings: { food: 2 },
      comment: `R140 mnenje ${RUN_ID} public-oracle`,
      tableId: IDS.tableForeign, // miza TUJE lokacije (loc-2)
      orderId: `${RUN_ID}-order-gone`, // neobstoječ, a veljaven format
      locationId: LOC.main,
      source: 'qr_kiosk',
    }
    const resA = await publicPost(body)
    expect(resA.status).toBe(201)
    const jsonA = await asJson(resA)
    // IDENTIČNO telo kot happy path — javni odgovor ne razkriva obstoja
    expect(jsonA).toEqual({ success: true, message: 'Hvala za vaše mnenje!' })

    const fbA = await db.guestFeedback.findFirst({
      where: { comment: { contains: 'public-oracle' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(fbA).not.toBeNull()
    // miza se vseeno shrani (loose ref), a BREZ snapshot-a (tuja lokacija)
    expect(fbA!.tableId).toBe(IDS.tableForeign)
    expect(fbA!.tableNumber).toBeNull()
    // neobstoječ order → orderRef null
    expect(fbA!.orderRef).toBeNull()
    expect(fbA!.locationId).toBe(LOC.main)

    // varianta 2: order OBSTOJA, a na tuji lokaciji → prav tako orderRef null
    const resB = await publicPost({ ...body, tableId: undefined, orderId: IDS.oForeign, comment: `R140 mnenje ${RUN_ID} public-oracle2` })
    expect(resB.status).toBe(201)
    expect(await asJson(resB)).toEqual(jsonA) // isti odgovor za veljaven tuj order
    const fbB = await db.guestFeedback.findFirst({
      where: { comment: { contains: 'public-oracle2' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(fbB).not.toBeNull()
    expect(fbB!.orderRef).toBeNull()
    expect(fbB!.tableId).toBeNull()
  })

  it('PATCH happy path new→resolved z odgovorom: 200 — resolvedById iz seje + resolvedByName snapshot + resolvedAt + response/respondedAt/responded; audit feedback_resolved z before/after', async () => {
    const res = await patchFeedback(IDS.fbResolved, { status: 'resolved', response: RESPONSE_TEXT })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await asJson(res) as { success: boolean; feedback: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.feedback.status).toBe('resolved')
    // whitelist v odgovoru: snapshot ime JE, notranji worker ref NI
    expect(body.feedback.resolvedByName).toBe(ADMIN.name)
    expect('resolvedById' in body.feedback).toBe(false)

    // DB forenzika — celoten resolution zapis
    const fb = await db.guestFeedback.findUnique({ where: { id: IDS.fbResolved } })
    expect(fb!.status).toBe('resolved')
    expect(fb!.resolvedById).toBe(ADMIN.id) // identiteta IZ SEJE
    expect(fb!.resolvedByName).toBe(ADMIN.name) // Employee snapshot
    expect(fb!.resolvedAt).not.toBeNull()
    expect(fb!.response).toBe(RESPONSE_TEXT)
    expect(fb!.respondedAt).not.toBeNull()
    expect(fb!.responded).toBe(true)
    // kontekst se ni spremenil
    expect(fb!.tableNumber).toBe(String(TABLE_MAIN))
    expect(fb!.orderRef).toBe(String(ORDER_BASE))

    // Audit V ISTEM tx: feedback_resolved z before/after + odgovor + lokacija
    const audit = await db.auditLog.findFirst({
      where: { action: 'feedback_resolved', entityId: IDS.fbResolved },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
    expect(audit!.userId).toBe(ADMIN.id)
    const details = JSON.parse(audit!.details) as { before?: string; after?: string; response?: string | null; locationId?: string | null }
    expect(details.before).toBe('new')
    expect(details.after).toBe('resolved')
    expect(details.response).toBe(RESPONSE_TEXT)
    expect(details.locationId).toBe(LOC.main)
  })

  it('PATCH veriga new→in_review→resolved (dva klica): obe 200, končno resolved; vmesni in_review brez resolved forenzike; dve audit vrstici', async () => {
    // 1) new → in_review (brez odgovora — opcijsko polje)
    const r1 = await patchFeedback(IDS.fbChain, { status: 'in_review' })
    expect(r1.status).toBe(200)
    const mid = await db.guestFeedback.findUnique({ where: { id: IDS.fbChain } })
    expect(mid!.status).toBe('in_review')
    // še ni rešeno: nobeno resolved polje, noben odgovor
    expect(mid!.resolvedById).toBeNull()
    expect(mid!.resolvedByName).toBeNull()
    expect(mid!.resolvedAt).toBeNull()
    expect(mid!.responded).toBe(false)
    expect(mid!.response).toBe('')

    // 2) in_review → resolved (z odgovorom)
    const r2 = await patchFeedback(IDS.fbChain, { status: 'resolved', response: RESPONSE_TEXT })
    expect(r2.status).toBe(200)
    const fin = await db.guestFeedback.findUnique({ where: { id: IDS.fbChain } })
    expect(fin!.status).toBe('resolved')
    expect(fin!.resolvedById).toBe(ADMIN.id)
    expect(fin!.resolvedByName).toBe(ADMIN.name)
    expect(fin!.resolvedAt).not.toBeNull()
    expect(fin!.response).toBe(RESPONSE_TEXT)
    expect(fin!.responded).toBe(true)

    // Dve audit vrstici v pravilnem vrstnem redu z before/after
    const audits = await db.auditLog.findMany({
      where: { entityId: IDS.fbChain, action: { in: ['feedback_status_changed', 'feedback_resolved'] } },
      orderBy: { timestamp: 'asc' },
    })
    expect(audits).toHaveLength(2)
    const d1 = JSON.parse(audits[0].details) as { before: string; after: string }
    expect(audits[0].action).toBe('feedback_status_changed')
    expect(d1.before).toBe('new')
    expect(d1.after).toBe('in_review')
    const d2 = JSON.parse(audits[1].details) as { before: string; after: string }
    expect(audits[1].action).toBe('feedback_resolved')
    expect(d2.before).toBe('in_review')
    expect(d2.after).toBe('resolved')
  })

  it('CAS: drugi (zaporedni) PATCH new→in_review na že in_review vrstici → 409 prijazen prehod, DB ostane in_review, odgovor NI prepisan', async () => {
    // 1) prvi prehod z odgovorom
    const r1 = await patchFeedback(IDS.fbCas, { status: 'in_review', response: 'Prvi odgovor' })
    expect(r1.status).toBe(200)

    // 2) isti prehod še enkrat (klicatelj pričakuje 'new') → 409
    const r2 = await patchFeedback(IDS.fbCas, { status: 'in_review', response: 'Drugi poskus' })
    expect(r2.status).toBe(409)
    const b2 = await asJson(r2)
    expect(String(b2.error)).toContain('Neveljaven prehod statusa mnenja')
    expect(String(b2.error)).toContain('in_review')

    // DB: status ostane in_review, odgovor prvega pisatelja se ni dupliral/
    // prepisal, točno ENA audit vrstica (drugi klic ni pisal)
    const fb = await db.guestFeedback.findUnique({ where: { id: IDS.fbCas } })
    expect(fb!.status).toBe('in_review')
    expect(fb!.response).toBe('Prvi odgovor')
    const audits = await db.auditLog.findMany({
      where: { entityId: IDS.fbCas, action: { in: ['feedback_status_changed', 'feedback_resolved'] } },
    })
    expect(audits).toHaveLength(1)
  })

  it('CAS vzporedna tekma: dva hkratna PATCHa new→in_review → točno EN 200 + EN 409, DB in_review z odgovorom zmagovalca, ENA audit vrstica', async () => {
    const [ra, rb] = await Promise.all([
      patchFeedback(IDS.fbRace, { status: 'in_review', response: 'Tekma A' }),
      patchFeedback(IDS.fbRace, { status: 'in_review', response: 'Tekma B' }),
    ])
    // CAS kanon: točno ena poteza dobi 200, druga 409 (stale 'v medčasu'
    // ALI prijazen prehod — glede na razporeditev branj/pisanj)
    const statuses = [ra.status, rb.status].sort()
    expect(statuses).toEqual([200, 409])
    const loser = ra.status === 409 ? ra : rb
    const loserBody = await asJson(loser)
    expect(loserBody).toHaveProperty('error')

    // Zmagovalec: njegov odgovor je edini v DB
    const winnerResponse = ra.status === 200 ? 'Tekma A' : 'Tekma B'
    const fb = await db.guestFeedback.findUnique({ where: { id: IDS.fbRace } })
    expect(fb!.status).toBe('in_review')
    expect(fb!.response).toBe(winnerResponse)
    expect(fb!.responded).toBe(true)
    expect(fb!.resolvedAt).toBeNull() // in_review NE piše resolved forenzike

    // Točno ENA pisna poteza → ENA audit vrstica (izgubljeni CAS ni pisal)
    const audits = await db.auditLog.findMany({
      where: { entityId: IDS.fbRace, action: { in: ['feedback_status_changed', 'feedback_resolved'] } },
    })
    expect(audits).toHaveLength(1)
  })

  it('Fail-closed: brez auth → 401; tuj tenant → 404 z ISTIM telesom kot neobstoječ id (zero-oracle), zero pisnih učinkov', async () => {
    // (a) Brez auth — 401 pred katerimkoli DB učinkom
    authRef.current = null
    const r401 = await patchFeedback(IDS.fbForeign, { status: 'resolved' })
    expect(r401.status).toBe(401)
    expect(await asJson(r401)).toHaveProperty('error')

    // (b) Tuj tenant: mnenje lokacije loc-2, seja na HQ → 404 notInScope
    authRef.current = { employeeId: ADMIN.id, role: 'admin', locationId: LOC.main, permissions: ['take_orders'] }
    const rForeign = await patchFeedback(IDS.fbForeign, { status: 'resolved' })
    expect(rForeign.status).toBe(404)
    const foreignBody = await asJson(rForeign)
    expect(String(foreignBody.error)).toContain('Povratna informacija ni najden')

    // (c) Neobstoječ id → ISTI 404 (zero-oracle primerjava teles!)
    const rMissing = await patchFeedback(`${RUN_ID}-fb-gone`, { status: 'resolved' })
    expect(rMissing.status).toBe(404)
    expect(await asJson(rMissing)).toEqual(foreignBody)

    // Zero pisnih učinkov: tuja vrstica je še vedno netaknjena 'new'
    const fb = await db.guestFeedback.findUnique({ where: { id: IDS.fbForeign } })
    expect(fb!.status).toBe('new')
    expect(fb!.resolvedAt).toBeNull()
    expect(fb!.response).toBe('')
    const audits = await db.auditLog.findMany({
      where: { entityId: IDS.fbForeign, action: { in: ['feedback_status_changed', 'feedback_resolved'] } },
    })
    expect(audits).toHaveLength(0)
  })

  it('Zod/fail-closed: status nonsense → 400; response 1001 znakov → 400; whitespace response → 400; razbit JSON → 400; NULL-lokacija seja + razbit JSON → 403 PRED body parse (R87-4); zero pisnih učinkov', async () => {
    const before = await db.guestFeedback.findUnique({ where: { id: IDS.fbCas } })
    const auditsBefore = await db.auditLog.count({ where: { entityId: IDS.fbCas } })

    // (a) neveljaven status (zunaj enum)
    const rStatus = await patchFeedback(IDS.fbCas, { status: 'nonsense' })
    expect(rStatus.status).toBe(400)
    const bStatus = await asJson(rStatus)
    expect(bStatus.error).toBe('Neveljavni podatki')
    expect(Array.isArray(bStatus.validationErrors)).toBe(true)

    // (b) predolg odgovor (1001 znakov — sanitize ne skrajša dolžine)
    const rLong = await patchFeedback(IDS.fbCas, { status: 'in_review', response: 'a'.repeat(1001) })
    expect(rLong.status).toBe(400)

    // (c) whitespace-only odgovor (Zod trim + min 1)
    const rBlank = await patchFeedback(IDS.fbCas, { status: 'in_review', response: '   ' })
    expect(rBlank.status).toBe(400)

    // (d) razbit JSON z veljavno sejo → 400 'Neveljaven JSON format'
    const rBroken = await patchFeedbackRaw(IDS.fbCas, '{ni-json')
    expect(rBroken.status).toBe(400)
    expect(String((await asJson(rBroken)).error)).toContain('JSON')

    // (e) R87-4 kanon: staff NULL-lokacija seja → 403 PRED body parse
    //     (razbit body NE spremeni odgovora — dokaz fail-closed vrstnega reda)
    authRef.current = { employeeId: ADMIN.id, role: 'staff', locationId: null, permissions: ['take_orders'] }
    const r403 = await patchFeedbackRaw(IDS.fbCas, '{ni-json')
    expect(r403.status).toBe(403)
    expect(String((await asJson(r403)).error)).toContain('nima dodeljene lokacije')
    const r403valid = await patchFeedback(IDS.fbCas, { status: 'resolved' })
    expect(r403valid.status).toBe(403)

    // Zero pisnih učinkov na vseh petih zavrnitvah
    const after = await db.guestFeedback.findUnique({ where: { id: IDS.fbCas } })
    expect(after!.status).toBe(before!.status)
    expect(after!.response).toBe(before!.response)
    const auditsAfter = await db.auditLog.count({ where: { entityId: IDS.fbCas } })
    expect(auditsAfter).toBe(auditsBefore)
  })

  it('GET whitelist v praksi: 200 + no-store; status/tableNumber/orderRef prisotni; tuja lokacija ni v obsegu; PII ne uhaja po vrednosti IN ključu', async () => {
    const res = await feedbackGet()
    expect(res.status).toBe(200)
    // R124b kanon: staff PII odgovor se ne predpomni
    expect(res.headers.get('cache-control')).toBe('no-store')

    const body = await asJson(res) as {
      feedbacks: Array<Record<string, unknown>>
      stats: { total: number }
      total: number
    }
    expect(Array.isArray(body.feedbacks)).toBe(true)
    expect(body).toHaveProperty('stats')
    expect(body.stats.total).toBeGreaterThanOrEqual(1)

    // nova P1-14 polja v praksi: status + snapshot kontekst
    const mine = body.feedbacks.find(f => f.id === IDS.fbResolved) as Record<string, unknown> | undefined
    expect(mine).toBeDefined()
    expect(mine!.status).toBe('resolved')
    expect(mine!.tableNumber).toBe(String(TABLE_MAIN))
    expect(mine!.orderRef).toBe(String(ORDER_BASE))
    expect(mine!.resolvedByName).toBe(ADMIN.name)
    // whitelist v praksi: notranji worker ref ne uhaja niti v svoji vrstici
    expect('resolvedById' in mine!).toBe(false)

    // scope: mnenje tuje lokacije (loc-2) NI v odgovoru HQ seje
    expect(body.feedbacks.some(f => f.id === IDS.fbForeign)).toBe(false)

    // PII dvojni assertion (r136/r137 kanon): vrednosti IN ključi
    const raw = JSON.stringify(body)
    expect(raw).not.toContain(PII_NAME)
    expect(raw).not.toContain(PII_EMAIL)
    expect(raw).not.toContain('customerName')
    expect(raw).not.toContain('customerEmail')
    expect(raw).not.toContain('customerPhone')
    expect(raw).not.toContain('guestEmail')
    expect(raw).not.toContain('guestPhone')
  })
})
