// ============================================
// R147-b — EPIC #115 #34 DATA PORTABILITY — trap-DB uniti
// ============================================
// Vzorec r146-accounting-export (vi.hoisted + vi.mock('@/lib/db') +
// vi.mock('@/lib/auth-middleware') z importOriginal spreadom — requireAuth na
// meji z REALEN hasPermission; tenant resolverji REALNI iz '@/lib/tenant-scope'
// (ruta ga uvaža direktno — ni mockan); rateLimitedResponse REALen iz
// '@/lib/rate-limit/response'; serialize canon REALen (crypto — checksum
// determinizem gre čez pravi computeChecksum).
//
// Pokritje (kontrakt R147-b):
//   1.  rl bucket 'data-portability' PRED authom (getClientIp + AUTHENTICATED_LIMIT)
//   2.  429 realen rateLimitedResponse — zero-DB, zero-audit
//   3.  401 fail-closed — zero-DB, zero-audit
//   4.  403 manager (permission 'admin' — bypass NE preide) — zero-DB, zero-audit
//   5.  MODEL A: manager s 'admin' permissionom BREZ lokacije → 403 NO_LOCATION_MESSAGE
//   6.  MODEL A: super-admin brez ?locationId → GLOBAL (where brez lokacijskega filtra)
//   7.  MODEL A: super-admin z ?locationId → direktni spread locationId
//   8.  MODEL A: relacijski spreadi (7 tabel brez lastnega locationId)
//   9.  MODEL A: regular (manager+admin perm, s lokacijo) — seja avtoritativna
//   10. mode neznana → 400 točno sporočilo (zero-DB, zero-audit)
//   11. mode=manifest → counts-only: vseh 17 count(), findMany NIČ, brez sections, checksum ''
//   12. countsChecksum determinizem + pariteta manifest == full
//   13. manifest → brez audit zapisa + brez attachment glav + no-store
//   14. AuditLog select cenzura (brez ipAddress/terminalId/previousHash/chainHash/userAgent)
//       + take 10000 + orderBy [timestamp asc, id asc]
//   15. Guest select/orderBy/take pin (whitelist + determinizem + cap 5000)
//   16. meta: VSI 17 selectov brez prepovedanih ključev (PIN-i, seje, skrivnosti, veriga)
//   17. encodeRowValues: Decimal → string, Date → ISO (serialize reuse)
//   18. full headers: Content-Disposition prenos-podatkov-*.json + X-Portability-Checksum
//       + X-Portability-Sections + no-store + Content-Type json
//   19. format/version/scope pin + locationName (location.findUnique where/select pin)
//   20. notes: cross-ref 'Poročila → Izvoz' + '#33' + '/api/gdpr/export/'
//   21. checksum determinizem (2 klica isti data → isti X-Portability-Checksum)
//   22. audit full 200: DATA_PORTABILITY_EXPORTED / PortabilityExport / 'full:locX'
//       / details counters-only (tables 17, sections 5, rows N, checksum)
//   23. audit full global: entityId 'full:global' + locationId null
//   24. zero-oracle: neobstoječa lokacija → 200 prazne sekcije, checksum ≡ veljavna prazna
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const LOC_X = 'loc-x'

const mocks = vi.hoisted(() => {
  const models = [
    'guest', 'guestVisit', 'loyaltyAccount', 'loyaltyTransaction', 'reservation',
    'waitlistEntry', 'guestFeedback', 'menu', 'category', 'menuItem',
    'modifierGroup', 'modifier', 'taxRate', 'recipeItem', 'inventoryItem',
    'stockTransaction', 'auditLog',
  ]
  const findMany: Record<string, ReturnType<typeof vi.fn>> = {}
  const count: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of models) {
    findMany[m] = vi.fn()
    count[m] = vi.fn()
  }
  return {
    models,
    findMany,
    count,
    locationFindUnique: vi.fn(),
    requireAuth: vi.fn(),
    createAuditLog: vi.fn(),
    checkRateLimitAsync: vi.fn(),
    getClientIp: vi.fn(),
  }
})

