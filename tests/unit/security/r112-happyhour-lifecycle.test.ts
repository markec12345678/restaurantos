// ============================================
// R112-C — HAPPY-HOUR LIFECYCLE HARDENING
//        (overlap lock + CAS toggle + % bound)
//        — CONCURRENCY & ERROR KONTRAKT (TOCTOU razred R100–R111)
// ============================================
//
// Forenzika (glej happy-hour/route.ts, happy-hour/[id]/route.ts,
// lib/validations/menu.ts R112 headerje):
//
//   HH-1 (MED, POST /api/happy-hour): NI overlap validacije — neomejeno
//     AKTIVNIH urnikov z istim cenikom in prekrivajočimi okni (nedeterminen
//     popust); create tudi BREZ tx (check-then-act okno na priceGroup
//     preverb-i). Fix: ENA Serializable tx — tx-fresh scoped priceGroup
//     re-read + advisory lock 'happy-hour:{locationId}' (izpeljan iz LOKACIJE
//     cenika) + presek intervalov med AKTIVNIMI obstoječimi urniki ISTEGA
//     cenika (obvezno vsaj en skupen dan; podprta tudi čeznočna legacy
//     okna). Prekrivanje → strukturirani 409 (R103 kanon); P2034/P2002 → 409.
//   HH-2 (LOW, PATCH /api/happy-hour/[id]): stale read + NEPOGOJEN update →
//     tekma z DELETE = P2025 → 500. Fix: CAS toggle updateMany
//     { id, isActive: !newValue }; count 0 → re-check: izbrisana → 404
//     'Happy ura ne obstaja', še vedno tam → idempotenten 200. Response
//     oblika identična (urnik + priceGroup).
//   HH-3 (LOW, DELETE /api/happy-hour/[id]): delete po findUnique-u v tekmi
//     vrže P2025 → 500. Fix: canonical catch mapping P2025 → 404, P2034 → 409.
//   HH-4 (LOW, lib/validations/menu.ts): percentage popust brez zgornje meje
//     (999 % mogoč). Fix: objekt-level .refine — 'percentage' zahteva
//     0 < discountAmount <= 100 ('Popust v procentih mora biti med 0 in 100.').
//
// Pokritje: A HH-1 POST overlap kanon · B HH-2 PATCH CAS toggle ·
// C HH-3 DELETE error kontrakt · D HH-4 % refine · E fs-pini (vir pini).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const PG = 'pg-1'
const HH_ID = 'hh-1'

// --- Mocki (vi.hoisted) ---
const mocks = vi.hoisted(() => ({
  // A — HH-1 POST
  requireAuth: vi.fn(),
  transaction: vi.fn(),
  dbPriceGroupFindFirst: vi.fn(), // hitri izhod IZVEN tx (fast-fail)
  txExecuteRaw: vi.fn(), // advisory lock (tagged template)
  txPriceGroupFindFirst: vi.fn(), // tx-fresh re-read scope-a
  txHHFindMany: vi.fn(), // aktivni obstoječi urniki istega cenika
  txHHCreate: vi.fn(), // create pod istim snapshot-om
  // B/C — HH-2 PATCH + HH-3 DELETE
  hhFindUnique: vi.fn(),
  hhUpdateMany: vi.fn(),
  hhDelete: vi.fn(),
}))

