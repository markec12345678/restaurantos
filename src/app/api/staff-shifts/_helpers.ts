// Pomožne funkcije za Staff Shifts API

import { z } from 'zod'

// Zod validacijska shema za kreiranje izmene
export const createStaffShiftSchema = z.object({
  employeeId: z.string().min(1, 'Zaposleni je obvezen').max(100, 'ID zaposlenega ne sme preseči 100 znakov'),
  shiftDate: z.string().min(1, 'Datum izmene je obvezen').max(20, 'Datum ne sme preseči 20 znakov'),
  shiftType: z.enum(['morning', 'afternoon', 'evening', 'night', 'split', 'double']).default('morning'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Čas mora biti v formatu HH:MM').max(5, 'Čas ne sme preseči 5 znakov'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Čas mora biti v formatu HH:MM').max(5, 'Čas ne sme preseči 5 znakov'),
  locationId: z.string().max(100, 'ID lokacije ne sme preseči 100 znakov').optional(),
  role: z.string().max(100, 'Vloga ne sme preseči 100 znakov').optional(),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).default('scheduled'),
})

// Pretvori HH:MM v minute od polnoči
export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Preveri časovno prekrivanje med dvema izmenama
export function checkTimeOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string,
): boolean {
  let newStartMin = parseTimeToMinutes(newStart)
  let newEndMin = parseTimeToMinutes(newEnd)
  if (newEndMin <= newStartMin) newEndMin += 24 * 60

  let exStartMin = parseTimeToMinutes(existingStart)
  let exEndMin = parseTimeToMinutes(existingEnd)
  if (exEndMin <= exStartMin) exEndMin += 24 * 60

  return newStartMin < exEndMin && newEndMin > exStartMin
}

// Izračunaj ure iz startTime/endTime (upoštevaj nočne izmene)
export function calculateShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let hours = (endH * 60 + endM - startH * 60 - startM) / 60
  if (hours < 0) hours += 24
  return hours
}

// Zgradi where filter za GET poizvedbe
export function buildShiftsWhere(searchParams: URLSearchParams): Record<string, unknown> {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const employeeId = searchParams.get('employeeId')
  const locationId = searchParams.get('locationId')
  const status = searchParams.get('status')
  const shiftType = searchParams.get('shiftType')

  const where: Record<string, unknown> = {}

  if (startDate && endDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    where.shiftDate = { gte: start, lte: end }
  } else if (startDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    where.shiftDate = { gte: start }
  }

  if (employeeId) where.employeeId = employeeId
  if (locationId) where.locationId = locationId
  if (status) where.status = status
  if (shiftType) where.shiftType = shiftType

  return where
}

// Izračunaj statistiko pokritosti
export function computeShiftStats(shifts: Array<{ shiftType: string; role: string; startTime: string; endTime: string }>) {
  const byType: Record<string, number> = {}
  const byRole: Record<string, number> = {}
  let totalHours = 0

  for (const s of shifts) {
    byType[s.shiftType] = (byType[s.shiftType] || 0) + 1
    byRole[s.role] = (byRole[s.role] || 0) + 1
    totalHours += calculateShiftHours(s.startTime, s.endTime)
  }

  return { totalShifts: shifts.length, totalHours: Math.round(totalHours * 10) / 10, byType, byRole }
}