// DB_MODELS živi v vi.hoisted (mock factory se hojsta pred top-level consti —
// referenca na fajlski const v factory = TDZ past, "Cannot access before
// initialization" ko tenant-scope.ts potegne mockan '@/lib/db').
const DB_MODELS = mocks.models as readonly string[]

vi.mock('@/lib/db', () => {
  const dbMock: Record<string, unknown> = {}
  // Factory se izvede LAZY ob prvem importu (route → tenant-scope → db), torej
  // ŠELE pred top-level consti test fajla → referenciramo SAMO mocks (hoisted),
  // ne DB_MODELS.
  for (const m of mocks.models) {
    dbMock[m] = { findMany: mocks.findMany[m], count: mocks.count[m] }
  }
  dbMock.location = { findUnique: mocks.locationFindUnique }
  dbMock.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
  return { db: dbMock, createAuditLog: mocks.createAuditLog }
})

// requireAuth mockan na meji z REALEN hasPermission (r145/r146 kanon); tenant
// resolverji ostanejo REALNI (ruta uvaža resolveTenantLocationIdOrThrow
// direktno iz '@/lib/tenant-scope' — ta modul NI mockan)
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: mocks.requireAuth,
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
  AUTHENTICATED_LIMIT: { maxRequests: 120, windowMs: 60_000 },
}))

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

import { GET as portabilityGET } from '@/app/api/export/portability/route'
import {
  AUDIT_LOG_SELECT,
  GUEST_SELECT,
} from '@/app/api/export/portability/_helpers/portability-selects'
import {
  PORTABILITY_AUDIT_CAP,
  PORTABILITY_MODELS,
  PORTABILITY_NOTES,
  PORTABILITY_SECTIONS,
  PORTABILITY_TABLE_CAP,
  PORTABILITY_TABLES,
} from '@/app/api/export/portability/_helpers/portability-sections'
import { hasPermission } from '@/lib/auth-middleware/permissions'

// sessionRef — requireAuth mock bere trenutno sejo (r145 kanon)
const sessionRef: { current: Record<string, unknown> | null } = { current: null }

// ---------- Fixture helperji ----------

function session(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-1',
    employeeId: 'emp-1',
    role: 'manager',
    permissions: ['view_reports'],
    locationId: LOC_A,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    absoluteExpiry: Date.now() + 86_400_000,
    ...overrides,
  }
}

const superAdminSession = () =>
  session({ role: 'super_admin', locationId: null, permissions: ['admin'] })
/** Manager z izrecnim 'admin' permissionom — preide requireAuth, v resolverju
 *  pa NI tenant-admin vloga → MODEL A 'regular' pot. */
const adminPermNoLocationSession = () =>
  session({ role: 'manager', permissions: ['admin'], locationId: null })
const adminPermWithLocationSession = () =>
  session({ role: 'manager', permissions: ['admin'], locationId: LOC_A })

const unauthorized = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Avtentikacija je obvezna.' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  }),
})

const forbidden = () => ({
  session: null,
  error: new Response(JSON.stringify({ error: 'Nimate dovoljenja za to operacijo.' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  }),
})

function portabilityURL(params: string): string {
  return `http://localhost:3000/api/export/portability${params}`
}

function guestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest-1',
    firstName: 'Ana',
    lastName: 'Novak',
    email: 'ana@example.com',
    phone: '+38640123456',
    isVip: false,
    allergens: '["1"]',
    totalSpent: new Prisma.Decimal('100.50'),
    loyaltyAccountId: null,
    locationId: LOC_X,
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  }
}

function visitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'visit-1',
    guestId: 'guest-1',
    partySize: 2,
    totalSpent: new Prisma.Decimal('54.10'),
    feedbackScore: 5,
    employeeName: 'Peter Natakar',
    arrivedAt: new Date('2026-01-15T19:00:00Z'),
    createdAt: new Date('2026-01-15T19:05:00Z'),
    ...overrides,
  }
}

