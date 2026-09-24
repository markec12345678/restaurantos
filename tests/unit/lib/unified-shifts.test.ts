// ============================================
// UNIFIED SHIFTS — Unit testi (Issue #36, Faza 2 / R125)
//
// Preverjamo:
// - getUnifiedShifts bere IZKLJUČNO StaffShift (legacy Shift model ukinjen)
// - Vsak vnos: source='staff-shift', polna polja iz superset parity
//   (shiftType, role, confirmedAt, actualStart/End, createdBy, jobId passthrough)
// - Filtri (employeeId, locationId, dateFrom/dateTo → shiftDate, status) delujejo
// - Sort po datumu je pravilen
// - getShiftSourceStats: shift=0, total=staffShift, progress=100 (back-compat kontrakt)
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockStaffShiftFindMany = vi.fn()
  const mockStaffShiftCount = vi.fn()
  return {
    mockStaffShiftFindMany,
    mockStaffShiftCount,
  }
})

vi.mock('@/lib/db', () => ({
  db: {
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

// Helper: mock StaffShift record (superset parity — vključno z jobId)
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
  jobId: 'job-1',
  createdAt: new Date('2026-08-27T00:00:00Z'),
  updatedAt: new Date('2026-08-27T00:00:00Z'),
  ...overrides,
})

describe('getUnifiedShifts — Issue #36 Faza 2 (R125)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockStaffShiftFindMany.mockResolvedValue([])
  })

  it('vrne prazno tabelo če ni podatkov', async () => {
    const result = await getUnifiedShifts()
    expect(result).toEqual([])
  })

  it('bere izključno StaffShift — en findMany klic, brez legacy modela', async () => {
    mocks.mockStaffShiftFindMany.mockResolvedValue([
      mockStaffShiftRow({ id: 'ss-1' }),
      mockStaffShiftRow({ id: 'ss-2', shiftDate: new Date('2026-08-29T10:00:00Z') }),
    ])

    const result = await getUnifiedShifts()

    expect(mocks.mockStaffShiftFindMany).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(2)
    expect(result.every((r: UnifiedShift) => r.source === 'staff-shift')).toBe(true)
  })

  it('StaffShift → source=staff-shift, vsa polja iz superset parity', async () => {
    mocks.mockStaffShiftFindMany.mockResolvedValue([
      mockStaffShiftRow({
        id: 'ss-1',
        shiftType: 'evening',
        role: 'chef',
        jobId: 'job-x',
        confirmedAt: new Date('2026-08-27T18:00:00Z'),
        actualStart: new Date('2026-08-28T17:55:00Z'),
        actualEnd: new Date('2026-08-29T01:10:00Z'),
        createdBy: 'admin-9',
      }),
    ])

    const result = await getUnifiedShifts()
    expect(result).toHaveLength(1)
    const shift = result[0]

    expect(shift.source).toBe('staff-shift')
    expect(shift.date).toEqual(new Date('2026-08-28T10:00:00Z')) // date = shiftDate
    expect(shift.shiftType).toBe('evening')
    expect(shift.role).toBe('chef')
    expect(shift.jobId).toBe('job-x') // pravi jobId (FK superset parity)
    expect(shift.confirmedAt).toEqual(new Date('2026-08-27T18:00:00Z'))
    expect(shift.actualStart).toEqual(new Date('2026-08-28T17:55:00Z'))
    expect(shift.actualEnd).toEqual(new Date('2026-08-29T01:10:00Z'))
    expect(shift.createdBy).toBe('admin-9')
    expect(shift.startTime).toBe('06:00')
    expect(shift.breakMinutes).toBe(30)
  })

  it('filter po employeeId propagira v where', async () => {
    await getUnifiedShifts({ employeeId: 'emp-99' })

    const where = mocks.mockStaffShiftFindMany.mock.calls[0][0].where
    expect(where.employeeId).toBe('emp-99')
  })

  it('filter po locationId propagira v where', async () => {
    await getUnifiedShifts({ locationId: 'loc-x' })

    const where = mocks.mockStaffShiftFindMany.mock.calls[0][0].where
    expect(where.locationId).toBe('loc-x')
  })

  it('filter po status propagira v where', async () => {
    await getUnifiedShifts({ status: 'completed' })

    const where = mocks.mockStaffShiftFindMany.mock.calls[0][0].where
    expect(where.status).toBe('completed')
  })

  it('datumski filter: dateFrom/dateTo → StaffShift.shiftDate', async () => {
    const dateFrom = new Date('2026-08-01')
    const dateTo = new Date('2026-08-31')

    await getUnifiedShifts({ dateFrom, dateTo })

    const where = mocks.mockStaffShiftFindMany.mock.calls[0][0].where
    expect(where.shiftDate.gte).toBe(dateFrom)
    expect(where.shiftDate.lte).toBe(dateTo)
  })

  it('brez datumskih filtrov ni shiftDate ključa v where', async () => {
    await getUnifiedShifts({ employeeId: 'emp-1' })

    const where = mocks.mockStaffShiftFindMany.mock.calls[0][0].where
    expect(where.shiftDate).toBeUndefined()
  })

  it('sort po datumu', async () => {
    mocks.mockStaffShiftFindMany.mockResolvedValue([
      mockStaffShiftRow({ id: 'ss-3', shiftDate: new Date('2026-08-30T10:00:00Z') }),
      mockStaffShiftRow({ id: 'ss-1', shiftDate: new Date('2026-08-28T10:00:00Z') }),
      mockStaffShiftRow({ id: 'ss-2', shiftDate: new Date('2026-08-29T10:00:00Z') }),
    ])

    const result = await getUnifiedShifts()

    expect(result.map((r) => r.id)).toEqual(['ss-1', 'ss-2', 'ss-3'])
  })

  it('orderBy shiftDate asc je poslan bazi', async () => {
    await getUnifiedShifts()

    expect(mocks.mockStaffShiftFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { shiftDate: 'asc' } }),
    )
  })
})

describe('getShiftSourceStats — back-compat kontrakt po Fazi 2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shift=0, total=staffShift, migrationProgress=100 (legacy vir ne obstaja več)', async () => {
    mocks.mockStaffShiftCount.mockResolvedValue(80)

    const result = await getShiftSourceStats()

    expect(result).toEqual({
      shift: 0,
      staffShift: 80,
      total: 80,
      migrationProgress: 100,
    })
    expect(mocks.mockStaffShiftCount).toHaveBeenCalledTimes(1)
  })

  it('prazna baza → total 0 in 100%', async () => {
    mocks.mockStaffShiftCount.mockResolvedValue(0)

    const result = await getShiftSourceStats()
    expect(result.total).toBe(0)
    expect(result.migrationProgress).toBe(100)
  })
})
