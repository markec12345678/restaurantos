// ============================================
// Audit Log Hash Chain — Unit testi
// Kritično za PCI DSS + FURS skladnost
// Preverja, da je revizijski dnevnik tamper-evident
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// vi.hoisted — definicije so na voljo v vi.mock factory-jih (ki so hoisted)
const mocks = vi.hoisted(() => {
  const mockFindFirst = vi.fn()
  const mockCreate = vi.fn()
  const mockTransaction = vi.fn(async (fn: (_tx: unknown) => Promise<unknown>) => {
    return fn({
      auditLog: { findFirst: mockFindFirst, create: mockCreate },
    })
  })
  return { mockFindFirst, mockCreate, mockTransaction }
})

// Mock @prisma/client — ko src/lib/db.ts naredi `new PrismaClient()`,
// dobi naš mock z nadzorovanimi findFirst/create
vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    $transaction = mocks.mockTransaction
    $disconnect = vi.fn()
  },
  Prisma: {
    Decimal: class Decimal {
      toNumber() { return 0 }
    },
  },
}))

// Override global mock-a iz tests/setup.ts — uporabi PRAVO implementacijo
// (ki bo uporabila naš mock-ani PrismaClient)
vi.mock('@/lib/db', async (importOriginal) => {
  return await importOriginal<typeof import('@/lib/db')>()
})

// Import PO mock-ih
import { createAuditLog } from '@/lib/db'