/** First-call args (findMany/count) za model. */
function argsOf(model: string): Record<string, unknown> {
  return mocks.findMany[model].mock.calls[0][0] as Record<string, unknown>
}

function countArgsOf(model: string): Record<string, unknown> {
  return mocks.count[model].mock.calls[0][0] as Record<string, unknown>
}

/** Zero-DB pin: noben model findMany/count + location lookup ni klican. */
function expectZeroDb(): void {
  for (const m of DB_MODELS) {
    expect(mocks.findMany[m]).not.toHaveBeenCalled()
    expect(mocks.count[m]).not.toHaveBeenCalled()
  }
  expect(mocks.locationFindUnique).not.toHaveBeenCalled()
}

const HEX64 = /^[0-9a-f]{64}$/

async function jsonBody(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockImplementation(async (_req: Request, opts?: { permission?: string | string[] }) => {
    if (!sessionRef.current) return unauthorized()
    const required = !opts?.permission ? [] : Array.isArray(opts.permission) ? opts.permission : [opts.permission]
    if (!hasPermission(sessionRef.current as never, required as never)) return forbidden()
    return { session: sessionRef.current, error: null }
  })
  sessionRef.current = superAdminSession()
  mocks.getClientIp.mockReturnValue('203.0.113.7')
  mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.locationFindUnique.mockResolvedValue({ name: 'Lokacija A' })
  for (const m of DB_MODELS) {
    mocks.findMany[m].mockResolvedValue([])
    mocks.count[m].mockResolvedValue(0)
  }
})

