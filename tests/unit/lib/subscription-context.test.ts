// ============================================
// SUBSCRIPTION CONTEXT — Unit testi (Issue #32)
//
// Preverjamo:
// - getSubscriptionContext: vrne subscription iz DB + session
// - canAccessLocation: preveri lastništvo lokacije
// - getLocationIdsForSubscription: vrne IDs lokacij za subscription
// - Single-tenant fallback (brez subscription)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockSubscriptionFindFirst = vi.fn()
  const mockLocationFindUnique = vi.fn()
  const mockLocationFindMany = vi.fn()
  const mockRequireAuth = vi.fn()
  return {
    mockSubscriptionFindFirst,
    mockLocationFindUnique,
    mockLocationFindMany,
    mockRequireAuth,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    subscription: { findFirst: mocks.mockSubscriptionFindFirst },
    location: {
      findUnique: mocks.mockLocationFindUnique,
      findMany: mocks.mockLocationFindMany,
    },
  },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.mockRequireAuth,
}))

import {
  getSubscriptionContext,
  canAccessLocation,
  getLocationIdsForSubscription,
  type SubscriptionContext,
} from '@/lib/subscription-context'

// Helper za Session type
const mockSession = {
  employeeId: 'emp-1',
  role: 'admin',
  permissions: ['admin'],
} as const

describe('getSubscriptionContext — Issue #32', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockRequireAuth.mockResolvedValue({
      session: mockSession,
      error: null,
    })
  })

  it('vrne subscription kontekst ko je subscription aktiven', async () => {
    mocks.mockSubscriptionFindFirst.mockResolvedValue({ id: 'sub-123' })

    const ctx = await getSubscriptionContext(new Request('http://localhost/api/test'))

    expect(ctx.error).toBeNull()
    expect(ctx.subscriptionId).toBe('sub-123')
    expect(ctx.isMultiTenant).toBe(true)
    expect(ctx.locationFilter()).toEqual({ subscriptionId: 'sub-123' })
  })

  it('single-tenant: brez subscription → isMultiTenant false', async () => {
    mocks.mockSubscriptionFindFirst.mockResolvedValue(null)

    const ctx = await getSubscriptionContext(new Request('http://localhost/api/test'))

    expect(ctx.error).toBeNull()
    expect(ctx.subscriptionId).toBeNull()
    expect(ctx.isMultiTenant).toBe(false)
    expect(ctx.locationFilter()).toEqual({}) // prazen filter
  })

  it('vrne error ko requireAuth zavrne', async () => {
    mocks.mockRequireAuth.mockResolvedValue({
      session: null,
      error: new Response('Unauthorized', { status: 401 }),
    })

    const ctx = await getSubscriptionContext(new Request('http://localhost/api/test'))

    expect(ctx.error).not.toBeNull()
    expect(ctx.session).toBeNull()
    expect(ctx.subscriptionId).toBeNull()
  })

  it('session se pravilno propagira', async () => {
    mocks.mockSubscriptionFindFirst.mockResolvedValue({ id: 'sub-x' })

    const ctx = await getSubscriptionContext(new Request('http://localhost/api/test'))

    expect(ctx.session).toEqual(mockSession)
  })

  it('podpira options.permission (delegira na requireAuth)', async () => {
    mocks.mockSubscriptionFindFirst.mockResolvedValue({ id: 'sub-perm' })

    const ctx = await getSubscriptionContext(
      new Request('http://localhost/api/test'),
      { permission: 'admin' } as never,
    )

    expect(ctx.error).toBeNull()
    expect(mocks.mockRequireAuth).toHaveBeenCalledWith(
      expect.anything(),
      { permission: 'admin' },
    )
  })
})

describe('canAccessLocation — Issue #32', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('single-tenant: dovoli vse lokacije', async () => {
    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: null,
      isMultiTenant: false,
      locationFilter: () => ({}),
      error: null,
    }

    const result = await canAccessLocation(ctx, 'any-location-id')
    expect(result).toBe(true)
    // Ne sme poizvedovati po bazi
    expect(mocks.mockLocationFindUnique).not.toHaveBeenCalled()
  })

  it('multi-tenant: dovoli lokacijo iz iste subscription', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue({ subscriptionId: 'sub-mine' })

    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: 'sub-mine',
      isMultiTenant: true,
      locationFilter: () => ({ subscriptionId: 'sub-mine' }),
      error: null,
    }

    const result = await canAccessLocation(ctx, 'loc-1')
    expect(result).toBe(true)
  })

  it('multi-tenant: zavrne lokacijo iz druge subscription', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue({ subscriptionId: 'sub-other' })

    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: 'sub-mine',
      isMultiTenant: true,
      locationFilter: () => ({ subscriptionId: 'sub-mine' }),
      error: null,
    }

    const result = await canAccessLocation(ctx, 'loc-foreign')
    expect(result).toBe(false)
  })

  it('multi-tenant: zavrne neobstoječo lokacijo', async () => {
    mocks.mockLocationFindUnique.mockResolvedValue(null)

    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: 'sub-mine',
      isMultiTenant: true,
      locationFilter: () => ({ subscriptionId: 'sub-mine' }),
      error: null,
    }

    const result = await canAccessLocation(ctx, 'loc-nonexistent')
    expect(result).toBe(false)
  })
})

describe('getLocationIdsForSubscription — Issue #32', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('single-tenant: vrne undefined (brez filtra)', async () => {
    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: null,
      isMultiTenant: false,
      locationFilter: () => ({}),
      error: null,
    }

    const result = await getLocationIdsForSubscription(ctx)
    expect(result).toBeUndefined()
    expect(mocks.mockLocationFindMany).not.toHaveBeenCalled()
  })

  it('multi-tenant: vrne IDs lokacij za subscription', async () => {
    mocks.mockLocationFindMany.mockResolvedValue([
      { id: 'loc-a' },
      { id: 'loc-b' },
      { id: 'loc-c' },
    ])

    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: 'sub-mine',
      isMultiTenant: true,
      locationFilter: () => ({ subscriptionId: 'sub-mine' }),
      error: null,
    }

    const result = await getLocationIdsForSubscription(ctx)
    expect(result).toEqual(['loc-a', 'loc-b', 'loc-c'])
    expect(mocks.mockLocationFindMany).toHaveBeenCalledWith({
      where: { subscriptionId: 'sub-mine' },
      select: { id: true },
    })
  })

  it('multi-tenant: prazna subscription (brez lokacij) → prazna tabela', async () => {
    mocks.mockLocationFindMany.mockResolvedValue([])

    const ctx: SubscriptionContext = {
      session: mockSession as never,
      subscriptionId: 'sub-empty',
      isMultiTenant: true,
      locationFilter: () => ({ subscriptionId: 'sub-empty' }),
      error: null,
    }

    const result = await getLocationIdsForSubscription(ctx)
    expect(result).toEqual([])
  })
})
