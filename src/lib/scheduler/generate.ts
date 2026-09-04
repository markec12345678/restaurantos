// ============================================
// AI STAFF SCHEDULER — Generation Algorithm
// ============================================
// Glavni algoritem: greedy assignment z omejitvami
// ============================================

import { db } from '@/lib/db'
import { toNum, round2 } from '@/lib/decimal'
import type { DecimalLike } from '@/lib/decimal/types'
import {
  LABOR_CONSTRAINTS,
  SHIFT_TEMPLATES,
  type ShiftType,
  type SchedulerInput,
  type ForecastedDay,
  type GeneratedShift,
  type SchedulerResult,
  calcShiftHours,
  isEmployeeAvailable,
  isOnTimeOff,
  hasMinRest,
  classifyBusyLevel,
  requiredStaffPerShift,
  weeklyHours,
  consecutiveWorkingDays,
} from './index'

// --- Tipi za DB zaposlene ---
interface EmployeeWithRelations {
  id: string
  name: string
  role: string
  status: string
  jobs: Array<{ jobId: string; isPrimary: boolean; payRate: unknown; job: { name: string; basePayRate: unknown } }>
  availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isPreferred: boolean }>
  timeOffRequests: Array<{ startDate: Date; endDate: Date; status: string }>
  staffShifts: Array<{ shiftDate: Date; startTime: string; endTime: string; status: string }>
}

// --- Pridobi zgodovino za forecast ---
async function getForecastedDays(startDate: string, days: number, locationId?: string): Promise<ForecastedDay[]> {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  // Pridobi zadnjih 90 dni zgodovine
  const ninetyDaysAgo = new Date(start)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const historicalOrders = await db.order.findMany({
    where: {
      paidAt: { gte: ninetyDaysAgo, lt: start },
      paymentStatus: 'paid',
      ...(locationId ? { locationId } : {}),
    },
    select: { paidAt: true, total: true },
  })

  // Agregiraj po dnevih v tednu
  const dayOfWeekStats: Array<{ revenue: number; orders: number; count: number }> = Array(7)
    .fill(0)
    .map(() => ({ revenue: 0, orders: 0, count: 0 }))

  for (const order of historicalOrders) {
    if (!order.paidAt) continue
    const dow = new Date(order.paidAt).getDay()
    dayOfWeekStats[dow].revenue += toNum(order.total)
    dayOfWeekStats[dow].orders++
    dayOfWeekStats[dow].count++
  }

  // Povprečje
  const dayOfWeekAvg = dayOfWeekStats.map((s) => ({
    revenue: s.count > 0 ? s.revenue / s.count : 0,
    orders: s.count > 0 ? s.orders / s.count : 0,
  }))

  // Generiraj forecast za vsak dan v obdobju
  const result: ForecastedDay[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const dow = date.getDay()

    const expectedRevenue = round2(dayOfWeekAvg[dow].revenue)
    const expectedOrders = Math.round(dayOfWeekAvg[dow].orders)
    const busyLevel = classifyBusyLevel(expectedRevenue, expectedOrders)

    result.push({
      date: dateStr,
      dayOfWeek: dow,
      expectedRevenue,
      expectedOrders,
      busyLevel,
    })
  }
  return result
}