// Privzeti tx klient (A — POST overlap kanon)
const txClient = {
  $executeRaw: mocks.txExecuteRaw,
  priceGroup: { findFirst: mocks.txPriceGroupFindFirst },
  happyHourSchedule: {
    findMany: mocks.txHHFindMany,
    create: mocks.txHHCreate,
  },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.transaction,
    priceGroup: { findFirst: mocks.dbPriceGroupFindFirst },
    happyHourSchedule: {
      findUnique: mocks.hhFindUnique,
      findMany: vi.fn(), // GET — ni testiran tukaj
      create: vi.fn(), // od R112 create teče ZNOTRAJ tx (HH-1)
      updateMany: mocks.hhUpdateMany,
      delete: mocks.hhDelete,
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

// Utišaj logger
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { POST as hhPOST } from '@/app/api/happy-hour/route'
import { PATCH as hhPATCH, DELETE as hhDELETE } from '@/app/api/happy-hour/[id]/route'
import { createHappyHourSchema } from '@/lib/validations'

const PRICE_GROUP = { id: PG, name: 'Glavni cenik', locationId: LOC_A }

// Veljaven POST payload (utripa z createHappyHourSchema defaults)
const VALID_BODY = {
  name: 'Happy ura popoldne',
  priceGroupId: PG,
  discountType: 'percentage',
  discountAmount: 20,
  daysOfWeek: [1, 2, 3],
  startTime: '16:00',
  endTime: '18:00',
}

// PATCH/DELETE pre-check zapis (isActive:false → toggle na true)
const HH_RECORD = {
  id: HH_ID,
  name: 'Happy ura popoldne',
  isActive: false,
  priceGroup: { id: PG, locationId: LOC_A },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
  // A defaults
  mocks.requireAuth.mockResolvedValue({
    session: { employeeId: 'emp-1', role: 'admin', locationId: LOC_A },
    error: null,
  })
  mocks.dbPriceGroupFindFirst.mockResolvedValue({ ...PRICE_GROUP })
  mocks.txPriceGroupFindFirst.mockResolvedValue({ id: PG, locationId: LOC_A })
  mocks.txHHFindMany.mockResolvedValue([]) // brez prekrivanj
  mocks.txHHCreate.mockResolvedValue({
    id: 'hh-new',
    ...VALID_BODY,
    daysOfWeek: JSON.stringify(VALID_BODY.daysOfWeek),
    priceGroup: { ...PRICE_GROUP },
  })
  // B/C defaults
  mocks.hhFindUnique.mockResolvedValue({ ...HH_RECORD })
  mocks.hhUpdateMany.mockResolvedValue({ count: 1 })
  mocks.hhDelete.mockResolvedValue({})
})

function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function jsonPatch(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) })

