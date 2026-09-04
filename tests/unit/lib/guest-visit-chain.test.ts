// ============================================
// GUEST VISIT HASH CHAIN — Unit testi (Issue #35)
//
// Preverjamo:
// - createGuestVisitWithChain pravilno ustvari hash chain
// - previousHash se pravilno prenaša med vnosi
// - chainHash je SHA-256(previousHash + employeeName + totalSpent + 'visited' + arrivedAt)
// - verifyGuestVisitChainIntegrity zazna nepoškodovano in prelomljeno verigo
// - Transakcijska varnost — findFirst znotraj $transaction
//
// EU 852/2004: HACCP evidence mora biti tamper-evident.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// vi.hoisted — mock spremenljivke so na voljo v vi.mock factory-jih
const mocks = vi.hoisted(() => {
  const mockFindFirst = vi.fn()
  const mockCreate = vi.fn()
  const mockFindMany = vi.fn()
  const mockTransaction = vi.fn(async (fn: (_tx: unknown) => Promise<unknown>) => {
    return fn({
      guestVisit: {
        findFirst: mockFindFirst,
        create: mockCreate,
      },
    })
  })
  return { mockFindFirst, mockCreate, mockFindMany, mockTransaction }
})

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mocks.mockTransaction,
    guestVisit: {
      findFirst: mocks.mockFindFirst,
      create: mocks.mockCreate,
      findMany: mocks.mockFindMany,
    },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import {
  createGuestVisitWithChain,
  verifyGuestVisitChainIntegrity,
} from '@/lib/guest-visit-chain'

describe('createGuestVisitWithChain — Issue #35', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockFindFirst.mockResolvedValue(null)
    mocks.mockCreate.mockImplementation((args: { data: Record<string, unknown> }) =>
      Promise.resolve(args.data),
    )
  })

  it('prvi vnos: previousHash je prazen, chainHash je pravilen', async () => {
    await createGuestVisitWithChain({
      guestId: 'guest-1',
      partySize: 2,
      totalSpent: 50.0,
      tipAmount: 5.0,
      employeeName: 'Janez',
    })

    expect(mocks.mockCreate).toHaveBeenCalledTimes(1)
    const createCall = mocks.mockCreate.mock.calls[0][0]
    expect(createCall.data.previousHash).toBe('')

    const arrivedAt = createCall.data.arrivedAt as Date
    const expectedPayload = ['', 'Janez', '50.00', 'visited', arrivedAt.toISOString()].join('|')
    const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex')
    expect(createCall.data.chainHash).toBe(expectedHash)
  })

  it('drugi vnos: previousHash = chainHash prvega vnosa', async () => {
    const firstHash = 'aaa111'
    mocks.mockFindFirst.mockResolvedValueOnce({ chainHash: firstHash })

    await createGuestVisitWithChain({
      guestId: 'guest-2',
      partySize: 1,
      totalSpent: 30.0,
      tipAmount: 3.0,
      employeeName: 'Mojca',
    })

    const createCall = mocks.mockCreate.mock.calls[0][0]
    expect(createCall.data.previousHash).toBe(firstHash)

    const arrivedAt = createCall.data.arrivedAt as Date
    const expectedPayload = [firstHash, 'Mojca', '30.00', 'visited', arrivedAt.toISOString()].join('|')
    const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex')
    expect(createCall.data.chainHash).toBe(expectedHash)
  })

  it('Shrani pravilne podatke (partySize, totalSpent, employeeName, ...)', async () => {
    await createGuestVisitWithChain({
      guestId: 'guest-3',
      orderId: 'order-123',
      tableId: 'table-5',
      partySize: 4,
      totalSpent: 120.50,
      tipAmount: 12.05,
      feedbackScore: 5,
      feedbackComment: 'Odlično!',
      employeeId: 'emp-1',
      employeeName: 'Ana',
      departedAt: new Date('2026-08-28T20:00:00Z'),
      durationMinutes: 90,
    })

    const createCall = mocks.mockCreate.mock.calls[0][0]
    expect(createCall.data).toMatchObject({
      guestId: 'guest-3',
      orderId: 'order-123',
      tableId: 'table-5',
      partySize: 4,
      totalSpent: 120.50,
      tipAmount: 12.05,
      feedbackScore: 5,
      feedbackComment: 'Odlično!',
      employeeId: 'emp-1',
      employeeName: 'Ana',
      durationMinutes: 90,
    })
  })

  it('uporablja transakcijo da prepreči race condition', async () => {
    await createGuestVisitWithChain({
      guestId: 'guest-4',
      partySize: 1,
      totalSpent: 10,
      tipAmount: 0,
      employeeName: 'Test',
    })

    expect(mocks.mockTransaction).toHaveBeenCalledTimes(1)
  })

  it('arrivedAt je bil ustvarjen če ni podan', async () => {
    await createGuestVisitWithChain({
      guestId: 'guest-5',
      partySize: 1,
      totalSpent: 10,
      tipAmount: 0,
      employeeName: 'Test',
    })

    const createCall = mocks.mockCreate.mock.calls[0][0]
    expect(createCall.data.arrivedAt).toBeInstanceOf(Date)
    expect(Date.now() - (createCall.data.arrivedAt as Date).getTime()).toBeLessThan(5000)
  })

  it('feedbackScore null → null v bazi', async () => {
    await createGuestVisitWithChain({
      guestId: 'guest-6',
      partySize: 1,
      totalSpent: 10,
      tipAmount: 0,
      employeeName: 'Test',
      feedbackScore: null,
    })

    const createCall = mocks.mockCreate.mock.calls[0][0]
    expect(createCall.data.feedbackScore).toBeNull()
  })
})

