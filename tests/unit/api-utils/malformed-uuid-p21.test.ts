// ============================================
// P1-21 #6 (route-level): MALFORMED UUID
// ============================================
// GET /api/orders/[id]?id=not-a-uuid → Prisma vrže PrismaClientValidationError
// → handleApiError (P1-21 popravek) preslika v 400 INVALID_PARAMETER.
// Prej: 500 INTERNAL_ERROR + stack v dev načinu.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mocks.orderFindFirst, findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// Avtentikacija: vedno veljaven admin (test ni o auth — glej test-matrix-p21 #1-5)
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(async () => ({
    session: {
      token: 'hashed',
      employeeId: 'emp-p21',
      role: 'admin',
      permissions: ['admin'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      absoluteExpiry: Date.now() + 3_600_000,
      locationId: 'loc-p21',
      sessionVersion: 0,
    },
    error: null,
  })),
}))

import { GET } from '@/app/api/orders/[id]/route'

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'log').mockImplementation(() => {})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('P1-21 #6 (route): GET /api/orders/[id] z malformed UUID → 400', () => {
  it('"not-a-uuid" → 400 INVALID_PARAMETER (ne 500 z internals)', async () => {
    // Prisma v produkciji vrže to napako OB malformed UUID where clause
    mocks.orderFindFirst.mockRejectedValue(
      new Prisma.PrismaClientValidationError(
        'Argument `where`: Provided String `not-a-uuid` at position 1 is not a valid UUID',
        { clientVersion: '5.22.0' }
      )
    )

    const req = new Request('http://localhost:3000/api/orders/not-a-uuid')
    const res = await GET(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_PARAMETER')
    expect(body.requestId).toBeTruthy()
    // Prisma internals se ne smejo razkriti
    expect(JSON.stringify(body)).not.toContain('not-a-uuid')
    // where je bil klican z lokalno scope-ano poizvedbo (multi-tenant)
    expect(mocks.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'not-a-uuid', locationId: 'loc-p21' }),
      })
    )
  })

  it('veljaven UUID + najden order → 200 (regresija na srečno pot)', async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: '01234567-89ab-cdef-0123-456789abcdef',
      status: 'open',
      table: null,
      orderItems: [],
    })
    const req = new Request('http://localhost:3000/api/orders/01234567-89ab-cdef-0123-456789abcdef')
    const res = await GET(req, { params: Promise.resolve({ id: '01234567-89ab-cdef-0123-456789abcdef' }) })
    expect(res.status).toBe(200)
  })

  it('veljaven UUID, neobstoječ order → 404 (IDOR-safe sporočilo)', async () => {
    mocks.orderFindFirst.mockResolvedValue(null)
    const req = new Request('http://localhost:3000/api/orders/01234567-89ab-cdef-0123-456789abcdef')
    const res = await GET(req, { params: Promise.resolve({ id: '01234567-89ab-cdef-0123-456789abcdef' }) })
    expect(res.status).toBe(404)
  })
})