// ══════════════════════════════════════════════════════════════════
// A. HH-1 — POST overlap kanon (Serializable tx + advisory lock)
// ══════════════════════════════════════════════════════════════════
describe('R112 A: POST /api/happy-hour — overlap lock + Serializable tx (HH-1)', () => {
  it('srečna pot: 201 + Serializable izolacija + tx-fresh scoped priceGroup re-read + create pod istim snapshot-om', async () => {
    const res = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('hh-new')
    // Serializable tx options
    expect(mocks.transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
    // tx-fresh re-read nosi lokacijski scope (R81-F preverba pod istim snapshot-om)
    expect(mocks.txPriceGroupFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.txPriceGroupFindFirst.mock.calls[0][0].where).toMatchObject({
      id: PG,
      locationId: LOC_A,
    })
    // create ZNOTRAJ tx (prej: db.create izven tx)
    expect(mocks.txHHCreate).toHaveBeenCalledTimes(1)
    expect(mocks.txHHCreate.mock.calls[0][0].data.priceGroupId).toBe(PG)
    expect(mocks.txHHCreate.mock.calls[0][0].data.startTime).toBe('16:00')
    expect(mocks.txHHCreate.mock.calls[0][0].data.endTime).toBe('18:00')
  })

  it('advisory lock: pg_advisory_xact_lock z ključem happy-hour:{lokacija CENIKA} (ne seje)', async () => {
    // super-admin brez seje lokacije — ključ se mora izpeljati iz cenika
    mocks.requireAuth.mockResolvedValue({
      session: { employeeId: 'emp-1', role: 'super_admin', locationId: null },
      error: null,
    })
    mocks.txPriceGroupFindFirst.mockResolvedValue({ id: PG, locationId: 'loc-tenant-b' })
    await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(mocks.txExecuteRaw).toHaveBeenCalledTimes(1)
    // tagged template: (stringsArray, ...values) — 2. element = lock param
    const [sql, lockParam] = mocks.txExecuteRaw.mock.calls[0]
    expect(String(sql[0])).toContain('pg_advisory_xact_lock')
    expect(String(sql[0])).toContain('hashtext')
    expect(lockParam).toBe('happy-hour:loc-tenant-b')
  })

  it('PREKRIVANJE (aktiven obstoječi, isti cenik, skupen dan) → 409 structured + NI create-a', async () => {
    mocks.txHHFindMany.mockResolvedValue([
      { id: 'hh-existing', startTime: '17:00', endTime: '19:00', daysOfWeek: '[1,2,3]' },
    ])
    const res = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Happy ura se prekriva z obstoječim urnikom (isti cenik).',
    })
    expect(mocks.txHHCreate).not.toHaveBeenCalled()
  })

  it('brez prekrivanja: sosednji okni (16-18 ∥ 18-20, polodprt presek) IN različna dneva → 201', async () => {
    // sosednji intervali (end == start) se NE sekata — polodprti intervali
    mocks.txHHFindMany.mockResolvedValue([
      { id: 'hh-1', startTime: '18:00', endTime: '20:00', daysOfWeek: '[1,2,3]' },
    ])
    const res1 = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res1.status).toBe(201)
    // isti čas, ampak ni skupnega dneva → prav tako 201
    mocks.txHHFindMany.mockResolvedValue([
      { id: 'hh-2', startTime: '16:00', endTime: '18:00', daysOfWeek: '[4,5]' },
    ])
    const res2 = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res2.status).toBe(201)
    expect(mocks.txHHCreate).toHaveBeenCalledTimes(2)
  })

  it('prekrivanje gleda SAMO AKTIVNE obstoječe urnike ISTEGA cenika (where pin)', async () => {
    await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(mocks.txHHFindMany).toHaveBeenCalledTimes(1)
    const query = mocks.txHHFindMany.mock.calls[0][0]
    expect(query.where).toEqual({ priceGroupId: PG, isActive: true })
    expect(query.select).toMatchObject({ id: true, startTime: true, endTime: true, daysOfWeek: true })
  })

  it('čeznočno legacy okno (23:00-02:00) se pravilno seka z jutranjim oknom → 409', async () => {
    mocks.txHHFindMany.mockResolvedValue([
      { id: 'hh-night', startTime: '23:00', endTime: '02:00', daysOfWeek: '[1]' },
    ])
    const res = await hhPOST(
      jsonPost('http://localhost/api/happy-hour', { ...VALID_BODY, startTime: '01:00', endTime: '03:00', daysOfWeek: [1] }),
    )
    expect(res.status).toBe(409)
    expect(mocks.txHHCreate).not.toHaveBeenCalled()
  })

  it('tx-fresh: cenik izbrisan/izven scope-a med requestoma → 404 Cenik ni najden (strukturirani throw)', async () => {
    // hitri izhod izven tx prestane (fast-fail), tx-fresh re-read pa ga ujame
    mocks.txPriceGroupFindFirst.mockResolvedValue(null)
    const res = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: 'Cenik ni najden' })
    expect(mocks.txHHCreate).not.toHaveBeenCalled()
  })

  it('P2034 Serializable konflikt → 409 (prej 500)', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const res = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('P2002 → 409 (pariteta z R107/R109/R111 kontraktom)', async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    )
    const res = await hhPOST(jsonPost('http://localhost/api/happy-hour', VALID_BODY))
    expect(res.status).toBe(409)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. HH-2 — PATCH toggle CAS kanon
// ══════════════════════════════════════════════════════════════════
describe('R112 B: PATCH /api/happy-hour/[id] — CAS toggle (HH-2)', () => {
  it('CAS: updateMany { id, isActive: !newValue } → count 1 → 200 z urnikom + priceGroup (oblika identična)', async () => {
    mocks.hhFindUnique
      .mockResolvedValueOnce({ ...HH_RECORD }) // pre-check (scope)
      .mockResolvedValueOnce({ ...HH_RECORD, isActive: true }) // re-read po CAS-u
    const res = await hhPATCH(jsonPatch(`http://localhost/api/happy-hour/${HH_ID}`, { isActive: true }), routeParams(HH_ID))
    expect(res.status).toBe(200)
    expect(mocks.hhUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.hhUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: HH_ID, isActive: false },
      data: { isActive: true },
    })
    const body = await res.json()
    expect(body.id).toBe(HH_ID)
    expect(body.isActive).toBe(true)
    expect(body.priceGroup).toMatchObject({ locationId: LOC_A })
  })

  it('count 0 + še vedno tam (že v želenem stanju — dvoklik) → idempotenten 200', async () => {
    mocks.hhUpdateMany.mockResolvedValue({ count: 0 })
    mocks.hhFindUnique
      .mockResolvedValueOnce({ ...HH_RECORD })
      .mockResolvedValueOnce({ ...HH_RECORD, isActive: true })
    const res = await hhPATCH(jsonPatch(`http://localhost/api/happy-hour/${HH_ID}`, { isActive: true }), routeParams(HH_ID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isActive).toBe(true)
    expect(body.priceGroup).toBeDefined()
  })

  it('count 0 + izbrisana (tekma z DELETE med read in write) → 404 Happy ura ne obstaja', async () => {
    mocks.hhUpdateMany.mockResolvedValue({ count: 0 })
    mocks.hhFindUnique
      .mockResolvedValueOnce({ ...HH_RECORD }) // pre-check še obstaja
      .mockResolvedValueOnce(null) // re-check: izbrisana
    const res = await hhPATCH(jsonPatch(`http://localhost/api/happy-hour/${HH_ID}`, { isActive: true }), routeParams(HH_ID))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: 'Happy ura ne obstaja' })
  })
})