describe('createAuditLog — hash chain integriteta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockFindFirst.mockResolvedValue(null) // privzeto: ni prejšnjega vnosa
    mocks.mockCreate.mockImplementation((args: { data: unknown }) => Promise.resolve(args.data))
  })

  it('ustvari vnos z vsemi obveznimi polji', async () => {
    await createAuditLog({
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: 'order-123',
      userId: 'user-456',
      details: { amount: 12.50 },
      ipAddress: '192.168.1.1',
      terminalId: 'POS-001',
    })

    expect(mocks.mockCreate).toHaveBeenCalledTimes(1)
    const call = mocks.mockCreate.mock.calls[0][0]
    expect(call.data).toMatchObject({
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: 'order-123',
      userId: 'user-456',
      details: JSON.stringify({ amount: 12.50 }),
      ipAddress: '192.168.1.1',
      terminalId: 'POS-001',
    })
  })

  it('izračuna chainHash kot SHA-256(previousHash|action|entityType|entityId|userId|details)', async () => {
    mocks.mockFindFirst.mockResolvedValue({ chainHash: 'prev-hash-abc' })

    const entry = {
      action: 'UPDATE_ORDER',
      entityType: 'Order',
      entityId: 'order-789',
      userId: 'user-001',
      details: { status: 'paid' },
    }

    await createAuditLog(entry)

    const call = mocks.mockCreate.mock.calls[0][0]
    const expectedPayload = [
      'prev-hash-abc',
      'UPDATE_ORDER',
      'Order',
      'order-789',
      'user-001',
      JSON.stringify({ status: 'paid' }),
    ].join('|')
    const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex')

    expect(call.data.chainHash).toBe(expectedHash)
    expect(call.data.previousHash).toBe('prev-hash-abc')
  })

  it('uporabi prazen string za previousHash, če ni prejšnjega vnosa', async () => {
    mocks.mockFindFirst.mockResolvedValue(null)

    await createAuditLog({
      action: 'INITIAL_ACTION',
      entityType: 'System',
      details: {},
    })

    const call = mocks.mockCreate.mock.calls[0][0]
    expect(call.data.previousHash).toBe('')
  })

  it('Vključi VSE podatke v hash (prepreči skrivanje manipulacije)', async () => {
    // Prvi entry
    await createAuditLog({
      action: 'DELETE_USER',
      entityType: 'User',
      entityId: 'user-A',
      userId: 'admin',
      details: { reason: 'left company' },
    })
    const hash1 = mocks.mockCreate.mock.calls[0][0].data.chainHash

    // Reset in drugi entry — drugačen entityId
    vi.clearAllMocks()
    mocks.mockFindFirst.mockResolvedValue(null)
    await createAuditLog({
      action: 'DELETE_USER',
      entityType: 'User',
      entityId: 'user-B',  // drugačen!
      userId: 'admin',
      details: { reason: 'left company' },
    })
    const hash2 = mocks.mockCreate.mock.calls[0][0].data.chainHash

    // Hash-a se morata razlikovati
    expect(hash1).not.toBe(hash2)
  })

  it('sprememba v details spremeni chainHash', async () => {
    await createAuditLog({
      action: 'PAYMENT',
      entityType: 'Payment',
      entityId: 'pay-1',
      details: { amount: 10.00 },
    })
    const hash1 = mocks.mockCreate.mock.calls[0][0].data.chainHash

    vi.clearAllMocks()
    mocks.mockFindFirst.mockResolvedValue(null)
    await createAuditLog({
      action: 'PAYMENT',
      entityType: 'Payment',
      entityId: 'pay-1',
      details: { amount: 10.01 },  // sprememba za 1 cent!
    })
    const hash2 = mocks.mockCreate.mock.calls[0][0].data.chainHash

    expect(hash1).not.toBe(hash2)
  })

  it('default-a manjkajoča polja: userId=null, entityId=null, ipAddress="", terminalId=null', async () => {
    await createAuditLog({
      action: 'ANONYMOUS',
      entityType: 'System',
      // manjkajo: entityId, userId, ipAddress, terminalId
    })

    const call = mocks.mockCreate.mock.calls[0][0]
    expect(call.data.userId).toBeNull()
    expect(call.data.entityId).toBeNull()
    expect(call.data.ipAddress).toBe('')
    expect(call.data.terminalId).toBeNull()
  })

  it('serializira details kot JSON string', async () => {
    const complexDetails = {
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
      boolean: true,
      null: null,
    }

    await createAuditLog({
      action: 'COMPLEX',
      entityType: 'Test',
      details: complexDetails,
    })

    const call = mocks.mockCreate.mock.calls[0][0]
    expect(call.data.details).toBe(JSON.stringify(complexDetails))
    // Preveri, da je res parsable JSON
    expect(JSON.parse(call.data.details)).toEqual(complexDetails)
  })

  it('NE vrže napake, če $transaction pade (audit log ne sme zlomiti aplikacije)', async () => {
    mocks.mockTransaction.mockRejectedValueOnce(new Error('DB connection lost'))

    // Ne smemo dobiti napake
    await expect(
      createAuditLog({
        action: 'FAIL_TEST',
        entityType: 'Test',
        details: {},
      })
    ).resolves.toBeUndefined()
  })

  it('ne vrže napake, če findFirst vrže (npr. baza nedosegljiva)', async () => {
    mocks.mockFindFirst.mockRejectedValueOnce(new Error('Connection lost'))

    await expect(
      createAuditLog({
        action: 'FAIL_FINDFIRST',
        entityType: 'Test',
        details: {},
      })
    ).resolves.toBeUndefined()

    expect(mocks.mockCreate).not.toHaveBeenCalled()
  })

  it('hash chain je determinističen — isti podatki + isti previousHash = isti chainHash', async () => {
    mocks.mockFindFirst.mockResolvedValue({ chainHash: 'fixed-prev-hash' })

    await createAuditLog({
      action: 'DETERMINISTIC',
      entityType: 'Test',
      entityId: 'X',
      userId: 'U',
      details: { v: 1 },
    })
    const hash1 = mocks.mockCreate.mock.calls[0][0].data.chainHash

    vi.clearAllMocks()
    mocks.mockFindFirst.mockResolvedValue({ chainHash: 'fixed-prev-hash' })
    mocks.mockCreate.mockImplementation((args: { data: unknown }) => Promise.resolve(args.data))
    await createAuditLog({
      action: 'DETERMINISTIC',
      entityType: 'Test',
      entityId: 'X',
      userId: 'U',
      details: { v: 1 },
    })
    const hash2 = mocks.mockCreate.mock.calls[0][0].data.chainHash

    expect(hash1).toBe(hash2)
  })

  it('uporabi pravilen orderBy: timestamp desc (najnovejši najprej)', async () => {
    await createAuditLog({
      action: 'ORDERBY_TEST',
      entityType: 'Test',
      details: {},
    })

    expect(mocks.mockFindFirst).toHaveBeenCalledWith({
      orderBy: { timestamp: 'desc' },
      select: { chainHash: true },
    })
  })
})
