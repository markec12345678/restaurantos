// ============================================
// UNIFIED SHIFTS — Unit testi (Issue #36)
//
// Preverjamo:
// - getUnifiedShifts združi Shift + StaffShift v en rezultat
// - Filtri (employeeId, locationId, dateFrom/dateTo, status) delujejo
// - Sort po datumu je pravilen
// - Polja iz StaffShift so null za Shift vnose (in obratno)
// - getShiftSourceStats vrne števce in migration progress
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockShiftFindMany = vi.fn()
  const mockStaffShiftFindMany = vi.fn()
  const mockShiftCount = vi.fn()
  const mockStaffShiftCount = vi.fn()
  return {
    mockShiftFindMany,
    mockStaffShiftFindMany,
    mockShiftCount,
    mockStaffShiftCount,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    shift: {
      findMany: mocks.mockShiftFindMany,
      count: mocks.mockShiftCount,
    },
    staffShift: {
      findMany: mocks.mockStaffShiftFindMany,
      count: mocks.mockStaffShiftCount,
    },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import {
  getUnifiedShifts,
  getShiftSourceStats,
  type UnifiedShift,
} from '@/lib/scheduling/unified-shifts'

// Helper: mock Shift record
const mockShiftRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'shift-1',
  employeeId: 'emp-1',
  jobId: 'job-1',
  date: new Date('2026-08-28T10:00:00Z'),
  startTime: '09:00',
  endTime: '17:00',
  status: 'scheduled',
  breakMinutes: 30,
  notes: '',
  locationId: null,
  createdAt: new Date('2026-08-27T00:00:00Z'),
  updatedAt: new Date('2026-08-27T00:00:00Z'),
  ...overrides,
})

// Helper: mock StaffShift record
const mockStaffShiftRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'ss-1',
  employeeId: 'emp-1',
  shiftDate: new Date('2026-08-28T10:00:00Z'),
  shiftType: 'morning',
  startTime: '06:00',
  endTime: '14:00',
  locationId: null,
  role: 'server',
  notes: '',
  status: 'confirmed',
  confirmedAt: new Date('2026-08-27T12:00:00Z'),
  actualStart: null,
  actualEnd: null,
  breakMinutes: 30,
  createdBy: 'admin-1',
  createdAt: new Date('2026-08-27T00:00:00Z'),
  updatedAt: new Date('2026-08-27T00:00:00Z'),
  ...overrides,
})