// ══════════════════════════════════════════════════════════════════
// C. HH-3 — DELETE error kontrakt
// ══════════════════════════════════════════════════════════════════
describe('R112 C: DELETE /api/happy-hour/[id] — P2025/P2034 mapping (HH-3)', () => {
  it('srečna pot → { ok: true, id }', async () => {
    const res = await hhDELETE(
      new Request(`http://localhost/api/happy-hour/${HH_ID}`, { method: 'DELETE' }),
      routeParams(HH_ID),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, id: HH_ID })
    expect(mocks.hhDelete).toHaveBeenCalledWith({ where: { id: HH_ID } })
  })

  it('P2025 (tekma — že izbrisano) → 404 Happy ura ne obstaja (prej 500)', async () => {
    mocks.hhDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: 'test' }),
    )
    const res = await hhDELETE(
      new Request(`http://localhost/api/happy-hour/${HH_ID}`, { method: 'DELETE' }),
      routeParams(HH_ID),
    )
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toMatchObject({ error: 'Happy ura ne obstaja' })
  })

  it('P2034 → 409 (canonical mapping)', async () => {
    mocks.hhDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' }),
    )
    const res = await hhDELETE(
      new Request(`http://localhost/api/happy-hour/${HH_ID}`, { method: 'DELETE' }),
      routeParams(HH_ID),
    )
    expect(res.status).toBe(409)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. HH-4 — percentage popust meja (0, 100]
// ══════════════════════════════════════════════════════════════════
describe('R112 D: createHappyHourSchema — percentage refine (HH-4)', () => {
  const base = { name: 'HH', priceGroupId: PG, startTime: '16:00', endTime: '18:00', daysOfWeek: [1] }

  it('percentage 150 IN percentage 0 → neveljavno s sporočilom Popust v procentih mora biti med 0 in 100.', () => {
    for (const amount of [150, 0]) {
      const result = createHappyHourSchema.safeParse({ ...base, discountType: 'percentage', discountAmount: amount })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message === 'Popust v procentih mora biti med 0 in 100.')).toBe(true)
      }
    }
  })

  it('mejne vrednosti: percentage 100 → veljavno; fixed_amount 150 → veljavno; brez popusta (defaults) → veljavno', () => {
    expect(createHappyHourSchema.safeParse({ ...base, discountType: 'percentage', discountAmount: 100 }).success).toBe(true)
    expect(createHappyHourSchema.safeParse({ ...base, discountType: 'fixed_amount', discountAmount: 150 }).success).toBe(true)
    // defaults (discountType 'none' + discountAmount 0) — regresija: refine ne sme poknjati brezpopustnih urnikov
    expect(createHappyHourSchema.safeParse(base).success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// E. fs-pini — vir pini (regresija zaščita)
// ══════════════════════════════════════════════════════════════════
describe('R112 E: fs-pini — kanon pini v viru', () => {
  const postSrc = readFileSync(join(process.cwd(), 'src/app/api/happy-hour/route.ts'), 'utf-8')
  const idSrc = readFileSync(join(process.cwd(), 'src/app/api/happy-hour/[id]/route.ts'), 'utf-8')
  const menuSrc = readFileSync(join(process.cwd(), 'src/lib/validations/menu.ts'), 'utf-8')

  it('POST: advisory lock + Serializable + overlap 409 + P2034/P2002 mapping + structuredErrorResponse pini', () => {
    expect(postSrc).toContain('pg_advisory_xact_lock')
    expect(postSrc).toContain('hashtext')
    expect(postSrc).toContain('happy-hour:')
    expect(postSrc).toContain('TransactionIsolationLevel.Serializable')
    expect(postSrc).toContain('Happy ura se prekriva z obstoječim urnikom (isti cenik).')
    expect(postSrc).toContain("isActive: true")
    expect(postSrc).toContain("'P2034'")
    expect(postSrc).toContain('structuredErrorResponse')
  })

  it('[id]: CAS updateMany (isActive: !newValue) + P2025→404 / P2034→409 + NI nepogojenega update pini', () => {
    expect(idSrc).toContain('updateMany')
    expect(idSrc).toContain('isActive: !newIsActive')
    expect(idSrc).toContain("'P2025'")
    expect(idSrc).toContain("'P2034'")
    expect(idSrc).toContain('Happy ura ne obstaja')
    expect(idSrc).toContain('status: 404')
    expect(idSrc).toContain('status: 409')
    // NEPOGOJEN update na urniku ne sme obstajati (CAS updateMany je edini toggle)
    expect(idSrc).not.toMatch(/happyHourSchedule\.update\(/)
  })

  it('menu.ts: percentage refine z mejo 100 + slovensko sporočilo pini', () => {
    expect(menuSrc).toContain('.refine(')
    expect(menuSrc).toContain('discountAmount <= 100')
    expect(menuSrc).toContain('Popust v procentih mora biti med 0 in 100.')
  })
})
