// ============================================
// FIX SECURITY: SESSION TOKEN HASHING — regresijski testi
// ============================================
// Grožnja: dump baze (SQL injection / ukraden backup / exfiltracija)
// ne sme razkriti uporabnih Bearer tokenov.
//
// Zagotovljeno:
//  1. DB Session.token vsebuje IZKLJUČNO sha256(token) — nikoli plain
//  2. verifyToken išče po hashu (plain iskanje ne obstaja)
//  3. Stare plain-text seje (pred popravkom) niso več veljavne
//  4. destroySession / evikcija brišejo po hashu
//  5. Pomnilniška hitra pot je prav tako hash-ključana
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'

const sha256 = (t: string) =>
  crypto.createHash('sha256').update(t, 'utf8').digest('hex')

type MockFn = ReturnType<typeof vi.fn>

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    employee: {
      findUnique: vi.fn().mockResolvedValue({ status: 'active' }),
    },
  },
}))

const getMocks = async () => {
  const { db } = (await import('@/lib/db')) as unknown as {
    db: {
      session: { create: MockFn; findUnique: MockFn; deleteMany: MockFn }
      employee: { findUnique: MockFn }
    }
  }
  return db
}

describe('FIX SECURITY: session token hashing', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('hashSessionToken: determinističen, 64 hex znakov, različen od vhoda', async () => {
    const { hashSessionToken } = await import(
      '@/lib/auth-middleware/session-store/token-hash'
    )
    const token = 'a'.repeat(64)
    const h1 = hashSessionToken(token)
    const h2 = hashSessionToken(token)
    expect(h1).toBe(h2) // determinističen (enak token → enak hash)
    expect(h1).toMatch(/^[a-f0-9]{64}$/) // 64 hex — isti format kot DB stolpec
    expect(h1).not.toBe(token) // NI plain token
    expect(hashSessionToken('b'.repeat(64))).not.toBe(h1) // različni vhodi → različni izhodi
  })

  it('createSession: DB dobi SHA-256 hash, klient pa plain token', async () => {
    const { createSession } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const token = await createSession(
      { id: 'emp-1', role: 'waiter', permissions: ['take_orders'], locationId: 'loc-1' },
      '1.2.3.4',
      'test-agent',
    )
    const db = await getMocks()

    // Klient dobi veljaven plain Bearer token (nespremenjeno vedenje)
    expect(token).toMatch(/^[a-f0-9]{64}$/)

    // DB pa prejme IZKLJUČNO hash
    expect(db.session.create).toHaveBeenCalledTimes(1)
    const stored = db.session.create.mock.calls[0][0].data.token
    expect(stored).toBe(sha256(token))
    expect(stored).not.toBe(token)
    expect(stored).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifyToken: DB lookup po hashu — plain token se NE shrani/iská', async () => {
    const { verifyToken } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const db = await getMocks()

    const plain = 'c'.repeat(64)
    const row = {
      token: sha256(plain),
      employeeId: 'emp-1',
      role: 'manager',
      permissions: '["take_orders"]',
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiry: new Date(Date.now() + 3_600_000),
    }
    db.session.findUnique.mockResolvedValueOnce(row)

    const session = await verifyToken(plain)

    expect(db.session.findUnique).toHaveBeenCalledWith({
      where: { token: sha256(plain) },
    })
    expect(session).not.toBeNull()
    expect(session?.employeeId).toBe('emp-1')
    expect(session?.role).toBe('manager')
  })

  it('verifyToken: plain-text seja iz prejšnje sheme NI veljavna (rotacija formata)', async () => {
    const { verifyToken } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const db = await getMocks()

    // Stara vrstica: token shranjen kot plain text (prejšnja shema)
    const legacyPlain = 'd'.repeat(64)
    db.session.findUnique.mockImplementationOnce(async (args: { where: { token: string } }) => {
      // Simuliraj: hash iskanje zgreši (DB ima samo plain vrstico)
      return args.where.token === legacyPlain ? { token: legacyPlain } : null
    })

    const session = await verifyToken(legacyPlain)
    // Lookup po hashu ne najde plain vrstice → seja zavrnjena → ponovna prijava
    expect(session).toBeNull()
  })

  it('verifyToken: pomnilniška hitra pot — ključana po hashu, brez DB klica', async () => {
    const { createSession, verifyToken } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const token = await createSession(
      { id: 'emp-2', role: 'admin', permissions: [] },
      undefined,
      undefined,
    )
    const db = await getMocks()
    db.session.findUnique.mockClear()

    const session = await verifyToken(token)
    expect(session).not.toBeNull()
    expect(session?.employeeId).toBe('emp-2')
    expect(db.session.findUnique).not.toHaveBeenCalled() // zadetek v pomnilniku
  })

  it('destroySession: DB brisanje po hashu, ne po plain tokenu', async () => {
    const { destroySession } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const db = await getMocks()

    const plain = 'e'.repeat(64)
    destroySession(plain)

    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { token: sha256(plain) },
    })
    expect(JSON.stringify(db.session.deleteMany.mock.calls)).not.toContain(plain)
  })

  it('zaščita end-to-end: dump vseh DB tokenov ne vsebuje NOBENEGA plain tokena', async () => {
    const { createSession } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const db = await getMocks()

    const issued: string[] = []
    for (let i = 0; i < 5; i++) {
      issued.push(
        await createSession({ id: `emp-${i}`, role: 'staff', permissions: [] }),
      )
    }

    // Pridobi vse tokene, ki bi jih napadalec videl v DB dumpu
    const dumpedTokens = db.session.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { token: string } }).data.token,
    )
    expect(dumpedTokens).toHaveLength(5)
    const issuedHashes = issued.map(sha256)
    for (const t of dumpedTokens) {
      expect(t).toMatch(/^[a-f0-9]{64}$/)
      expect(issued).not.toContain(t) // noben izdani token ni v dumpu
      expect(issuedHashes).toContain(t) // vsak dump je točno hash NEKATEREGA izdanega
    }
  })
})
