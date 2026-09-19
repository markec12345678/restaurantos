// ============================================
// BUG-HUNT R79: WEBAUTHN CREDENTIALS — TENANT SCOPE
//
// Regresijski testi za fail-open IDOR v webauthn credentials rutah:
//   - GET  /api/auth/webauthn/credentials?employeeId= → location-bound
//     upravljavec je lahko enumeriral poverilnice VSEH tenantov
//   - DELETE /api/auth/webauthn/credentials/[id] → `if (isAdmin && session.locationId)`
//     je upravljavcu BREZ session.locationId (Employee.locationId nullable)
//     popolnoma preskočil owner-location check
//
// Konvencija (resolveTenantLocationId): role admin + locationId=null = super-admin
// (globalni dostop); upravljavec brez lokacije = fail-closed 403.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

// --- Mock setup ---

const mockCredentialFindUnique = vi.fn()
const mockEmployeeFindUnique = vi.fn()
const mockListCredentials = vi.fn()
const mockDeleteCredential = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    biometricCredential: {
      findUnique: mockCredentialFindUnique,
    },
    employee: {
      findUnique: mockEmployeeFindUnique,
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/webauthn/db-helpers', () => ({
  listEmployeeCredentials: mockListCredentials,
  deleteCredential: mockDeleteCredential,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mockRequireAuth,
}))

// --- Fixture-i ---

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'
const MgrA = 'emp-manager-a'

interface TestSession {
  employeeId: string
  role: string
  permissions: string[]
  locationId: string | null
}

function session(overrides: Partial<TestSession>): TestSession {
  return {
    employeeId: MgrA,
    role: 'manager',
    permissions: ['manage_employees'],
    locationId: LOC_A,
    ...overrides,
  }
}

function makeGetReq(employeeId?: string): Request {
  const url = employeeId
    ? `http://localhost/api/auth/webauthn/credentials?employeeId=${employeeId}`
    : 'http://localhost/api/auth/webauthn/credentials'
  return new Request(url, { method: 'GET' })
}

function makeDeleteReq(rowId: string): Request {
  return new Request(`http://localhost/api/auth/webauthn/credentials/${rowId}`, {
    method: 'DELETE',
  })
}

const credentialRow = {
  credentialId: 'cred-xyz',
  employeeId: 'emp-target',
  nickname: 'Tablica 1',
}

const credentialListRow = {
  id: 'row-1',
  credentialId: 'cred-xyz',
  deviceType: 'singleDevice',
  backed: false,
  nickname: 'Tablica 1',
  lastUsedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
}

// --- DELETE /api/auth/webauthn/credentials/[id] ---

describe('DELETE /api/auth/webauthn/credentials/[id] — tenant scope', () => {
  let DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<NextResponse>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ DELETE } = await import('@/app/api/auth/webauthn/credentials/[id]/route'))
    mockCredentialFindUnique.mockResolvedValue(credentialRow)
    mockDeleteCredential.mockResolvedValue(true)
  })

  it('upravljavec iste lokacije SME izbrisati poverilnico kolega', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({}), error: null })
    mockEmployeeFindUnique.mockResolvedValue({ locationId: LOC_A })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(200)
    expect(mockDeleteCredential).toHaveBeenCalledWith('cred-xyz', 'emp-target')
  })

  it('upravljavec TUJE lokacije NE SME izbrisati poverilnice (403)', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({}), error: null })
    mockEmployeeFindUnique.mockResolvedValue({ locationId: LOC_B })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(403)
    expect(mockDeleteCredential).not.toHaveBeenCalled()
  })

  it('REGRESIJA R79: upravljavec BREZ session.locationId → fail-closed 403 (prej fail-open)', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({ locationId: null }), error: null })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(403)
    // Owner lookup se sploh ne sme zgoditi (fail-closed pred DB query)
    expect(mockEmployeeFindUnique).not.toHaveBeenCalled()
    expect(mockDeleteCredential).not.toHaveBeenCalled()
  })

  it('super-admin (role admin, locationId=null) SME izbrisati prek tenantov', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({ role: 'admin', locationId: null }), error: null })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(200)
    expect(mockDeleteCredential).toHaveBeenCalledWith('cred-xyz', 'emp-target')
  })

  it('role admin Z lokacijo → samo lastna lokacija (403 za tujca)', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({ role: 'admin' }), error: null })
    mockEmployeeFindUnique.mockResolvedValue({ locationId: LOC_B })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(403)
    expect(mockDeleteCredential).not.toHaveBeenCalled()
  })

  it('navaden uporabnik SME izbrisati LASTNO poverilnico', async () => {
    mockRequireAuth.mockResolvedValue({
      session: session({ role: 'staff', permissions: [], employeeId: 'emp-target', locationId: LOC_A }),
      error: null,
    })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(200)
    expect(mockDeleteCredential).toHaveBeenCalled()
  })

  it('navaden uporabnik NE SME izbrisati TUJE poverilnice (403)', async () => {
    mockRequireAuth.mockResolvedValue({
      session: session({ role: 'staff', permissions: [] }),
      error: null,
    })

    const res = await DELETE(makeDeleteReq('row-1'), { params: Promise.resolve({ id: 'row-1' }) })
    expect(res.status).toBe(403)
    expect(mockDeleteCredential).not.toHaveBeenCalled()
  })

  it('neobstoječa poverilnica → 404', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({}), error: null })
    mockCredentialFindUnique.mockResolvedValue(null)

    const res = await DELETE(makeDeleteReq('row-404'), { params: Promise.resolve({ id: 'row-404' }) })
    expect(res.status).toBe(404)
  })
})

