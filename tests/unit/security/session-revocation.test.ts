// ============================================
// P1-11: SESSION VERSIONING + REVOKACIJA — unit testi
// ============================================
// Preverjamo:
// - verifyToken: sessionVersion mismatch (PIN/vloga/status/dovoljenja
//   spremenjeni po prijavi) → seja NI veljavna
// - verifyToken: version match → seja veljavna
// - revokeEmployeeSessions: briše DB seje + poviša Employee.sessionVersion
// - createSession: zapiše trenutno sessionVersion zaposlenega
// - Employee ne obstaja → seja neveljavna (fail-closed)
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
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

const getMocks = async () => {
  const { db } = (await import('@/lib/db')) as unknown as {
    db: {
      session: { create: MockFn; findUnique: MockFn; deleteMany: MockFn }
      employee: { findUnique: MockFn; update: MockFn }
    }
  }
  return db
}

const now = Date.now()

function dbSessionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token: sha256('p'.repeat(64)),
    employeeId: 'emp-1',
    role: 'waiter',
    permissions: '["take_orders"]',
    sessionVersion: 0,
    createdAt: new Date(now - 1000),
    expiresAt: new Date(now + 60 * 60 * 1000),
    absoluteExpiry: new Date(now + 24 * 60 * 60 * 1000),
    ...overrides,
  }
}

describe('P1-11: sessionVersion mismatch → revokacija', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('verifyToken zavrne sejo s STARO verzijo (PIN/vloga spremenjena po prijavi)', async () => {
    const db = await getMocks()
    // Seja je bila ustvarjena z verzijo 0; admin je medtem povišal na 1
    db.session.findUnique.mockResolvedValue(dbSessionRow({ sessionVersion: 0 }))
    db.employee.findUnique.mockResolvedValue({
      status: 'active',
      locationId: 'loc-1',
      sessionVersion: 1, // povišana (PIN/role/status sprememba)
    })

    const { verifyToken } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const session = await verifyToken('p'.repeat(64))

    expect(session).toBeNull()
    // Seja se tudi pobriše iz DB (ne samo zavrne)
    expect(db.session.deleteMany).toHaveBeenCalled()
  })

  it('verifyToken sprejme sejo z UJEMAJOČO verzijo', async () => {
    const db = await getMocks()
    db.session.findUnique.mockResolvedValue(dbSessionRow({ sessionVersion: 2 }))
    db.employee.findUnique.mockResolvedValue({
      status: 'active',
      locationId: 'loc-1',
      sessionVersion: 2,
    })

    const { verifyToken } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const session = await verifyToken('p'.repeat(64))

    expect(session).not.toBeNull()
    expect(session?.employeeId).toBe('emp-1')
    expect(session?.sessionVersion).toBe(2)
  })

  it('verifyToken: employee izbrisan (not_found) → seja neveljavna', async () => {
    const db = await getMocks()
    db.session.findUnique.mockResolvedValue(dbSessionRow())
    db.employee.findUnique.mockResolvedValue(null) // zaposleni izbrisan

    const { verifyToken } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    expect(await verifyToken('p'.repeat(64))).toBeNull()
    expect(db.session.deleteMany).toHaveBeenCalled()
  })

  it('revokeEmployeeSessions: briše VSE seje + poviša sessionVersion', async () => {
    const db = await getMocks()
    db.session.deleteMany.mockResolvedValue({ count: 3 })
    db.employee.update.mockResolvedValue({ sessionVersion: 1 })

    const { revokeEmployeeSessions } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const count = await revokeEmployeeSessions('emp-9', 'pin-changed')

    expect(count).toBeGreaterThanOrEqual(3)
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-9' } })
    expect(db.employee.update).toHaveBeenCalledWith({
      where: { id: 'emp-9' },
      data: { sessionVersion: { increment: 1 } },
    })
  })

  it('createSession: prebere in zapiše trenutno Employee.sessionVersion', async () => {
    const db = await getMocks()
    db.employee.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (args.where.id === 'emp-5') {
        return { status: 'active', locationId: 'loc-1', sessionVersion: 7 }
      }
      return null
    })

    const { createSession } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    const token = await createSession({ id: 'emp-5', role: 'staff', permissions: [] })

    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(db.session.create).toHaveBeenCalledTimes(1)
    const stored = db.session.create.mock.calls[0][0].data
    expect(stored.sessionVersion).toBe(7)
    expect(stored.token).toBe(sha256(token))
  })

  it('createSession: employee brez verzije → default 0 (backward compat)', async () => {
    const db = await getMocks()
    db.employee.findUnique.mockResolvedValue(null) // query fail → default 0

    const { createSession } = await import(
      '@/lib/auth-middleware/session-store/session-lifecycle'
    )
    await createSession({ id: 'emp-x', role: 'staff', permissions: [] })

    const stored = db.session.create.mock.calls[0][0].data
    expect(stored.sessionVersion).toBe(0)
  })
})
