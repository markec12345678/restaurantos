// ============================================
// EMPLOYEE REF RESOLVER — Unit testi (Issue #43)
//
// Preverjamo:
// - resolveEmployeeRef: prepozna employeeId, email, PIN, ime
// - syncEmployeeRef: sinhronizira soft ref + FK
// - getEmployeeRefStats: migracijski dashboard števec
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockEmployeeFindUnique = vi.fn()
  const mockOrderCount = vi.fn()
  const mockStaffShiftCount = vi.fn()
  const mockPurchaseOrderCount = vi.fn()
  const mockJournalEntryCount = vi.fn()
  return {
    mockEmployeeFindUnique,
    mockOrderCount,
    mockStaffShiftCount,
    mockPurchaseOrderCount,
    mockJournalEntryCount,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    employee: { findUnique: mocks.mockEmployeeFindUnique },
    order: { count: mocks.mockOrderCount },
    staffShift: { count: mocks.mockStaffShiftCount },
    purchaseOrder: { count: mocks.mockPurchaseOrderCount },
    journalEntry: { count: mocks.mockJournalEntryCount },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import {
  resolveEmployeeRef,
  syncEmployeeRef,
  getEmployeeRefStats,
} from '@/lib/auth-middleware/employee-ref-resolver'

describe('resolveEmployeeRef — Issue #43', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prazen/null/undefined → null employeeId', async () => {
    expect(await resolveEmployeeRef('')).toEqual({ employeeId: null, isValid: false, employeeName: null })
    expect(await resolveEmployeeRef(null)).toEqual({ employeeId: null, isValid: false, employeeName: null })
    expect(await resolveEmployeeRef(undefined)).toEqual({ employeeId: null, isValid: false, employeeName: null })
    expect(await resolveEmployeeRef('   ')).toEqual({ employeeId: null, isValid: false, employeeName: null })
  })

  it('employeeId (cuid) → veljaven FK', async () => {
    mocks.mockEmployeeFindUnique.mockResolvedValueOnce({ id: 'emp-1', name: 'Janez Novak' })

    const result = await resolveEmployeeRef('emp-1')

    expect(result).toEqual({
      employeeId: 'emp-1',
      isValid: true,
      employeeName: 'Janez Novak',
    })
    expect(mocks.mockEmployeeFindUnique).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      select: { id: true, name: true },
    })
  })

  it('email → veljaven FK (fallback)', async () => {
    mocks.mockEmployeeFindUnique
      .mockResolvedValueOnce(null) // by id
      .mockResolvedValueOnce({ id: 'emp-2', name: 'Mojca Horvat' }) // by email

    const result = await resolveEmployeeRef('mojca@example.com')

    expect(result).toEqual({
      employeeId: 'emp-2',
      isValid: true,
      employeeName: 'Mojca Horvat',
    })
  })

  it('PIN (4-6 števke) → veljaven FK (fallback)', async () => {
    mocks.mockEmployeeFindUnique
      .mockResolvedValueOnce(null) // by id
      .mockResolvedValueOnce(null) // by email
      .mockResolvedValueOnce({ id: 'emp-3', name: 'Ana Kovač' }) // by pin

    const result = await resolveEmployeeRef('1234')

    expect(result).toEqual({
      employeeId: 'emp-3',
      isValid: true,
      employeeName: 'Ana Kovač',
    })
  })

  it('samo ime (ne employeeId/email/PIN) → null FK, isValid=false', async () => {
    mocks.mockEmployeeFindUnique.mockResolvedValue(null)

    const result = await resolveEmployeeRef('Janez Novak')

    expect(result).toEqual({
      employeeId: null,
      isValid: false,
      employeeName: 'Janez Novak', // ohrani ime za prikaz
    })
  })

  it('neveljaven PIN (prekratko) → ne poskusi PIN lookup', async () => {
    mocks.mockEmployeeFindUnique
      .mockResolvedValueOnce(null) // by id
      .mockResolvedValueOnce(null) // by email
    // Pin lookup se NE kliče (ker 123 ni 4-6 števke)

    const result = await resolveEmployeeRef('123')

    expect(result.isValid).toBe(false)
    // Samo 2 klica (id + email), ne 3
    expect(mocks.mockEmployeeFindUnique).toHaveBeenCalledTimes(2)
  })
})