describe('getUnifiedShifts — Issue #36', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockShiftFindMany.mockResolvedValue([])
    mocks.mockStaffShiftFindMany.mockResolvedValue([])
  })

  it('vrne prazno tabelo če ni podatkov', async () => {
    const result = await getUnifiedShifts()
    expect(result).toEqual([])
  })

  it('združi Shift in StaffShift v en rezultat', async () => {
    mocks.mockShiftFindMany.mockResolvedValue([mockShiftRow({ id: 'shift-1' })])
    mocks.mockStaffShiftFindMany.mockResolvedValue([mockStaffShiftRow({ id: 'ss-1' })])

    const result = await getUnifiedShifts()
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.source).sort()).toEqual(['shift', 'staff-shift'])
  })

  it('Shift → source=shift, jobId nastavljen, shiftType=null', async () => {
    mocks.mockShiftFindMany.mockResolvedValue([mockShiftRow({ id: 'shift-1', jobId: 'job-x' })])

    const result = await getUnifiedShifts()
    expect(result).toHaveLength(1)
    const shift = result[0]

    expect(shift.source).toBe('shift')
    expect(shift.jobId).toBe('job-x')
    expect(shift.shiftType).toBeNull()
    expect(shift.role).toBeNull()
    expect(shift.confirmedAt).toBeNull()
    expect(shift.actualStart).toBeNull()
    expect(shift.actualEnd).toBeNull()
    expect(shift.createdBy).toBeNull()
  })

  it('StaffShift → source=staff-shift, shiftType in role nastavljena, jobId=null', async () => {
    mocks.mockStaffShiftFindMany.mockResolvedValue([
      mockStaffShiftRow({ id: 'ss-1', shiftType: 'evening', role: 'chef' }),
    ])

    const result = await getUnifiedShifts()
    expect(result).toHaveLength(1)
    const shift = result[0]

    expect(shift.source).toBe('staff-shift')
    expect(shift.shiftType).toBe('evening')
    expect(shift.role).toBe('chef')
    expect(shift.jobId).toBeNull()
    expect(shift.confirmedAt).not.toBeNull()
    expect(shift.createdBy).toBe('admin-1')
  })

  it('filter po employeeId propagira v oba modela', async () => {
    mocks.mockShiftFindMany.mockResolvedValue([])
    mocks.mockStaffShiftFindMany.mockResolvedValue([])

    await getUnifiedShifts({ employeeId: 'emp-99' })

    expect(mocks.mockShiftFindMany.mock.calls[0][0].where.employeeId).toBe('emp-99')
    expect(mocks.mockStaffShiftFindMany.mock.calls[0][0].where.employeeId).toBe('emp-99')
  })

  it('filter po locationId propagira v oba modela', async () => {
    await getUnifiedShifts({ locationId: 'loc-x' })

    expect(mocks.mockShiftFindMany.mock.calls[0][0].where.locationId).toBe('loc-x')
    expect(mocks.mockStaffShiftFindMany.mock.calls[0][0].where.locationId).toBe('loc-x')
  })

  it('filter po status propagira v oba modela', async () => {
    await getUnifiedShifts({ status: 'completed' })

    expect(mocks.mockShiftFindMany.mock.calls[0][0].where.status).toBe('completed')
    expect(mocks.mockStaffShiftFindMany.mock.calls[0][0].where.status).toBe('completed')
  })

  it('datumski filter: Shift.date, StaffShift.shiftDate', async () => {
    const dateFrom = new Date('2026-08-01')
    const dateTo = new Date('2026-08-31')

    await getUnifiedShifts({ dateFrom, dateTo })

    const shiftWhere = mocks.mockShiftFindMany.mock.calls[0][0].where
    const staffShiftWhere = mocks.mockStaffShiftFindMany.mock.calls[0][0].where

    expect(shiftWhere.date.gte).toBe(dateFrom)
    expect(shiftWhere.date.lte).toBe(dateTo)
    expect(staffShiftWhere.shiftDate.gte).toBe(dateFrom)
    expect(staffShiftWhere.shiftDate.lte).toBe(dateTo)
  })

  it('sort po datumu (skupaj)', async () => {
    mocks.mockShiftFindMany.mockResolvedValue([
      mockShiftRow({ id: 's3', date: new Date('2026-08-30T10:00:00Z') }),
      mockShiftRow({ id: 's1', date: new Date('2026-08-28T10:00:00Z') }),
    ])
    mocks.mockStaffShiftFindMany.mockResolvedValue([
      mockStaffShiftRow({ id: 'ss2', shiftDate: new Date('2026-08-29T10:00:00Z') }),
    ])

    const result = await getUnifiedShifts()

    expect(result.map((r) => r.id)).toEqual(['s1', 'ss2', 's3'])
  })

  it('paralelna poizvedba (Promise.all)', async () => {
    mocks.mockShiftFindMany.mockResolvedValue([])
    mocks.mockStaffShiftFindMany.mockResolvedValue([])

    await getUnifiedShifts()

    expect(mocks.mockShiftFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.mockStaffShiftFindMany).toHaveBeenCalledTimes(1)
  })
})

describe('getShiftSourceStats — migracijski dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vrne števce in progress', async () => {
    mocks.mockShiftCount.mockResolvedValue(20)
    mocks.mockStaffShiftCount.mockResolvedValue(80)

    const result = await getShiftSourceStats()

    expect(result).toEqual({
      shift: 20,
      staffShift: 80,
      total: 100,
      migrationProgress: 80.0,
    })
  })

  it('100% če so vse izmene v StaffShift', async () => {
    mocks.mockShiftCount.mockResolvedValue(0)
    mocks.mockStaffShiftCount.mockResolvedValue(50)

    const result = await getShiftSourceStats()
    expect(result.migrationProgress).toBe(100)
    expect(result.shift).toBe(0)
  })

  it('0% če so vse izmene v Shift', async () => {
    mocks.mockShiftCount.mockResolvedValue(50)
    mocks.mockStaffShiftCount.mockResolvedValue(0)

    const result = await getShiftSourceStats()
    expect(result.migrationProgress).toBe(0)
  })

  it('prazna baza → 100% (default, nič za migrirat)', async () => {
    mocks.mockShiftCount.mockResolvedValue(0)
    mocks.mockStaffShiftCount.mockResolvedValue(0)

    const result = await getShiftSourceStats()
    expect(result.total).toBe(0)
    expect(result.migrationProgress).toBe(100)
  })

  it('zaokroži progress na 1 decimalno mesto', async () => {
    mocks.mockShiftCount.mockResolvedValue(3)
    mocks.mockStaffShiftCount.mockResolvedValue(7)

    const result = await getShiftSourceStats()
    expect(result.migrationProgress).toBe(70.0) // 7/10 = 70.0%
  })
})
