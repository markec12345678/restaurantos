// Pomožne funkcije za cash-register/[id] API — Shema in post-close akcije

import { z } from 'zod'
import { createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { ljubljanaTodayStr } from '@/lib/timezone-sl'
import { upsertZReportForDay } from '@/app/api/z-report/_helpers'

// FIX CRITICAL: Zod validacija za zaprtje izmene
export const closeShiftSchema = z.object({
  closingCash: z.number().min(0, 'Končna gotovina ne more biti negativna').optional(),
  totalTips: z.number().min(0, 'Napitnine ne morejo biti negativne').default(0),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
})

interface ShiftCloseResult {
  id: string
  employeeName: string | null
  locationId: string | null
  closedAt: Date | null
  totalSales: Parameters<typeof toNum>[0]
  cashSales: Parameters<typeof toNum>[0]
  cardSales: Parameters<typeof toNum>[0]
  cashDifference: Parameters<typeof toNum>[0]
  totalOrders: number
}

// FIX MEDIUM: Audit log za zaprtje izmene + Webhook obvestila
export async function postShiftCloseActions(
  closedShift: ShiftCloseResult,
  id: string,
  employeeId: string | undefined,
) {
  // Audit log za zaprtje izmene
  await createAuditLog({
    userId: employeeId,
    action: 'CLOSE_REGISTER_SHIFT',
    entityType: 'CashRegisterShift',
    entityId: id,
    details: {
      totalSales: toNum(closedShift.totalSales),
      cashSales: toNum(closedShift.cashSales),
      cardSales: toNum(closedShift.cardSales),
      cashDifference: toNum(closedShift.cashDifference),
    },
  })

  // Webhook: cash_register.closed
  // R83: locationId pass-through (closedShift.locationId) — tenant isolation
  emitEvent('cash_register.closed', {
    shiftId: id,
    employeeName: closedShift.employeeName || '',
    totalSales: toNum(closedShift.totalSales),
    cashDifference: toNum(closedShift.cashDifference),
  }, closedShift.locationId ?? null).catch(err => logger.error('API', '[Webhook] cash_register.closed napaka:', err))

  // Webhook: daily_report.ready
  emitEvent('daily_report.ready', {
    date: new Date().toISOString().split('T')[0],
    totalSales: toNum(closedShift.totalSales),
    totalOrders: closedShift.totalOrders,
  }, closedShift.locationId ?? null).catch(err => logger.error('API', '[Webhook] daily_report.ready napaka:', err))

  // ── RUNDA 9 NOVA FUNKCIONALNOST: avtomatski Z-poročilo OSNUTEK ob zaprtju izmene ──
  // Ko blagajnik zapre izmeno, se za trenutni (ljubljanski) dan samodejno ustvari
  // ali osveži Z-poročilo OSNUTEK — vodja ima ob koncu dneva pripravljen povzetek
  // in finalizacija je en klik. NIKOLI ne sme pokvariti zapiranja izmene:
  //   - že finalizirano poročilo → tiho preskoči (Z_REPORT_FINALIZED)
  //   - katera koli druga napaka → error log, zaprtje izmene ostane uspešno
  try {
    const zDate = ljubljanaTodayStr(closedShift.closedAt ?? new Date())
    const { report } = await upsertZReportForDay({
      date: zDate,
      locationId: closedShift.locationId ?? undefined,
      employeeId,
      finalize: false,
      notes: '',
    })
    await createAuditLog({
      userId: employeeId,
      action: 'z_report_auto_draft',
      entityType: 'z_report',
      entityId: report.id,
      details: {
        date: zDate,
        trigger: 'cash_register_shift_closed',
        shiftId: id,
        totalSales: toNum(closedShift.totalSales),
      },
    })
    logger.info('API', `[Z-Report] Avtomatski osnutek za ${zDate} osvežen (zaprtje izmene ${id})`)
  } catch (zErr) {
    if (zErr instanceof Error && zErr.message.startsWith('Z_REPORT_FINALIZED')) {
      logger.info('API', '[Z-Report] Avtomatski osnutek preskočen — poročilo za dan je že finalizirano')
    } else {
      logger.error('API', '[Z-Report] Avtomatski osnutek NI uspel (zaprtje izmene ostaja veljavno):', zErr)
    }
  }
}
