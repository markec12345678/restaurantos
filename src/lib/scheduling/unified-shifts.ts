// ============================================
// UNIFIED SHIFTS — kompatibilni sloj nad StaffShift
//
// ISSUE #36: Shift in StaffShift modela se prekrivata ~80%.
//
// Migracijska pot (izvedena):
//   1. Faza 1 (R124): unified helper + @deprecated na Shift
//   2. Faza 2 (R125): vsi Shift callerji prepisani na StaffShift + Shift model
//      UKINJEN iz sheme (migracija 0011_shift_dedup) — issue #36 zaprt
//   3. (v1.0.0) ta helper ostane kot tanek kompatibilni sloj nad StaffShift
//
// getUnifiedShifts() zdaj bere IZKLJUČNO StaffShift in polni celoten
// UnifiedShift format (shiftType/role/confirmedAt/actualStart/actualEnd/
// createdBy + pravi jobId iz superset parity FK-ja).
// ============================================

import { db } from '@/lib/db'

export interface UnifiedShift {
  /** ID izvornega zapisa (StaffShift.id) */
  id: string
  /** Vir zapisa — vedno 'staff-shift' po Fazi 2 (ostane za type back-compat) */
  source: 'shift' | 'staff-shift'
  employeeId: string
  /** Datum izmene (Date — brez ure) */
  date: Date
  startTime: string // HH:mm
  endTime: string // HH:mm
  status: string
  breakMinutes: number
  notes: string
  locationId: string | null
  shiftType: string | null // morning, afternoon, evening, night, split, custom
  role: string | null // server, chef, bartender, host, manager, prep, dishwasher
  confirmedAt: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  createdBy: string | null
  jobId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UnifiedShiftsFilter {
  employeeId?: string
  locationId?: string
  dateFrom?: Date
  dateTo?: Date
  status?: string
}

/**
 * Pridobi vse izmene v enem skupnem formatu (Faza 2: izključno StaffShift).
 */
export async function getUnifiedShifts(filter: UnifiedShiftsFilter = {}): Promise<UnifiedShift[]> {
  // Zgradi where pogoje (UnifiedShiftsFilter → StaffShift polja)
  const where: Record<string, unknown> = {}

  if (filter.employeeId) {
    where.employeeId = filter.employeeId
  }
  if (filter.locationId) {
    where.locationId = filter.locationId
  }
  if (filter.status) {
    where.status = filter.status
  }

  // Datumski filter (dateFrom/dateTo → shiftDate)
  if (filter.dateFrom || filter.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filter.dateFrom) dateFilter.gte = filter.dateFrom
    if (filter.dateTo) dateFilter.lte = filter.dateTo
    where.shiftDate = dateFilter
  }

  const staffShifts = await db.staffShift.findMany({
    where,
    orderBy: { shiftDate: 'asc' },
  })

  // Map v unified format — vsa polja iz StaffShift (superset)
  const unifiedShifts: UnifiedShift[] = staffShifts.map(s => ({
    id: s.id,
    source: 'staff-shift',
    employeeId: s.employeeId,
    date: s.shiftDate,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    breakMinutes: s.breakMinutes,
    notes: s.notes,
    locationId: s.locationId,
    shiftType: s.shiftType,
    role: s.role,
    confirmedAt: s.confirmedAt,
    actualStart: s.actualStart,
    actualEnd: s.actualEnd,
    createdBy: s.createdBy,
    jobId: s.jobId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))

  // Sort po datumu
  unifiedShifts.sort((a, b) => a.date.getTime() - b.date.getTime())

  return unifiedShifts
}

/**
 * Preštej izmene po viru.
 *
 * Faza 2: legacy Shift model ne obstaja več — `shift` je vedno 0 in
 * migrationProgress vedno 100% (ostane za back-compat klicateljev kontrakt).
 */
export async function getShiftSourceStats(): Promise<{
  shift: number
  staffShift: number
  total: number
  migrationProgress: number // 0-100 (%)
}> {
  const staffShiftCount = await db.staffShift.count()

  return {
    shift: 0,
    staffShift: staffShiftCount,
    total: staffShiftCount,
    migrationProgress: 100,
  }
}