describe('verifyGuestVisitChainIntegrity — Issue #35', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vrne null za prazno verigo', async () => {
    mocks.mockFindMany.mockResolvedValue([])
    const result = await verifyGuestVisitChainIntegrity()
    expect(result).toBeNull()
  })

  it('vrne null za nepoškodovano verigo (1 vnos)', async () => {
    const arrivedAt = new Date('2026-08-28T10:00:00Z')
    const expectedPayload = ['', 'Janez', '50', 'visited', arrivedAt.toISOString()].join('|')
    const chainHash = crypto.createHash('sha256').update(expectedPayload).digest('hex')

    mocks.mockFindMany.mockResolvedValue([
      {
        id: 'visit-1',
        employeeName: 'Janez',
        totalSpent: 50,
        arrivedAt,
        previousHash: '',
        chainHash,
      },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).toBeNull()
  })

  it('zazna prelomljeno previousHash (manipuliran)', async () => {
    mocks.mockFindMany.mockResolvedValue([
      {
        id: 'visit-1',
        employeeName: 'Janez',
        totalSpent: 50,
        arrivedAt: new Date('2026-08-28T10:00:00Z'),
        previousHash: 'WRONG',
        chainHash: 'whatever',
      },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).not.toBeNull()
    expect(result?.id).toBe('visit-1')
  })

  it('zazna manipuliran chainHash (vsebina spremenjena)', async () => {
    const arrivedAt = new Date('2026-08-28T10:00:00Z')
    mocks.mockFindMany.mockResolvedValue([
      {
        id: 'visit-1',
        employeeName: 'Janez',
        totalSpent: 50,
        arrivedAt,
        previousHash: '',
        chainHash: 'MANIPULATED_HASH',
      },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).not.toBeNull()
    expect(result?.id).toBe('visit-1')
  })

  it('zazna manipuliran totalSpent (vpliva na chainHash)', async () => {
    const arrivedAt = new Date('2026-08-28T10:00:00Z')
    const originalPayload = ['', 'Janez', '50', 'visited', arrivedAt.toISOString()].join('|')
    const originalHash = crypto.createHash('sha256').update(originalPayload).digest('hex')

    mocks.mockFindMany.mockResolvedValue([
      {
        id: 'visit-1',
        employeeName: 'Janez',
        totalSpent: 999,
        arrivedAt,
        previousHash: '',
        chainHash: originalHash,
      },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).not.toBeNull()
  })

  it('zazna manipuliran employeeName', async () => {
    const arrivedAt = new Date('2026-08-28T10:00:00Z')
    const originalPayload = ['', 'Janez', '50', 'visited', arrivedAt.toISOString()].join('|')
    const originalHash = crypto.createHash('sha256').update(originalPayload).digest('hex')

    mocks.mockFindMany.mockResolvedValue([
      {
        id: 'visit-1',
        employeeName: 'NEZNAN_NAPADALEC',
        totalSpent: 50,
        arrivedAt,
        previousHash: '',
        chainHash: originalHash,
      },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).not.toBeNull()
  })

  it('veljaven za 3-vnosno verigo', async () => {
    const arrivedAt1 = new Date('2026-08-28T10:00:00Z')
    const arrivedAt2 = new Date('2026-08-28T11:00:00Z')
    const arrivedAt3 = new Date('2026-08-28T12:00:00Z')

    const payload1 = ['', 'J', '10', 'visited', arrivedAt1.toISOString()].join('|')
    const hash1 = crypto.createHash('sha256').update(payload1).digest('hex')
    const payload2 = [hash1, 'M', '20', 'visited', arrivedAt2.toISOString()].join('|')
    const hash2 = crypto.createHash('sha256').update(payload2).digest('hex')
    const payload3 = [hash2, 'A', '30', 'visited', arrivedAt3.toISOString()].join('|')
    const hash3 = crypto.createHash('sha256').update(payload3).digest('hex')

    mocks.mockFindMany.mockResolvedValue([
      { id: '1', employeeName: 'J', totalSpent: 10, arrivedAt: arrivedAt1, previousHash: '', chainHash: hash1 },
      { id: '2', employeeName: 'M', totalSpent: 20, arrivedAt: arrivedAt2, previousHash: hash1, chainHash: hash2 },
      { id: '3', employeeName: 'A', totalSpent: 30, arrivedAt: arrivedAt3, previousHash: hash2, chainHash: hash3 },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).toBeNull()
  })

  it('zazna prelom v sredini 3-vnosne verige', async () => {
    const arrivedAt1 = new Date('2026-08-28T10:00:00Z')
    const arrivedAt2 = new Date('2026-08-28T11:00:00Z')
    const arrivedAt3 = new Date('2026-08-28T12:00:00Z')

    const payload1 = ['', 'J', '10', 'visited', arrivedAt1.toISOString()].join('|')
    const hash1 = crypto.createHash('sha256').update(payload1).digest('hex')
    const payload2 = [hash1, 'M', '20', 'visited', arrivedAt2.toISOString()].join('|')
    const hash2 = crypto.createHash('sha256').update(payload2).digest('hex')
    // Vnos 3 ima napačen previousHash (namesto hash2 → hash1)
    const payload3 = [hash1, 'A', '30', 'visited', arrivedAt3.toISOString()].join('|')
    const hash3 = crypto.createHash('sha256').update(payload3).digest('hex')

    mocks.mockFindMany.mockResolvedValue([
      { id: '1', employeeName: 'J', totalSpent: 10, arrivedAt: arrivedAt1, previousHash: '', chainHash: hash1 },
      { id: '2', employeeName: 'M', totalSpent: 20, arrivedAt: arrivedAt2, previousHash: hash1, chainHash: hash2 },
      { id: '3', employeeName: 'A', totalSpent: 30, arrivedAt: arrivedAt3, previousHash: hash1, chainHash: hash3 },
    ])

    const result = await verifyGuestVisitChainIntegrity()
    expect(result).not.toBeNull()
    expect(result?.id).toBe('3')
  })
})
