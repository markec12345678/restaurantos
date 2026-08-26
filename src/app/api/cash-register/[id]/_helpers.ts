// Pomožne funkcije za cash-register/[id] API — Shema in post-close akcije

import { z } from 'zod'
import { createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'

// FIX CRITICAL: Zod validacija za zaprtje izmene
export const closeShiftSchema = z.object({
  closingCash: z.number().min(0, 'Končna gotovina ne more biti negativna').optional(),
  totalTips: z.number().min(0, 'Napitnine ne morejo biti negativne').default(0),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
})

interface ShiftCloseResult {
  id: string
  employeeName: string | null
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
  emitEvent('cash_register.closed', {
    shiftId: id,
    employeeName: closedShift.employeeName || '',
    totalSales: toNum(closedShift.totalSales),
    cashDifference: toNum(closedShift.cashDifference),
  }).catch(err => logger.error('API', '[Webhook] cash_register.closed napaka:', err))

  // Webhook: daily_report.ready
  emitEvent('daily_report.ready', {
    date: new Date().toISOString().split('T')[0],
    totalSales: toNum(closedShift.totalSales),
    totalOrders: closedShift.totalOrders,
  }).catch(err => logger.error('API', '[Webhook] daily_report.ready napaka:', err))
}