// --- Glavni algoritem ---
export async function generateSchedule(input: SchedulerInput): Promise<SchedulerResult> {
  const dryRun = input.apply ? false : input.dryRun !== false // default true

  // 1. Pridobi forecast
  const forecast = await getForecastedDays(input.startDate, input.days, input.locationId)

  if (forecast.length === 0) {
    return {
      generated: [],
      coverage: [],
      insights: {
        totalShifts: 0,
        totalHours: 0,
        totalLaborCost: 0,
        employeesUsed: 0,
        coverageGaps: 0,
        conflicts: ['Ni podatkov za napoved.'],
        recommendations: ['Najprej dodajte zgodovinske podatke o naročilih.'],
      },
      dryRun,
    }
  }

  // 2. Pridobi vse aktivne zaposlene z relacijami
  const employees = (await db.employee.findMany({
    where: { status: 'active' },
    include: {
      jobs: { include: { job: true } },
      availability: true,
      timeOffRequests: {
        where: { status: { in: ['approved', 'pending'] } },
      },
      staffShifts: {
        where: {
          shiftDate: {
            gte: new Date(input.startDate),
            lt: new Date(new Date(input.startDate).getTime() + input.days * 24 * 60 * 60 * 1000),
          },
          status: { notIn: ['cancelled', 'no_show'] },
        },
      },
    },
  })) as EmployeeWithRelations[]

  if (employees.length === 0) {
    return {
      generated: [],
      coverage: forecast.flatMap((f) =>
        (['morning', 'afternoon', 'evening', 'night'] as ShiftType[]).map((st) => ({
          date: f.date,
          shiftType: st,
          required: requiredStaffPerShift(f.busyLevel, st),
          assigned: 0,
          gap: requiredStaffPerShift(f.busyLevel, st),
        })),
      ),
      insights: {
        totalShifts: 0,
        totalHours: 0,
        totalLaborCost: 0,
        employeesUsed: 0,
        coverageGaps: forecast.length * 4,
        conflicts: ['Ni aktivnih zaposlenih v sistemu.'],
        recommendations: ['Dodajte zaposlene prek /api/employees.'],
      },
      dryRun,
    }
  }

  // 3. Generiraj razpored (greedy)
  const generated: GeneratedShift[] = []
  const coverage: SchedulerResult['coverage'] = []
  const conflicts: string[] = []

  for (const day of forecast) {
    for (const shiftType of ['morning', 'afternoon', 'evening', 'night'] as ShiftType[]) {
      const template = SHIFT_TEMPLATES[shiftType]
      const required = requiredStaffPerShift(day.busyLevel, shiftType)
      let assigned = 0

      // Kandidati: zaposleni, ki so na voljo ta dan v tem času
      const candidates = employees
        .map((emp) => {
          const avail = isEmployeeAvailable(day.dayOfWeek, template.start, template.end, emp.availability)
          const onTimeOff = isOnTimeOff(day.date, emp.timeOffRequests)
          const minRestOk = hasMinRest(day.date, template.start, template.end, emp.staffShifts)

          // Preveri ali zaposleni že ima izmeno tega dne
          const alreadyWorking = [...generated, ...emp.staffShifts.map((s) => ({
            date: new Date(s.shiftDate).toISOString().split('T')[0],
            startTime: s.startTime,
            endTime: s.endTime,
          }))].some((s) =>
            s.date === day.date && overlaps(s.startTime, s.endTime, template.start, template.end)
          )

          // Preveri tedenske ure
          const weekHours = weeklyHours(emp.id, generated, day.date) +
            emp.staffShifts
              .filter((s) => isSameWeek(new Date(s.shiftDate), new Date(day.date)))
              .reduce((sum, s) => sum + calcShiftHours(s.startTime, s.endTime), 0)

          // Preveri zaporedne delovne dneve
          const consecutive = consecutiveWorkingDays(emp.id, generated, day.date)

          // Preveri ali ima zaposleni primarno vlogo za to izmeno
          const hasMatchingRole = emp.jobs.some((ej) => {
            const jobName = ej.job.name.toLowerCase()
            return template.role_priority.some((role) => jobName.includes(role) || emp.role.toLowerCase().includes(role))
          })

          // Score: višji = boljši kandidat
          let score = 0
          if (!avail.available || onTimeOff || !minRestOk || alreadyWorking) {
            return { emp, score: -1, eligible: false, reasons: [], warnings: [] }
          }
          if (weekHours >= LABOR_CONSTRAINTS.MAX_HOURS_PER_WEEK) {
            return { emp, score: -1, eligible: false, reasons: [], warnings: [`Dosegel ${weekHours}h/week`] }
          }
          if (consecutive >= LABOR_CONSTRAINTS.MAX_CONSECUTIVE_WORKING_DAYS) {
            return { emp, score: -1, eligible: false, reasons: [], warnings: [`Dosegel ${consecutive} zaporednih dni`] }
          }

          score = 50 // baseline
          if (avail.preferred) score += 20 // preferirano okno
          if (hasMatchingRole) score += 15 // ustrezna vloga
          if (weekHours < LABOR_CONSTRAINTS.DEFAULT_HOURS_PER_WEEK) score += 10 // še ima prostih ur
          score -= consecutive * 3 // manjši score za dolge nize

          const reasons: string[] = []
          if (avail.preferred) reasons.push('Preferirano časovno okno')
          if (hasMatchingRole) reasons.push('Ustrezna vloga')
          if (weekHours < LABOR_CONSTRAINTS.DEFAULT_HOURS_PER_WEEK) reasons.push(`Še ima kapaciteto (${weekHours.toFixed(1)}h/teden)`)

          const warnings: string[] = []
          if (!avail.preferred && avail.available) warnings.push('Ni preferirano okno (samo na voljo)')
          if (weekHours > 30) warnings.push(`Visoke ure: ${weekHours.toFixed(1)}h/teden`)

          return { emp, score, eligible: true, reasons, warnings }
        })
        .filter((c) => c.eligible)
        .sort((a, b) => b.score - a.score)

      // Dodeli izmene top-N kandidatom
      for (const candidate of candidates) {
        if (assigned >= required) break

        const hours = calcShiftHours(template.start, template.end)
        const breakMinutes =
          hours > LABOR_CONSTRAINTS.BREAK_THRESHOLD_HOURS ? LABOR_CONSTRAINTS.DEFAULT_BREAK_MINUTES : 0

        generated.push({
          date: day.date,
          shiftType,
          startTime: template.start,
          endTime: template.end,
          employeeId: candidate.emp.id,
          employeeName: candidate.emp.name,
          role: candidate.emp.jobs.find((j) => j.isPrimary)?.job.name || candidate.emp.role,
          hours,
          breakMinutes,
          locationId: input.locationId,
          reasons: candidate.reasons,
          warnings: candidate.warnings,
        })
        assigned++
      }

      coverage.push({
        date: day.date,
        shiftType,
        required,
        assigned,
        gap: Math.max(0, required - assigned),
      })

      if (assigned < required) {
        conflicts.push(
          `${day.date} ${shiftType}: manjka ${required - assigned} zaposleni (potreba: ${required}, dodeljeni: ${assigned})`,
        )
      }
    }
  }

  // 4. Insighti
  const totalHours = generated.reduce((sum, s) => sum + s.hours, 0)
  const employeesUsed = new Set(generated.map((s) => s.employeeId)).size
  const totalLaborCost = generated.reduce((sum, s) => {
    const emp = employees.find((e) => e.id === s.employeeId)
    if (!emp) return sum
    const primaryJob = emp.jobs.find((j) => j.isPrimary) || emp.jobs[0]
    const rate = primaryJob ? toNum(primaryJob.payRate as DecimalLike) || toNum(primaryJob.job.basePayRate as DecimalLike) : 0
    return sum + rate * s.hours
  }, 0)

  const coverageGaps = coverage.filter((c) => c.gap > 0).length

  const recommendations: string[] = []
  if (coverageGaps > 0) {
    recommendations.push(`Pokritost: ${coverageGaps} izmen manjka osebja. Razmislite o dodatnih zaposlitvah ali razširitvi razpoložljivosti.`)
  }
  if (employeesUsed < employees.length) {
    recommendations.push(`${employees.length - employeesUsed} zaposleni niso v razporedu — preverite njihovo razpoložljivost.`)
  }
  const avgHoursPerEmp = employeesUsed > 0 ? totalHours / employeesUsed : 0
  if (avgHoursPerEmp > 45) {
    recommendations.push(`Povprečno ${avgHoursPerEmp.toFixed(1)}h/zaposleni — blizu zakonske meje (48h).`)
  } else if (avgHoursPerEmp < 20) {
    recommendations.push(`Povprečno ${avgHoursPerEmp.toFixed(1)}h/zaposleni — morda podzaposlenost, preverite potrebe.`)
  }
  const totalRevenueForecast = forecast.reduce((sum, f) => sum + f.expectedRevenue, 0)
  if (totalLaborCost > 0 && totalRevenueForecast > 0) {
    const laborPct = round2((totalLaborCost / totalRevenueForecast) * 100)
    if (laborPct > 35) {
      recommendations.push(`Strošek dela ${laborPct}% pričakovanega prometa — visoko (industrija: 25-35%).`)
    } else {
      recommendations.push(`Strošek dela ${laborPct}% pričakovanega prometa — v okviru.`)
    }
  }

  // 5. Shrani v DB (če ni dryRun)
  if (!dryRun && generated.length > 0) {
    // Idempotentno: izbriši predhodno avtomatsko generirane izmene za to obdobje
    await db.staffShift.deleteMany({
      where: {
        shiftDate: {
          gte: new Date(input.startDate),
          lt: new Date(new Date(input.startDate).getTime() + input.days * 24 * 60 * 60 * 1000),
        },
        notes: { startsWith: '[AI-SCHEDULER]' },
        ...(input.locationId ? { locationId: input.locationId } : {}),
      },
    })

    // Vstavi nove
    await db.staffShift.createMany({
      data: generated.map((s) => ({
        employeeId: s.employeeId,
        shiftDate: new Date(s.date),
        shiftType: s.shiftType,
        startTime: s.startTime,
        endTime: s.endTime,
        role: s.role,
        locationId: s.locationId,
        breakMinutes: s.breakMinutes,
        notes: `[AI-SCHEDULER] ${s.reasons.join('; ') || 'auto'}`,
        status: 'scheduled',
      })),
    })
  }

  return {
    generated,
    coverage,
    insights: {
      totalShifts: generated.length,
      totalHours: round2(totalHours),
      totalLaborCost: round2(totalLaborCost),
      employeesUsed,
      coverageGaps,
      conflicts,
      recommendations,
    },
    dryRun,
  }
}

// --- Pomožne funkcije ---
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  let aS = timeToMin(aStart)
  let aE = timeToMin(aEnd)
  if (aE <= aS) aE += 24 * 60
  let bS = timeToMin(bStart)
  let bE = timeToMin(bEnd)
  if (bE <= bS) bE += 24 * 60
  return aS < bE && aE > bS
}

function isSameWeek(d1: Date, d2: Date): boolean {
  const getMonday = (d: Date) => {
    const date = new Date(d)
    const dayOfWeek = date.getDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    date.setDate(date.getDate() + diffToMonday)
    date.setHours(0, 0, 0, 0)
    return date
  }
  return getMonday(d1).getTime() === getMonday(d2).getTime()
}
