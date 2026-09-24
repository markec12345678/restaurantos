import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * ISSUE #36 R125 — vir resnice za dejanske čase:
 *   TimeEntry = clock-in/out DOGODKI (posamezni vnosi),
 *   StaffShift.actualStart/actualEnd = izračunano okno izmene.
 *
 * Ta helper sinhronizira časovne žige iz TimeEntry v StaffShift ob zapisu
 * vnosa s clockOut: poišče kandidatno izmeno istega zaposlenega na isti
 * koledarski dan (meje dneva clockOut), statusa scheduled/confirmed/in_progress,
 * če ima TimeEntry lokacijo pa še na isti lokaciji. Preferenca: 'in_progress',
 * nato najpoznejši startTime. Posodobi:
 *   actualStart: obstoječi ?? clockIn (ne prepisuje že znanega začetka)
 *   actualEnd:   clockOut
 * Statusa NE spreminja (to je preslikava časov, ne statusna sprememba).
 *
 * Sinhronizacija NIKOLI ne poruši clock-out toka — vsaka napaka je samo
 * zalogirana (logger.warn). Tolerantno: brez kandidata = no-op.
 */
export async function syncActualTimesFromTimeEntry(params: {
  employeeId: string
  clockIn: Date
  clockOut: Date
  locationId?: string | null
}): Promise<void> {
  try {
    // Koledarski dan clockOut (isti vzorec meja dneva kot tip-pool)
    const dayStart = new Date(params.clockOut.getFullYear(), params.clockOut.getMonth(), params.clockOut.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)

    const candidates = await db.staffShift.findMany({
      where: {
        employeeId: params.employeeId,
        shiftDate: { gte: dayStart, lt: dayEnd },
        status: { in: ['scheduled', 'confirmed', 'in_progress'] },
        // TimeEntry.locationId je NOT NULL (schema drift FIX QA runda 38) —
        // null lokacija (defenzivno) pomeni brez lokacijskega filtra.
        ...(params.locationId ? { locationId: params.locationId } : {}),
      },
    })

    if (candidates.length === 0) return

    // Preferenca: 'in_progress' zmaga; nato najpoznejši startTime (HH:mm
    // ničelno oblazinjen — leksikografska sorta je pravilna)
    const byLatestStart = (a: { startTime: string }, b: { startTime: string }) =>
      b.startTime.localeCompare(a.startTime)
    const inProgress = candidates.filter(s => s.status === 'in_progress').sort(byLatestStart)
    const match = inProgress[0] ?? [...candidates].sort(byLatestStart)[0]
    if (!match) return

    await db.staffShift.update({
      where: { id: match.id },
      data: {
        actualStart: match.actualStart ?? params.clockIn,
        actualEnd: params.clockOut,
      },
    })
  } catch (error) {
    // Sinhronizacija je stranski učinek — napaka ne sme prelomiti
    // clock-out poti (TimeEntry je zapisan neodvisno od StaffShift).
    logger.warn('API', '[actual-times-sync] sinhronizacija StaffShift časov ni uspela:', error)
  }
}