// ════════════════════════════════════════════════════════════════
// Rate limit + auth vrata
// ════════════════════════════════════════════════════════════════
describe('R147 portability — rate limit + auth vrata', () => {
  it("1. rl bucket 'data-portability' PRED authom — getClientIp(req) + AUTHENTICATED_LIMIT", async () => {
    const res = await portabilityGET(new Request(portabilityURL('?locationId=' + LOC_X)))
    expect(res.status).toBe(200)
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledTimes(1)
    const [bucket, ip, limit] = mocks.checkRateLimitAsync.mock.calls[0]
    expect(bucket).toBe('data-portability')
    expect(ip).toBe('203.0.113.7')
    expect(limit).toEqual({ maxRequests: 120, windowMs: 60_000 })
    // PRED authom (invocationCallOrder kanon)
    expect(mocks.checkRateLimitAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requireAuth.mock.invocationCallOrder[0],
    )
    expect(mocks.requireAuth).toHaveBeenCalledWith(
      expect.anything(),
      { permission: 'admin' },
    )
  })

  it('2. 429 realen rateLimitedResponse — Retry-After 30, zero-DB, zero-audit', async () => {
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 })
    const res = await portabilityGET(new Request(portabilityURL('')))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('30')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0')
    const body = await jsonBody(res)
    expect(body.error).toBe('Preveč zahtevkov')
    expectZeroDb()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('3. 401 fail-closed — zero-DB, zero-audit', async () => {
    sessionRef.current = null
    const res = await portabilityGET(new Request(portabilityURL('')))
    expect(res.status).toBe(401)
    expectZeroDb()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("4. 403 manager — permission 'admin' bypass NE preide — zero-DB, zero-audit", async () => {
    sessionRef.current = session({ role: 'manager', permissions: ['view_reports'] })
    const res = await portabilityGET(new Request(portabilityURL('')))
    expect(res.status).toBe(403)
    const body = await jsonBody(res)
    expect(body.error).toBe('Nimate dovoljenja za to operacijo.')
    expectZeroDb()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it("5. MODEL A: manager s 'admin' permissionom BREZ lokacije → 403 NO_LOCATION_MESSAGE (fail-closed)", async () => {
    sessionRef.current = adminPermNoLocationSession()
    const res = await portabilityGET(new Request(portabilityURL('')))
    expect(res.status).toBe(403)
    const body = await jsonBody(res)
    expect(body.error).toBe('Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.')
    expectZeroDb()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// MODEL A scope + parametri
// ════════════════════════════════════════════════════════════════
describe('R147 portability — MODEL A scope', () => {
  it('6. super-admin brez ?locationId → GLOBAL — where BREZ lokacijskega filtra (direktno + relacijsko)', async () => {
    const res = await portabilityGET(new Request(portabilityURL('')))
    expect(res.status).toBe(200)
    // direktni spread: prazen where
    expect(argsOf('guest').where).toEqual({})
    expect(argsOf('inventoryItem').where).toEqual({})
    expect(argsOf('auditLog').where).toEqual({})
    // relacijski spread: prazen where (brez scope-a brez filtra)
    expect(argsOf('guestVisit').where).toEqual({})
    expect(argsOf('stockTransaction').where).toEqual({})
    // body scope: locationId null
    const body = await jsonBody(res)
    expect((body.scope as Record<string, unknown>).locationId).toBeNull()
  })

  it('7. super-admin z ?locationId=locX → direktni spread locationId na modelih z lastnim stolpcem', async () => {
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    expect(res.status).toBe(200)
    for (const m of ['guest', 'loyaltyAccount', 'reservation', 'waitlistEntry', 'guestFeedback', 'menu', 'modifierGroup', 'taxRate', 'inventoryItem']) {
      expect(argsOf(m).where).toEqual({ locationId: LOC_X })
    }
    expect(argsOf('auditLog').where).toEqual({ locationId: LOC_X })
    const body = await jsonBody(res)
    expect((body.scope as Record<string, unknown>).locationId).toBe(LOC_X)
  })

  it('8. relacijski spreadi — 7 tabel BREZ lastnega locationId (točne poti)', async () => {
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    expect(res.status).toBe(200)
    expect(argsOf('guestVisit').where).toEqual({ guest: { locationId: LOC_X } })
    expect(argsOf('loyaltyTransaction').where).toEqual({ loyaltyAccount: { locationId: LOC_X } })
    expect(argsOf('category').where).toEqual({ menu: { locationId: LOC_X } })
    expect(argsOf('menuItem').where).toEqual({ category: { menu: { locationId: LOC_X } } })
    expect(argsOf('modifier').where).toEqual({ modifierGroup: { locationId: LOC_X } })
    expect(argsOf('recipeItem').where).toEqual({
      menuItem: { category: { menu: { locationId: LOC_X } } },
    })
    expect(argsOf('stockTransaction').where).toEqual({ inventoryItem: { locationId: LOC_X } })
  })

  it('9. regular s sejsko lokacijo — seja AVTORITATIVNA (?locationId tuja IGNORIRAN)', async () => {
    sessionRef.current = adminPermWithLocationSession()
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_B}`)))
    expect(res.status).toBe(200)
    expect(argsOf('guest').where).toEqual({ locationId: LOC_A })
    expect(argsOf('guestVisit').where).toEqual({ guest: { locationId: LOC_A } })
    const body = await jsonBody(res)
    expect((body.scope as Record<string, unknown>).locationId).toBe(LOC_A)
  })

  it("10. mode neznana → 400 'Neznan način. Dovoljeno: manifest, full' — zero-DB, zero-audit", async () => {
    const res = await portabilityGET(new Request(portabilityURL('?mode=csv')))
    expect(res.status).toBe(400)
    const body = await jsonBody(res)
    expect(body.error).toBe('Neznan način. Dovoljeno: manifest, full')
    expectZeroDb()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('24. zero-oracle: neobstoječa lokacija → 200 prazne sekcije, checksum ≡ veljavna prazna lokacija', async () => {
    mocks.locationFindUnique.mockResolvedValue(null)
    const res1 = await portabilityGET(new Request(portabilityURL('?locationId=loc-neobstaja-1')))
    const res2 = await portabilityGET(new Request(portabilityURL('?locationId=loc-neobstaja-2')))
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const body1 = await jsonBody(res1)
    const counts1 = body1.counts as Record<string, Record<string, number>>
    expect(counts1.customers.Guest).toBe(0)
    expect(counts1.audit.AuditLog).toBe(0)
    expect((body1.scope as Record<string, unknown>).locationName).toBeNull()
    // brez 404 asimetrije — isti checksum za katerokoli neobstoječo lokacijo
    expect(res1.headers.get('X-Portability-Checksum')).toBe(res2.headers.get('X-Portability-Checksum'))
  })
})

// ════════════════════════════════════════════════════════════════
// Manifest mode
// ════════════════════════════════════════════════════════════════
describe('R147 portability — manifest mode', () => {
  it('11. mode=manifest → counts-only: vseh 17 count(), findMany NIČ, brez sections, checksum ""', async () => {
    const res = await portabilityGET(new Request(portabilityURL('?mode=manifest&locationId=' + LOC_X)))
    expect(res.status).toBe(200)
    for (const m of DB_MODELS) {
      expect(mocks.findMany[m]).not.toHaveBeenCalled()
      expect(mocks.count[m]).toHaveBeenCalledTimes(1)
    }
    // count() dobi isti scope where kakor findMany (determinizem manifest == full)
    expect(countArgsOf('guest')).toEqual({ where: { locationId: LOC_X } })
    expect(countArgsOf('guestVisit')).toEqual({ where: { guest: { locationId: LOC_X } } })
    expect(countArgsOf('recipeItem')).toEqual({
      where: { menuItem: { category: { menu: { locationId: LOC_X } } } },
    })
    const body = await jsonBody(res)
    expect(body.sections).toBeUndefined()
    expect(body.checksum).toBe('')
    const counts = body.counts as Record<string, Record<string, number>>
    for (const section of PORTABILITY_SECTIONS) {
      expect(Object.keys(counts[section]).length).toBeGreaterThan(0)
    }
    expect(counts.customers.Guest).toBe(0)
  })

  it('12. countsChecksum determinizem + pariteta manifest == full (isti DB snapshot)', async () => {
    mocks.findMany.guest.mockResolvedValue([guestRow(), guestRow({ id: 'guest-2' })])
    mocks.findMany.guestVisit.mockResolvedValue([visitRow()])
    mocks.count.guest.mockResolvedValue(2)
    mocks.count.guestVisit.mockResolvedValue(1)
    const manifestRes = await portabilityGET(new Request(portabilityURL('?mode=manifest&locationId=' + LOC_X)))
    const fullRes = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    const manifestBody = await jsonBody(manifestRes)
    const fullBody = await jsonBody(fullRes)
    expect(manifestBody.countsChecksum).toMatch(HEX64)
    expect(manifestBody.countsChecksum).toBe(fullBody.countsChecksum)
    // determinizem: 2. manifest klic → isti countsChecksum
    const manifestRes2 = await portabilityGET(new Request(portabilityURL('?mode=manifest&locationId=' + LOC_X)))
    expect((await jsonBody(manifestRes2)).countsChecksum).toBe(manifestBody.countsChecksum)
  })

  it('13. manifest → BREZ audit zapisa + brez attachment glav + no-store', async () => {
    const res = await portabilityGET(new Request(portabilityURL('?mode=manifest')))
    expect(res.status).toBe(200)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(res.headers.get('Content-Disposition')).toBeNull()
    expect(res.headers.get('X-Portability-Checksum')).toBeNull()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Content-Type')).toContain('application/json')
  })
})

// ════════════════════════════════════════════════════════════════
// Full mode — sekcije, cenzura, caps, determinizem
// ════════════════════════════════════════════════════════════════
describe('R147 portability — full mode (selecti, caps, headers)', () => {
  it('14. AuditLog select cenzura + take 10000 + orderBy [timestamp asc, id asc]', async () => {
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    expect(res.status).toBe(200)
    const args = argsOf('auditLog')
    expect(args.select).toEqual(AUDIT_LOG_SELECT)
    expect(args.orderBy).toEqual([{ timestamp: 'asc' }, { id: 'asc' }])
    expect(args.take).toBe(PORTABILITY_AUDIT_CAP)
    expect(args.take).toBe(10000)
    const s = JSON.stringify(args.select)
    expect(s).not.toContain('ipAddress')
    expect(s).not.toContain('terminalId')
    expect(s).not.toContain('previousHash')
    expect(s).not.toContain('chainHash')
    expect(s).not.toContain('userAgent')
  })

  it('15. Guest select/orderBy/take pin — whitelist + determinizem + cap 5000', async () => {
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    expect(res.status).toBe(200)
    const args = argsOf('guest')
    expect(args.where).toEqual({ locationId: LOC_X })
    expect(args.select).toEqual(GUEST_SELECT)
    expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
    expect(args.take).toBe(PORTABILITY_TABLE_CAP)
    expect(args.take).toBe(5000)
  })

  it('16. meta: VSI 17 selectov brez prepovedanih ključev (PIN-i, skrivnosti, revija metadata, verige)', async () => {
    expect(PORTABILITY_TABLES).toHaveLength(17)
    expect(PORTABILITY_MODELS).toHaveLength(17)
    const forbidden = [
      'pin', 'pinLookup', 'ipAddress', 'userAgent', 'terminalId',
      'previousHash', 'chainHash', 'fursCertPassword', 'cisCertPassword',
      'emailSmtpPassword', 'apiKeys', 'password', 'token', 'secret',
    ]
    for (const spec of PORTABILITY_TABLES) {
      for (const key of forbidden) {
        expect(key in spec.select).toBe(false)
      }
    }
    // registry pokrije natanko 17 modelov v 5 sekcijah
    expect(PORTABILITY_MODELS).toEqual(
      [
        'AuditLog', 'Category', 'Guest', 'GuestFeedback', 'GuestVisit',
        'InventoryItem', 'LoyaltyAccount', 'LoyaltyTransaction', 'Menu',
        'MenuItem', 'Modifier', 'ModifierGroup', 'RecipeItem', 'Reservation',
        'StockTransaction', 'TaxRate', 'WaitlistEntry',
      ],
    )
  })

  it('17. encodeRowValues reuse: Decimal → string, Date → ISO (checksum-stabilna serializacija)', async () => {
    mocks.findMany.guest.mockResolvedValue([guestRow()])
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    const body = await res.text()
    // Decimal → STRING (ne številka): Decimal('100.50').toString() = '100.5'
    expect(body).toContain('"totalSpent":"100.5"')
    // Date → ISO
    expect(body).toContain('"createdAt":"2026-01-15T10:00:00.000Z"')
    // PII gostov je del arhiva (epic 'customers') — whitelist select, ne cenzura
    expect(body).toContain('"lastName":"Novak"')
  })

  it('18. full headers: attachment prenos-podatkov-*.json + X-Portability-Checksum + X-Portability-Sections + no-store', async () => {
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    expect(res.status).toBe(200)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toMatch(/^attachment; filename="prenos-podatkov-\d{8}-\d{6}\.json"$/)
    expect(res.headers.get('X-Portability-Checksum')).toMatch(HEX64)
    expect(res.headers.get('X-Portability-Sections')).toBe('customers,menu,recipes,inventory,audit')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
  })

  it("19. format/version/scope pin: 'restaurantos-portability' v1 + locationName snapshot", async () => {
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    const body = await jsonBody(res)
    expect(body.format).toBe('restaurantos-portability')
    expect(body.version).toBe(1)
    expect(body.schemaStamp).toMatch(HEX64)
    const scope = body.scope as Record<string, unknown>
    expect(scope.locationId).toBe(LOC_X)
    expect(scope.locationName).toBe('Lokacija A')
    expect(mocks.locationFindUnique).toHaveBeenCalledWith({
      where: { id: LOC_X },
      select: { name: true },
    })
  })

  it("20. notes: cross-ref 'Poročila → Izvoz' + '#33' + '/api/gdpr/export/' + izključitve", async () => {
    const res = await portabilityGET(new Request(portabilityURL('?mode=manifest')))
    const body = await jsonBody(res)
    const notes = body.notes as string[]
    expect(notes).toEqual(PORTABILITY_NOTES)
    expect(notes.join(' ')).toContain('Poročila → Izvoz')
    expect(notes.join(' ')).toContain('#33')
    expect(notes.join(' ')).toContain('/api/gdpr/export/')
    expect(notes.join(' ')).toContain('/api/gdpr/anonymize/')
    expect(notes.join(' ')).toContain('IZKLJUČENE skrivnosti')
    expect(notes.join(' ')).toContain('locationId NULL')
  })

  it('21. checksum determinizem: 2 klica isti data → isti X-Portability-Checksum (+ countsChecksum)', async () => {
    mocks.findMany.guest.mockResolvedValue([guestRow()])
    mocks.findMany.stockTransaction.mockResolvedValue([
      { id: 'stx-1', inventoryItemId: 'inv-1', type: 'sale', quantity: new Prisma.Decimal('2'), createdAt: new Date('2026-01-16T08:00:00Z') },
    ])
    const res1 = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    const res2 = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    const c1 = res1.headers.get('X-Portability-Checksum')
    const c2 = res2.headers.get('X-Portability-Checksum')
    expect(c1).toMatch(HEX64)
    expect(c1).toBe(c2)
    const b1 = await jsonBody(res1)
    const b2 = await jsonBody(res2)
    expect(b1.countsChecksum).toBe(b2.countsChecksum)
    expect(b1.schemaStamp).toBe(b2.schemaStamp)
  })
})

// ════════════════════════════════════════════════════════════════
// Audit
// ════════════════════════════════════════════════════════════════
describe('R147 portability — audit', () => {
  it("22. audit full 200: DATA_PORTABILITY_EXPORTED / PortabilityExport / 'full:locX' / details counters-only", async () => {
    mocks.findMany.guest.mockResolvedValue([guestRow(), guestRow({ id: 'guest-2' })])
    mocks.findMany.guestVisit.mockResolvedValue([visitRow()])
    const res = await portabilityGET(new Request(portabilityURL(`?locationId=${LOC_X}`)))
    expect(res.status).toBe(200)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0] as Record<string, unknown>
    const details = entry.details as Record<string, unknown>
    expect(entry.action).toBe('DATA_PORTABILITY_EXPORTED')
    expect(entry.entityType).toBe('PortabilityExport')
    expect(entry.entityId).toBe(`full:${LOC_X}`)
    expect(entry.userId).toBe('emp-1')
    expect(entry.locationId).toBe(LOC_X)
    expect(details).toEqual({
      mode: 'full',
      tables: 17,
      sections: 5,
      rows: 3,
      checksum: res.headers.get('X-Portability-Checksum'),
    })
    // counters-only: details brez PII (brez imen/emailov/telefonov)
    const s = JSON.stringify(details)
    expect(s).not.toContain('Novak')
    expect(s).not.toContain('ana@example.com')
    expect(s).not.toContain('+386')
  })

  it("23. audit full global: entityId 'full:global' + locationId null; manifest NE avdita", async () => {
    const fullRes = await portabilityGET(new Request(portabilityURL('')))
    expect(fullRes.status).toBe(200)
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1)
    const entry = mocks.createAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(entry.entityId).toBe('full:global')
    expect(entry.locationId).toBeNull()
    expect((entry.details as Record<string, unknown>).mode).toBe('full')

    mocks.createAuditLog.mockClear()
    const manifestRes = await portabilityGET(new Request(portabilityURL('?mode=manifest')))
    expect(manifestRes.status).toBe(200)
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})