describe('syncEmployeeRef — Issue #43', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('employeeId podan → denormaliziraj ime v soft ref', async () => {
    mocks.mockEmployeeFindUnique.mockResolvedValue({ name: 'Janez Novak' })

    const result = await syncEmployeeRef(undefined, 'emp-1')

    expect(result).toEqual({
      softRef: 'Janez Novak',
      fk: 'emp-1',
    })
  })

  it('employeeId ne obstaja → poskusi resolvati soft ref', async () => {
    mocks.mockEmployeeFindUnique
      .mockResolvedValueOnce(null) // syncEmployeeRef najde employee-a
      .mockResolvedValueOnce({ id: 'emp-2', name: 'Mojca' }) // resolveEmployeeRef

    const result = await syncEmployeeRef('softRef-value', 'nonexistent-id')

    expect(result.fk).toBe('emp-2')
  })

  it('samo soft ref → resolveEmployeeRef', async () => {
    mocks.mockEmployeeFindUnique.mockResolvedValueOnce({ id: 'emp-x', name: 'Test' })

    const result = await syncEmployeeRef('Test', undefined)

    expect(result).toEqual({
      softRef: 'Test',
      fk: 'emp-x',
    })
  })

  it('oba prazna → prazna soft ref, null fk', async () => {
    const result = await syncEmployeeRef('', undefined)
    expect(result).toEqual({ softRef: '', fk: null })
    expect(mocks.mockEmployeeFindUnique).not.toHaveBeenCalled()
  })
})

describe('getEmployeeRefStats — migracijski dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: vse counte na 0
    mocks.mockOrderCount.mockResolvedValue(0)
    mocks.mockStaffShiftCount.mockResolvedValue(0)
    mocks.mockPurchaseOrderCount.mockResolvedValue(0)
    mocks.mockJournalEntryCount.mockResolvedValue(0)
  })

  it('vrne statistiko za vseh 5 polj + overall', async () => {
    mocks.mockOrderCount
      .mockResolvedValueOnce(10) // order.cancelledBy total
      .mockResolvedValueOnce(5)   // with FK
    mocks.mockStaffShiftCount
      .mockResolvedValueOnce(20) // total
      .mockResolvedValueOnce(15)  // with FK
    mocks.mockPurchaseOrderCount
      .mockResolvedValueOnce(8)  // total
      .mockResolvedValueOnce(4)  // requestedBy with FK
      .mockResolvedValueOnce(3)  // approvedBy with FK
    mocks.mockJournalEntryCount
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(50) // with FK

    const result = await getEmployeeRefStats()

    expect(result.orderCancelledBy).toEqual({
      total: 10,
      withFk: 5,
      withoutFk: 5,
      progress: 50.0,
    })
    expect(result.staffShiftCreatedBy.withFk).toBe(15)
    expect(result.purchaseOrderRequestedBy.withFk).toBe(4)
    expect(result.purchaseOrderApprovedBy.withFk).toBe(3)
    expect(result.journalEntryPostedBy.progress).toBe(100)
    expect(result.overall.total).toBe(10 + 20 + 8 * 2 + 50) // 96
  })

  it('prazna baza → 100% progress (nič za migrirat)', async () => {
    const result = await getEmployeeRefStats()
    expect(result.overall.total).toBe(0)
    expect(result.overall.progress).toBe(100)
  })

  it('progress je zaokrožen na 1 decimalno mesto', async () => {
    mocks.mockOrderCount
      .mockResolvedValueOnce(3)  // total
      .mockResolvedValueOnce(1)  // with FK
    mocks.mockStaffShiftCount.mockResolvedValue(0)
    mocks.mockPurchaseOrderCount.mockResolvedValue(0)
    mocks.mockJournalEntryCount.mockResolvedValue(0)

    const result = await getEmployeeRefStats()
    // 1/3 = 33.33... → 33.3
    expect(result.orderCancelledBy.progress).toBe(33.3)
  })
})
