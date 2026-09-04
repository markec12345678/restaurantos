// ============================================
// UNIFIED SHIFTS — Združitev Shift + StaffShift
//
// ISSUE #36: Shift in StaffShift modela se prekrivata ~80%. Namesto da
// prepišemo vse 22 callerjev, ustvarimo skupen format + helper ki oba
// modela združi v en rezultat.
//
// Strategija:
//   - StaffShift je primarni model (bolj bogat)
//   - Shift je @deprecated, a še vedno deluje za backward compat
//   - getUnifiedShifts() združi oba v skupen format
//   - Nova koda naj uporablja StaffShift direktno (ne unified)
//   - Obstoječa koda (UI komponente, poročila) naj uporablja getUnifiedShifts()
//
// Migracijska pot:
//   1. Faza 1 (zdaj): unified helper + @deprecated na Shift
//   2. Faza 2 (Q1 2027): prepiši vse Shift callerje na StaffShift
//   3. Faza 3 (v1.0.0): izbriši Shift model
// ============================================

import { db } from '@/lib/db'

export interface UnifiedShift {
  /** ID izvornega zapisa (Shift.id ali StaffShift.id) */
  id: string
  /** Vir zapisa — za debug + migracijski tracking */
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
  // ─── Polja samo iz StaffShift (null za legacy Shift) ───
  shiftType: string | null // morning, afternoon, evening, night, split, custom
  role: string | null // server, chef, bartender, host, manager, prep, dishwasher
  confirmedAt: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  createdBy: string | null
  // ─── Polja samo iz Shift (null za StaffShift) ───
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
 * Pridobi vse izmene (Shift + StaffShift) v enem skupnem formatu.
 */
export async function getUnifiedShifts(filter: UnifiedShiftsFilter = {}): Promise<UnifiedShift[]> {
  // Zgradi where pogoje za oba modela
  const shiftWhere: Record<string, unknown> = {}
  const staffShiftWhere: Record<string, unknown> = {}

  if (filter.employeeId) {
    shiftWhere.employeeId = filter.employeeId
    staffShiftWhere.employeeId = filter.employeeId
  }
  if (filter.locationId) {
    shiftWhere.locationId = filter.locationId
    staffShiftWhere.locationId = filter.locationId
  }
  if (filter.status) {
    shiftWhere.status = filter.status
    staffShiftWhere.status = filter.status
  }

  // Datumski filter
  if (filter.dateFrom || filter.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filter.dateFrom) dateFilter.gte = filter.dateFrom
    if (filter.dateTo) dateFilter.lte = filter.dateTo
    shiftWhere.date = dateFilter
    staffShiftWhere.shiftDate = dateFilter
  }

  // Paralelna poizvedba
  const [shifts, staffShifts] = await Promise.all([
    db.shift.findMany({
      where: shiftWhere,
      orderBy: { date: 'asc' },
    }),
    db.staffShift.findMany({
      where: staffShiftWhere,
      orderBy: { shiftDate: 'asc' },
    }),
  ])

  // Map v unified format
  const unifiedShifts: UnifiedShift[] = []

  for (const s of shifts) {
    unifiedShifts.push({
      id: s.id,
      source: 'shift',
      employeeId: s.employeeId,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      breakMinutes: s.breakMinutes,
      notes: s.notes,
      locationId: s.locationId,
      shiftType: null,
      role: null,
      confirmedAt: null,
      actualStart: null,
      actualEnd: null,
      createdBy: null,
      jobId: s.jobId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })
  }

  for (const s of staffShifts) {
    unifiedShifts.push({
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
      jobId: null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })
  }

  // Sort po datumu (skupaj)
  unifiedShifts.sort((a, b) => a.date.getTime() - b.date.getTime())

  return unifiedShifts
}

/**
 * Preštej izmene po viru (Shift vs StaffShift).
 *
 * Uporabno za migracijski dashboard — admin lahko vidi koliko izmen je še
 * v starem formatu in kdaj bo migracija končana.
 */
export async function getShiftSourceStats(): Promise<{
  shift: number
  staffShift: number
  total: number
  migrationProgress: number // 0-100 (%)
}> {
  const [shiftCount, staffShiftCount] = await Promise.all([
    db.shift.count(),
    db.staffShift.count(),
  ])

  const total = shiftCount + staffShiftCount
  const migrationProgress = total > 0 ? (staffShiftCount / total) * 100 : 100

  return {
    shift: shiftCount,
    staffShift: staffShiftCount,
    total,
    migrationProgress: Math.round(migrationProgress * 10) / 10,
  }
}