// --- GET /api/auth/webauthn/credentials ---

describe('GET /api/auth/webauthn/credentials — tenant scope', () => {
  let GET: (req: Request) => Promise<NextResponse>

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ GET } = await import('@/app/api/auth/webauthn/credentials/route'))
    mockListCredentials.mockResolvedValue([credentialListRow])
  })

  it('upravljavec sme pregledati poverilnice kolega ISTE lokacije', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({}), error: null })
    mockEmployeeFindUnique.mockResolvedValue({ locationId: LOC_A })

    const res = await GET(makeGetReq('emp-target'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.employeeId).toBe('emp-target')
    expect(mockListCredentials).toHaveBeenCalledWith('emp-target')
  })

  it('REGRESIJA R79: upravljavec TUJE lokacije → 403 (prej IDOR enumeracija)', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({}), error: null })
    mockEmployeeFindUnique.mockResolvedValue({ locationId: LOC_B })

    const res = await GET(makeGetReq('emp-target-b'))
    expect(res.status).toBe(403)
    expect(mockListCredentials).not.toHaveBeenCalled()
  })

  it('REGRESIJA R79: upravljavec BREZ session.locationId → fail-closed 403', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({ locationId: null }), error: null })

    const res = await GET(makeGetReq('emp-target'))
    expect(res.status).toBe(403)
    expect(mockEmployeeFindUnique).not.toHaveBeenCalled()
    expect(mockListCredentials).not.toHaveBeenCalled()
  })

  it('super-admin (role admin, locationId=null) sme pregledati prek tenantov', async () => {
    mockRequireAuth.mockResolvedValue({ session: session({ role: 'admin', locationId: null }), error: null })

    const res = await GET(makeGetReq('emp-any-tenant'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.employeeId).toBe('emp-any-tenant')
    expect(mockListCredentials).toHaveBeenCalledWith('emp-any-tenant')
  })

  it('navaden uporabnik brez ?employeeId → lastne poverilnice', async () => {
    mockRequireAuth.mockResolvedValue({
      session: session({ role: 'staff', permissions: [] }),
      error: null,
    })

    const res = await GET(makeGetReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.employeeId).toBe(MgrA)
    expect(mockListCredentials).toHaveBeenCalledWith(MgrA)
  })

  it('navaden uporabnik s tujim ?employeeId → 403', async () => {
    mockRequireAuth.mockResolvedValue({
      session: session({ role: 'staff', permissions: [] }),
      error: null,
    })

    const res = await GET(makeGetReq('emp-other'))
    expect(res.status).toBe(403)
    expect(mockListCredentials).not.toHaveBeenCalled()
  })
})
