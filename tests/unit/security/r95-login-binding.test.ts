// ============================================
// R95-a — DVOSTOPENSKA PRIJAVA (BACKEND): employeeId binding + employees list
// ============================================
// R95-0 frozen kontrakt (BINDING-WHEN-PRESENT):
//   - loginSchema dobi opcionalen employeeId (podan = strog binding; odsoten =
//     legacy deterministični lastnik PIN-a — R94 kontrakt, e2e EDGE-4/15);
//   - verifyPin dobi BINDING VEJO PRED pinLookup/fallback potema:
//     findFirst { id, status:'active', pin:{not:''} } → bcrypt/timing-safe
//     proti NAJDENEMU zaposlenemu (+ plaintext migracija); manjkajoč /
//     neaktiven / napačen PIN → ISTI null → route enoten 401 (zero oracle);
//   - NOV GET /api/auth/employees?locationId= — javen prek '/api/auth'
//     prefixa (startsWith), GENERAL_PUBLIC_LIMIT na vrhu handlerja, R90
//     unificiran 404 za manjkajoč/slab format/neznano/neaktivno lokacijo,
//     select SAMO { id, name, role } (minimalen PII — Toast/Square standard
//     POS login grid).
//
// Vzorec (r92-429-shape / r89-token-rotate): vi.hoisted mocki + vi.mock
// tovarne, mockResolvedValue (nikoli .Once), zero-downstream asserti.
// REALNI: loginSchema (safeParse), rateLimitedResponse (direkten import
// rute — barrel mock je ločen), notInScopeResponse (tenant-scope realen,
// njegov db import pade na mockan '@/lib/db').
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const mocks = vi.hoisted(() => ({
  // db
  employeeFindFirst: vi.fn(),
  employeeFindUnique: vi.fn(),
  employeeFindMany: vi.fn(),
  employeeUpdate: vi.fn(),
  locationFindFirst: vi.fn(),
  // crypto
  bcryptCompare: vi.fn(),
  bcryptHash: vi.fn(),
  pinLookupEnabled: vi.fn(),
  hashPinLookup: vi.fn(),
  // rate limit barrel (rute importirajo checkRateLimitAsync/getClientIp iz barrela)
  rateLimitCheck: vi.fn(),
  // auth-middleware barrel (module-level import v _helpers)
  createSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    employee: {
      findFirst: mocks.employeeFindFirst,
      findUnique: mocks.employeeFindUnique,
      findMany: mocks.employeeFindMany,
      update: mocks.employeeUpdate,
    },
    location: {
      findFirst: mocks.locationFindFirst,
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: mocks.bcryptCompare,
    hash: mocks.bcryptHash,
  },
}))

vi.mock('@/lib/pin-lookup', () => ({
  pinLookupEnabled: mocks.pinLookupEnabled,
  hashPinLookup: mocks.hashPinLookup,
}))

vi.mock('@/lib/auth-middleware', () => ({
  createSession: mocks.createSession,
}))

// Barrel mock — rute (auth/employees) jemlje checkRateLimitAsync/getClientIp
// iz barrela; GENERAL_PUBLIC_LIMIT se re-exporta REALNEGA presets modula
// (iskren klic pin: route MORA podati pravi preset). rateLimitedResponse NI
// del tega mocka — rute ga importira DIREKTNO iz '@/lib/rate-limit/response'
// (hišni kanon: testi lastnijo barrel mocke, /response pot ostane realna).
vi.mock('@/lib/rate-limit', async () => {
  const presets = await import('@/lib/rate-limit/presets')
  return {
    checkRateLimitAsync: mocks.rateLimitCheck,
    getClientIp: vi.fn(() => '203.0.113.7'),
    GENERAL_PUBLIC_LIMIT: presets.GENERAL_PUBLIC_LIMIT,
  }
})

// Importi PO mockih
import { loginSchema } from '@/lib/validations/auth'
import { verifyPin } from '@/app/api/auth/_helpers'
import { GET as employeesGET } from '@/app/api/auth/employees/route'
import { notInScopeResponse } from '@/lib/tenant-scope'
import { BCRYPT_ROUNDS } from '@/lib/auth-middleware/constants'

const HASHED_PIN = '$2a$12$abcdefghijklmnopqrstuvhashedpinhash' // prikazni bcrypt hash
const LOOKUP_HMAC = 'lookup-hmac-hex'

function empFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'emp-abc-123',
    name: 'Ana Test',
    email: 'ana@test.si',
    role: 'waiter',
    pin: HASHED_PIN,
    locationId: 'loc-1',
    jobs: [{ isPrimary: true, job: { id: 'job-1', name: 'Natakar', permissions: '[]', basePayRate: 10 } }],
    ...overrides,
  }
}

function employeesReq(query = ''): Request {
  return new Request(`http://localhost:3000/api/auth/employees${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  // privzeto: rate limit dovoli, lokacija obstaja, pin-lookup na voljo
  mocks.rateLimitCheck.mockResolvedValue({ allowed: true, remaining: 19 })
  mocks.locationFindFirst.mockResolvedValue({ id: 'loc-1', name: 'Test Lokacija' })
  mocks.pinLookupEnabled.mockReturnValue(true)
  mocks.hashPinLookup.mockReturnValue(LOOKUP_HMAC)
  mocks.bcryptHash.mockResolvedValue('new-bcrypt-hash')
})

// ══════════════════════════════════════════════════════════════════
// A. loginSchema — employeeId binding polje (R95 kontrakt)
// ══════════════════════════════════════════════════════════════════
describe('R95-a A: loginSchema — opcionalen employeeId', () => {
  it('brez employeeId → pass (legacy PIN-only oblika ostane veljavna)', () => {
    const parsed = loginSchema.safeParse({ pin: '1234' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.employeeId).toBeUndefined()
  })

  it('veljaven cuid-ish employeeId → pass + polje ohranjeno (binding cilj)', () => {
    const parsed = loginSchema.safeParse({ pin: '123456', employeeId: 'emp-abc-123' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.employeeId).toBe('emp-abc-123')
  })

  it.each([
    ['prekratek (4 znaki < min 5)', 'abcd'],
    ['slab charset (pika)', 'emp.123'],
    ['slab charset (presledek)', 'emp 123'],
    ['predolg (101 znakov)', 'a'.repeat(101)],
  ])('employeeId %s → fail', (_label, employeeId) => {
    const parsed = loginSchema.safeParse({ pin: '123456', employeeId })
    expect(parsed.success).toBe(false)
  })

  it('pin polja ostanejo pinstana (R94 kontrakt nedotaknjen)', () => {
    expect(loginSchema.safeParse({ pin: '123' }).success).toBe(false) // < legacy min 4
    expect(loginSchema.safeParse({ pin: '12a4' }).success).toBe(false) // non-digit
    expect(loginSchema.safeParse({ pin: '1'.repeat(21) }).success).toBe(false) // > max 20
    expect(loginSchema.safeParse({ pin: '1'.repeat(20) }).success).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// B. verifyPin — BINDING VEJA (employeeId podan)
// ══════════════════════════════════════════════════════════════════
describe('R95-a B: verifyPin binding veja', () => {
  it('pravi employeeId + njegov bcrypt PIN → vrne zaposlenega (findFirst + compare)', async () => {
    const emp = empFixture()
    mocks.employeeFindFirst.mockResolvedValue(emp)
    mocks.bcryptCompare.mockResolvedValue(true)

    const result = await verifyPin({ pin: '123456', employeeId: 'emp-abc-123' })

    expect(result).toEqual(emp)
    // binding poizvedba: id + aktivnost + non-empty pin filter, z jobs include
    expect(mocks.employeeFindFirst).toHaveBeenCalledTimes(1)
    expect(mocks.employeeFindFirst).toHaveBeenCalledWith({
      where: { id: 'emp-abc-123', status: 'active', pin: { not: '' } },
      include: { jobs: { include: { job: true } } },
    })
    expect(mocks.bcryptCompare).toHaveBeenCalledWith('123456', HASHED_PIN)
    // hash veja NE migrira (update samo za plaintext)
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('pravi employeeId + TUJ veljaven PIN (drugi zaposleni) → null (strog binding)', async () => {
    mocks.employeeFindFirst.mockResolvedValue(empFixture())
    mocks.bcryptCompare.mockResolvedValue(false)

    const result = await verifyPin({ pin: '9999', employeeId: 'emp-abc-123' })

    expect(result).toBeNull()
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('neznan employeeId → null IN druge poti NEZAZENANE (zero oracle, zero klicev)', async () => {
    mocks.employeeFindFirst.mockResolvedValue(null)

    const result = await verifyPin({ pin: '123456', employeeId: 'ghost-employee-id' })

    expect(result).toBeNull()
    // pinLookup pot (findUnique) IN fallback pot (findMany) se NE sprožita —
    // binding veja je edini klic (isti null kot napačen PIN = enoten 401 v route)
    expect(mocks.employeeFindUnique).not.toHaveBeenCalled()
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
    expect(mocks.bcryptCompare).not.toHaveBeenCalled()
  })

  it('neaktiven zaposleni (status != active) → null (where filter pinan)', async () => {
    // DB vrne null, ker where { status: 'active' } izloči inactive vrstico
    mocks.employeeFindFirst.mockResolvedValue(null)

    const result = await verifyPin({ pin: '123456', employeeId: 'emp-inactive-1' })

    expect(result).toBeNull()
    expect(mocks.employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'emp-inactive-1', status: 'active', pin: { not: '' } } })
    )
    expect(mocks.bcryptCompare).not.toHaveBeenCalled()
  })

  it('zaposleni brez PIN-a (pin prazen) → null (where pin { not: "" } že filtrira)', async () => {
    mocks.employeeFindFirst.mockResolvedValue(null)

    const result = await verifyPin({ pin: '123456', employeeId: 'emp-no-pin-1' })

    expect(result).toBeNull()
    expect(mocks.employeeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pin: { not: '' } }) })
    )
    expect(mocks.bcryptCompare).not.toHaveBeenCalled()
  })

  it('plaintext PIN + binding + match → timing-safe match + migracija (bcrypt hash + pinLookup update)', async () => {
    const emp = empFixture({ pin: '1234' })
    mocks.employeeFindFirst.mockResolvedValue(emp)

    const result = await verifyPin({ pin: '1234', employeeId: 'emp-abc-123' })

    expect(result).toEqual(emp)
    // plaintext pot: NE bcrypt.compare, AMPAK timing-safe padded primerjava (real crypto)
    expect(mocks.bcryptCompare).not.toHaveBeenCalled()
    // migracija: hash z BCRYPT_ROUNDS (12) + update pin + pinLookup
    expect(mocks.bcryptHash).toHaveBeenCalledWith('1234', BCRYPT_ROUNDS)
    expect(mocks.employeeUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.employeeUpdate).toHaveBeenCalledWith({
      where: { id: 'emp-abc-123' },
      data: { pin: 'new-bcrypt-hash', pinLookup: LOOKUP_HMAC },
    })
  })

  it('plaintext PIN + binding + ne-match → null BREZ migracije', async () => {
    const emp = empFixture({ pin: '1234' })
    mocks.employeeFindFirst.mockResolvedValue(emp)

    const result = await verifyPin({ pin: '9999', employeeId: 'emp-abc-123' })

    expect(result).toBeNull()
    expect(mocks.bcryptHash).not.toHaveBeenCalled()
    expect(mocks.employeeUpdate).not.toHaveBeenCalled()
  })

  it('employeeId ODSOTEN → legacy pot (pinLookup findUnique), binding veja ni sprožena (e2e EDGE-4/15)', async () => {
    mocks.employeeFindUnique.mockResolvedValue(null)

    const result = await verifyPin({ pin: '1234' })

    expect(result).toBeNull()
    // deterministični lastnik PIN-a: O(1) pinLookup poizvedba, NE findFirst
    expect(mocks.employeeFindUnique).toHaveBeenCalledWith({
      where: { pinLookup: LOOKUP_HMAC, status: 'active' },
      include: { jobs: { include: { job: true } } },
    })
    expect(mocks.employeeFindFirst).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════
// C. GET /api/auth/employees — login grid endpoint
// ══════════════════════════════════════════════════════════════════
describe('R95-a C: GET /api/auth/employees', () => {
  it('brez locationId → 404 notInScope oblika IN ZERO db klicev', async () => {
    const res = await employeesGET(employeesReq())

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body).toEqual({ error: 'Lokacija ni najden' })
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
  })

  it.each([
    ['prekratek id', '?locationId=ab'],
    ['slab charset (pika)', '?locationId=loc.1'],
    ['slab charset (preslezek)', '?locationId=loc%201'],
  ])('slab format locationId (%s) → isti 404, ZERO db klicev (ni oraklja)', async (_label, query) => {
    const res = await employeesGET(employeesReq(query))

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
  })

  it('neznana / neaktivna lokacija → 404 (findFirst null) IN employee.findMany NEZAZENAN', async () => {
    mocks.locationFindFirst.mockResolvedValue(null)

    const res = await employeesGET(employeesReq('?locationId=loc-404'))

    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Lokacija ni najden')
    // samo aktivna lokacija gre skozi: where { id, isActive: true } + minimalen select
    expect(mocks.locationFindFirst).toHaveBeenCalledWith({
      where: { id: 'loc-404', isActive: true },
      select: { id: true, name: true },
    })
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
  })

  it('uspeh → { location: { id, name }, employees: [{id,name,role}] } — select PII-pinan + rate limit PRED findFirst', async () => {
    mocks.employeeFindMany.mockResolvedValue([
      { id: 'emp-1', name: 'Ana Test', role: 'waiter' },
      { id: 'emp-2', name: 'Boris Test', role: 'cook' },
    ])

    const res = await employeesGET(employeesReq('?locationId=loc-1'))

    expect(res.status).toBe(200)
    const body = await res.json() as { location: { id: string; name: string }; employees: Array<Record<string, string>> }
    expect(body.location).toEqual({ id: 'loc-1', name: 'Test Lokacija' })
    expect(body.employees).toEqual([
      { id: 'emp-1', name: 'Ana Test', role: 'waiter' },
      { id: 'emp-2', name: 'Boris Test', role: 'cook' },
    ])
    // vsak vrstica v odgovoru nosi TOČNO id/name/role (ni email/permissions/payRate)
    for (const row of body.employees) expect(Object.keys(row).sort()).toEqual(['id', 'name', 'role'])

    // select pin: Prisma select objekt IZRECNO brez email polja (PII na viru)
    const findManyArg = mocks.employeeFindMany.mock.calls[0][0] as {
      select: Record<string, boolean>
    }
    expect(Object.keys(findManyArg.select).sort()).toEqual(['id', 'name', 'role'])

    // rate limit NAJVIŠJI točki handlerja — PRED lokacijsko poizvedbo (R90 canon model)
    expect(mocks.rateLimitCheck.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.locationFindFirst.mock.invocationCallOrder[0])
  })

  it('rate limit blocked → 429 kanon glave + telo "Preveč zahtevkov" + ZERO db klicev + klic pin', async () => {
    // brez retryAfterMs → helperjev realen fallback 60 s (fallback pot, ne hardkoda)
    mocks.rateLimitCheck.mockResolvedValue({ allowed: false })

    const res = await employeesGET(employeesReq('?locationId=loc-1'))

    expect(res.status).toBe(429)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Preveč zahtevkov')
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(Number(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0)

    // klic pin: fiksni store key + IP + REALNI GENERAL_PUBLIC_LIMIT (20/min)
    expect(mocks.rateLimitCheck).toHaveBeenCalledTimes(1)
    expect(mocks.rateLimitCheck).toHaveBeenCalledWith(
      'auth-employees',
      '203.0.113.7',
      expect.objectContaining({ maxRequests: 20, windowMs: 60000 }),
    )

    // zavrnitev PRED vsem db delom (anonimna površina — throttle pred validacijo)
    expect(mocks.locationFindFirst).not.toHaveBeenCalled()
    expect(mocks.employeeFindMany).not.toHaveBeenCalled()
  })

  it('klic pin findMany: where lokacija/aktivnost/PIN filter + orderBy name asc', async () => {
    await employeesGET(employeesReq('?locationId=loc-2'))

    expect(mocks.employeeFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.employeeFindMany).toHaveBeenCalledWith({
      where: { locationId: 'loc-2', status: 'active', pin: { not: '' } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })
  })

  it('notInScopeResponse je realen helper (unificiran 404 oblika)', () => {
    const res = notInScopeResponse('Lokacija')
    expect(res.status).toBe(404)
  })
})

// ══════════════════════════════════════════════════════════════════
// D. fs-guard — route obstaja + POST /api/auth route NI spremenjen
// ══════════════════════════════════════════════════════════════════
describe('R95-a D: fs-guard', () => {
  it('src/app/api/auth/employees/route.ts obstaja z ključnimi kanon pini', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/auth/employees/route.ts'), 'utf8')
    expect(src).toContain("export const dynamic = 'force-dynamic'")
    // rate limit na vrhu handlerja, fiksni store key, direkt helper import
    expect(src).toContain("checkRateLimitAsync('auth-employees'")
    expect(src).toContain("from '@/lib/rate-limit/response'")
    // unificiran 404 (R90 canon)
    expect(src).toContain("notInScopeResponse('Lokacija')")
    // PII select pin
    expect(src).toContain('select: { id: true, name: true, role: true }')
  })

  it('POST /api/auth/route.ts NI spremenjen — še vedno kliče verifyPin(data) s celim validated body', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/auth/route.ts'), 'utf8')
    // route poda cel validated body (employeeId prileti avtomatsko, binding je v _helpers)
    expect(src).toContain('verifyPin(data)')
    expect(src).toContain("from './_helpers'")
    // route NE razčlenjuje employeeId sam (zero drift — R94 PIN-only oblika klica)
    expect(src).not.toContain('data.employeeId')
  })
})
